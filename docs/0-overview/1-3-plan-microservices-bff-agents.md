# Phase 3 Plan: Microservices, BFF Pattern & Python Agents

## Table of Contents

- [Goal](#goal)
- [Architecture](#architecture)
- [Phase 3a: Direct HTTP (Start Here)](#phase-3a-direct-http-start-here)
- [Phase 3b: Redis Message Queue](#phase-3b-message-queue-when-agents-get-complex)
- [Phase 3c: Production Queue (SQS / RabbitMQ)](#phase-3c-production-queue-sqs--rabbitmq)
- [Timeline](#timeline)
- [Appendix: Resources & Links](#appendix-resources--links)

---

## Goal

Add a FastAPI Python microservice for AI/agentic workflows alongside the existing Express API. Establish the BFF (Backend for Frontend) pattern and inter-service communication. Evolve from simple HTTP calls to a production-grade message queue.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        React Dashboard                        │
│                        (frontend)                             │
│                             │                                 │
│                        Only talks to                          │
│                        Express (BFF)                          │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     Docker Compose                            │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │   Express API     │  HTTP   │   FastAPI Agents         │  │
│  │   (BFF)           │ ◄─────► │   (Python)               │  │
│  │                   │         │                          │  │
│  │   30 endpoints    │         │   /agents/analyze        │  │
│  │   /api/projects   │         │   /agents/summarize      │  │
│  │   /api/users      │         │   /agents/workflow       │  │
│  │   /api/billing    │         │                          │  │
│  │   :8080           │         │   :8000                  │  │
│  └────────┬──────────┘         └────────────┬────────────┘  │
│           │                                  │               │
│           ▼                                  │               │
│  ┌──────────────────┐                        │               │
│  │    Postgres       │ ◄─────────────────────┘               │
│  │    :5432          │   (agents read/write data too)        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

### Key Rule: React Never Calls FastAPI Directly

```
GOOD:   React → Express (BFF) → FastAPI
BAD:    React → FastAPI directly
```

Express is the single gateway. It orchestrates everything. The frontend only knows about one API.

---

## Phase 3a: Direct HTTP (Start Here)

### What We Build

Simple synchronous communication between Express and FastAPI.

```
Express ←──HTTP──→ FastAPI
  │                    │
  └── both talk to ────┘
        Postgres
```

### Project Structure

```
yourproduct/
├── backend/              Express API (existing 30 endpoints)
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/
│   │   │   ├── projects.js
│   │   │   ├── users.js
│   │   │   └── agents.js      ← NEW: proxy to FastAPI
│   │   └── services/
│   │       └── agentClient.js  ← NEW: HTTP client for FastAPI
│   └── Dockerfile
├── agents/                      ← NEW: FastAPI service
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── analyze.py
│   │   │   ├── summarize.py
│   │   │   └── workflow.py
│   │   ├── services/
│   │   │   └── api_client.py   ← HTTP client for Express
│   │   └── db.py               ← Postgres connection
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             React dashboard (unchanged)
├── docker-compose.yml    ← UPDATED: add agents service
└── terraform/
```

### How They Talk (Phase 3a)

**Express calling FastAPI:**
```js
// backend/src/services/agentClient.js
const AGENTS_URL = process.env.AGENTS_URL || "http://agents:8000";

async function analyzeProject(projectId) {
  const res = await fetch(`${AGENTS_URL}/agents/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  return res.json();
}
```

**FastAPI calling Express:**
```python
# agents/app/services/api_client.py
import httpx

API_URL = os.environ.get("API_URL", "http://api:8080")

async def get_project(project_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_URL}/api/projects/{project_id}")
        return response.json()
```

### Docker Compose (Phase 3a)

```yaml
services:
  api:
    build: ./backend
    ports: ["8080:8080"]
    environment:
      - AGENTS_URL=http://agents:8000
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app

  agents:
    build: ./agents
    ports: ["8000:8000"]
    environment:
      - API_URL=http://api:8080
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app

  frontend:
    build: ./frontend
    ports: ["3000:80"]

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Pros & Cons of Phase 3a

| Pros | Cons |
|------|------|
| Dead simple | Synchronous (caller waits) |
| Works immediately | If agents service is down, Express calls fail |
| Easy to debug | Agent tasks can timeout if they take too long |
| No extra infrastructure | No retry/queue for failed tasks |

### When to Move to Phase 3b

Move when any of these happen:
- Agent tasks take > 30 seconds
- You need to retry failed agent tasks
- You need multiple agent workers processing in parallel
- You want fire-and-forget (Express doesn't wait for result)

---

## Phase 3b: Message Queue (When Agents Get Complex)

### What Changes

Add Redis as a message bus between Express and FastAPI. Agent tasks become async.

```
┌──────────────┐  publish   ┌─────────┐  subscribe  ┌──────────────┐
│  Express API  │ ─────────► │  Redis   │ ◄────────── │  FastAPI      │
│  (BFF)        │            │  (queue) │             │  Agent workers│
│               │ ◄───────── │          │             │               │
│               │  callback  │          │             │               │
└──────────────┘            └─────────┘             └──────────────┘
```

### The Flow

```
1. React: "Analyze project 123"
         │
         ▼
2. Express: Publishes task to Redis queue
   Returns: { taskId: "abc", status: "processing" }
         │
         ▼
3. Redis: Holds the task in a queue
         │
         ▼
4. FastAPI worker: Picks up task, runs agent
   (can take 30 seconds, 2 minutes, whatever)
         │
         ▼
5. FastAPI: Posts result back to Express webhook
   POST /api/webhooks/agent-result { taskId: "abc", result: {...} }
         │
         ▼
6. Express: Stores result, notifies frontend via WebSocket or polling
```

### What We Add

```
yourproduct/
├── backend/src/
│   ├── services/
│   │   ├── agentClient.js    → UPDATED: publish to Redis
│   │   └── taskStore.js      ← NEW: track task status
│   └── routes/
│       └── webhooks.js       ← NEW: receive agent results
├── agents/app/
│   ├── worker.py             ← NEW: Redis consumer
│   └── services/
│       └── queue.py          ← NEW: Redis pub/sub
└── docker-compose.yml        ← UPDATED: add Redis
```

### Docker Compose (Phase 3b)

```yaml
services:
  api:
    build: ./backend
    ports: ["8080:8080"]
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app

  agents:
    build: ./agents
    ports: ["8000:8000"]
    environment:
      - REDIS_URL=redis://redis:6379
      - API_URL=http://api:8080
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app

  frontend:
    build: ./frontend
    ports: ["3000:80"]

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

### Pros & Cons of Phase 3b

| Pros | Cons |
|------|------|
| Async (Express doesn't wait) | More infrastructure (Redis) |
| Resilient (queue buffers tasks) | More complex to debug |
| Agents can take any amount of time | Need to handle callbacks/polling |
| Scale workers independently | Frontend needs polling or WebSocket |
| Retry failed tasks automatically | |

### When to Move to Phase 3c

Move when any of these happen:
- You need guaranteed message delivery (Redis can lose messages on crash)
- You need dead letter queues (auto-capture failed tasks for investigation)
- You need message ordering guarantees (FIFO)
- You're running multiple agent worker types that each handle different task types
- You need audit trails / message replay

---

## Phase 3c: Production Queue (SQS / RabbitMQ)

### What Changes

Replace Redis pub/sub with a dedicated message broker. This is the production-grade setup.

```
┌──────────────┐  send     ┌──────────────┐  consume   ┌──────────────┐
│  Express API  │ ────────► │  SQS or      │ ◄───────── │  FastAPI      │
│  (BFF)        │           │  RabbitMQ    │            │  Workers x N  │
│               │           │              │            │               │
│               │           │  ┌────────┐  │            │  auto-scale   │
│               │           │  │ DLQ    │  │            │  per queue    │
│               │           │  │(failed)│  │            │  depth        │
│               │           │  └────────┘  │            │               │
└──────────────┘           └──────────────┘            └──────────────┘
```

### SQS vs RabbitMQ: Which One?

| | AWS SQS | RabbitMQ |
|---|---------|----------|
| **Managed** | Yes (zero ops) | Self-hosted or CloudAMQP |
| **Cost** | ~$0.40 per million messages | Free (self-host) or ~$20/mo (managed) |
| **Dead letter queue** | Built-in | Built-in |
| **FIFO ordering** | Yes (FIFO queues) | Yes |
| **Message retention** | Up to 14 days | Configurable |
| **Best for** | AWS-native, serverless | Multi-cloud, complex routing |
| **Vendor lock-in** | AWS only | Portable (AMQP standard) |

**Recommendation**: Since we're on AWS, use **SQS**. Zero infrastructure to manage, built-in dead letter queues, and it's dirt cheap.

### Architecture (Phase 3c with SQS)

```
┌────────────────────────────────────────────────────────────────┐
│                          AWS                                    │
│                                                                │
│  ┌──────────┐    ┌───────────────┐    ┌────────────────────┐  │
│  │ Express   │    │  SQS Queues   │    │  Fargate Workers   │  │
│  │ (Fargate) │    │               │    │                    │  │
│  │           │───►│ analyze-queue │───►│  analyze-worker    │  │
│  │           │───►│ summary-queue │───►│  summary-worker    │  │
│  │           │───►│ workflow-queue│───►│  workflow-worker   │  │
│  │           │    │               │    │                    │  │
│  │           │    │  ┌─────────┐  │    │  Auto-scales based │  │
│  │           │    │  │  DLQ    │  │    │  on queue depth    │  │
│  │           │    │  │ (retry  │  │    │                    │  │
│  │           │    │  │  3x then│  │    │                    │  │
│  │           │    │  │  alert) │  │    │                    │  │
│  └──────────┘    │  └─────────┘  │    └────────────────────┘  │
│                   └───────────────┘                             │
│                                                                │
│  ┌──────────┐    ┌──────────┐                                  │
│  │   RDS     │    │ CloudWatch│                                 │
│  │ Postgres  │    │ (alerts)  │                                 │
│  └──────────┘    └──────────┘                                  │
└────────────────────────────────────────────────────────────────┘
```

### The Flow (Phase 3c)

```
1. Express receives request from React
         │
         ▼
2. Express sends message to SQS queue
   Returns: { taskId: "abc", status: "queued" }
         │
         ▼
3. SQS holds message (guaranteed delivery, up to 14 days)
         │
         ▼
4. Fargate worker polls SQS, picks up message
   Runs the agent task (any duration)
         │
         ├── Success: writes result to Postgres
         │            notifies Express via webhook or direct DB read
         │
         └── Failure (after 3 retries): message goes to DLQ
                      CloudWatch alarm fires
                      Team gets notified via Slack/email
```

### What Changes from Phase 3b

```
yourproduct/
├── backend/src/
│   ├── services/
│   │   ├── agentClient.js    → UPDATED: send to SQS instead of Redis
│   │   └── taskStore.js      → same (track task status in Postgres)
│   └── routes/
│       └── webhooks.js       → same (receive results)
├── agents/app/
│   ├── worker.py             → UPDATED: poll SQS instead of Redis
│   └── services/
│       └── queue.py          → UPDATED: SQS client (boto3)
├── terraform/
│   ├── sqs.tf               ← NEW: SQS queues + DLQ
│   ├── fargate-workers.tf   ← NEW: auto-scaling worker tasks
│   └── cloudwatch.tf        ← NEW: alarms and dashboards
└── docker-compose.yml        → UPDATED: LocalStack for local SQS
```

### Docker Compose (Phase 3c - Local Dev)

Use LocalStack to simulate SQS locally:

```yaml
services:
  api:
    build: ./backend
    ports: ["8080:8080"]
    environment:
      - SQS_ENDPOINT=http://localstack:4566
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app

  agents:
    build: ./agents
    ports: ["8000:8000"]
    environment:
      - SQS_ENDPOINT=http://localstack:4566
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app

  frontend:
    build: ./frontend
    ports: ["3000:80"]

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

  localstack:
    image: localstack/localstack
    ports: ["4566:4566"]
    environment:
      - SERVICES=sqs

volumes:
  pgdata:
```

### Terraform (Phase 3c)

```hcl
# terraform/sqs.tf

resource "aws_sqs_queue" "agent_tasks" {
  name                       = "agent-tasks"
  visibility_timeout_seconds = 300   # 5 min for agent to finish
  message_retention_seconds  = 86400 # keep messages 1 day
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.agent_tasks_dlq.arn
    maxReceiveCount     = 3  # retry 3 times then DLQ
  })
}

resource "aws_sqs_queue" "agent_tasks_dlq" {
  name = "agent-tasks-dlq"
}

resource "aws_cloudwatch_metric_alarm" "dlq_not_empty" {
  alarm_name  = "agent-tasks-dlq-has-messages"
  namespace   = "AWS/SQS"
  metric_name = "ApproximateNumberOfMessagesVisible"
  dimensions  = { QueueName = aws_sqs_queue.agent_tasks_dlq.name }
  statistic   = "Sum"
  period      = 60
  threshold   = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

### Pros & Cons of Phase 3c

| Pros | Cons |
|------|------|
| Guaranteed message delivery | More AWS infrastructure |
| Built-in dead letter queue | Slightly more latency |
| Auto-scale workers on queue depth | SQS is AWS-only (lock-in) |
| 14-day message retention | Need LocalStack for local dev |
| CloudWatch monitoring built-in | More Terraform to manage |
| Near-zero message cost ($0.40/M) | |

---

## Timeline

| Phase | What | When | Complexity |
|-------|------|------|-----------|
| Phase 2 | AWS + Terraform + CI/CD | Tomorrow | Medium |
| Phase 3a | Add FastAPI + direct HTTP | Next session | Low |
| Phase 3b | Add Redis message queue | When agent tasks > 30s | Medium |
| Phase 3c | SQS + DLQ + auto-scale workers | When going to production | High |

## Evolution Summary

```
Phase 3a          Phase 3b            Phase 3c
─────────         ──────────          ──────────
Express           Express             Express
  │ HTTP            │ publish           │ send
  ▼                 ▼                   ▼
FastAPI           Redis               SQS
                    │ subscribe          │ poll        ┌─────┐
                    ▼                   ▼             │ DLQ │
                  FastAPI             Fargate ──fail──►│     │
                                      Workers x N     └─────┘
                                        │
                                      auto-scale

Simple ──────────────────────────────────────► Production
```

---

## Appendix: Resources & Links

### FastAPI (Python Backend)
- **Official Docs**: https://fastapi.tiangolo.com/
- **Tutorial**: https://fastapi.tiangolo.com/tutorial/
- **Async Support**: https://fastapi.tiangolo.com/async/
- **Docker Deployment**: https://fastapi.tiangolo.com/deployment/docker/

### Redis (Message Queue - Phase 3b)
- **Official Docs**: https://redis.io/docs/
- **Pub/Sub Guide**: https://redis.io/docs/latest/develop/interact/pubsub/
- **BullMQ (Node.js Redis queue)**: https://docs.bullmq.io/
- **Docker Hub**: https://hub.docker.com/_/redis

### AWS SQS (Production Queue - Phase 3c)
- **Developer Guide**: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/
- **Dead Letter Queues**: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- **Boto3 (Python SDK)**: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sqs.html
- **Terraform SQS**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sqs_queue

### RabbitMQ (Alternative to SQS)
- **Official Docs**: https://www.rabbitmq.com/docs
- **Tutorials**: https://www.rabbitmq.com/tutorials
- **CloudAMQP (Managed)**: https://www.cloudamqp.com/
- **Docker Hub**: https://hub.docker.com/_/rabbitmq

### LocalStack (Local AWS for Dev)
- **Official Docs**: https://docs.localstack.cloud/
- **SQS on LocalStack**: https://docs.localstack.cloud/user-guide/aws/sqs/

### BFF Pattern
- **Sam Newman's BFF Article**: https://samnewman.io/patterns/architectural/bff/
- **Microsoft BFF Guide**: https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends
