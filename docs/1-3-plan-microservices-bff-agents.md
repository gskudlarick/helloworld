# Phase 3 Plan: Microservices, BFF Pattern & Python Agents

## Goal

Add a FastAPI Python microservice for AI/agentic workflows alongside the existing Express API. Establish the BFF (Backend for Frontend) pattern and inter-service communication.

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

---

## Timeline

| Phase | What | When |
|-------|------|------|
| Phase 2 | AWS + Terraform + CI/CD | Tomorrow |
| Phase 3a | Add FastAPI + direct HTTP | Next session |
| Phase 3b | Add Redis message queue | When agent tasks get complex |

## Future Scale (Phase 4+)

```
Phase 3b with Redis
        │
        ▼ swap Redis pub/sub for proper queue
AWS SQS / RabbitMQ
        │
        ▼ multiple workers
Fargate tasks (auto-scale agent workers)
        │
        ▼ dead letter queue
Failed tasks auto-retry, then alert
```
