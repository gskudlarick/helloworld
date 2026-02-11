# Architecture Analysis: EC2 + Docker Compose for SaaS POC

## Table of Contents

- [Overview](#overview)
- [Why EC2 + Docker Compose for POC/PMF](#why-ec2--docker-compose-for-pocpmf)
- [Architecture Pattern](#architecture-pattern)
- [Migration Path to Production](#migration-path-to-production)
  - [Key Design Principles](#key-design-principles)
  - [What Changes vs What Stays](#what-changes-vs-what-stays)
- [Scaling Trigger Points](#scaling-trigger-points)
- [Risk: Postgres in Docker](#risk-postgres-in-docker)
- [Deploy Pattern Trade-off](#deploy-pattern-trade-off)
- [Cost Comparison](#cost-comparison)
- [Reusability as a SaaS Template](#reusability-as-a-saas-template)
- [Decision Summary](#decision-summary)

---

## Overview

This document captures the architectural analysis behind choosing **EC2 + Docker Compose** as the deployment pattern for SaaS proof-of-concept apps, with an intentional upgrade path to ECS Fargate + RDS when product-market fit is validated.

The goal: a repeatable, low-cost deployment template that can be forked for each new SaaS idea, with a clean migration path when one takes off.

## Why EC2 + Docker Compose for POC/PMF

| Factor | Benefit |
|--------|---------|
| **Cost** | ~$8-12/mo vs $30-50+ for Fargate+RDS. Across multiple SaaS experiments, this adds up. |
| **Speed** | Idea to deployed app in an afternoon. No ECS task definitions, no RDS provisioning, no ALB config. |
| **Simplicity** | One EC2 instance, one `docker-compose.yml`, SSH deploy. Easy to debug and reason about. |
| **Sufficient scale** | A `t4g.small` handles dozens to low hundreds of concurrent users — more than enough for demos, early users, and PMF testing. |
| **Containerized from day one** | The Docker images you build for EC2 are the same images that run on Fargate later. |

## Architecture Pattern

```
GitHub Actions (CI/CD)
  Push to main -> Test -> Build Docker images -> Push to ECR -> SSH deploy to EC2

AWS (Terraform-managed)
  EC2 (t4g.small ~$8/mo)
    Docker Compose
      Frontend  (React/nginx :80)
      Backend   (Express :8080)
      Postgres  (:5432)
    Exposed via Public IP / Elastic IP
```

Single instance, all services co-located. No load balancer, no managed database, no auto-scaling. Intentionally minimal.

## Migration Path to Production

### Key Design Principles

Two things make the migration clean:

**1. 12-factor configuration via environment variables**

```
# POC: Postgres in Docker on the same EC2 instance
DATABASE_URL=postgres://user:pass@db:5432/app

# Production: RDS managed Postgres (just change the connection string)
DATABASE_URL=postgres://user:pass@rds-endpoint:5432/app
```

The application code does not change. The only change is the value of an environment variable.

**2. Docker images are the migration artifact**

- EC2 + Docker Compose: images pulled from ECR, run via `docker compose up`
- ECS Fargate: **same images** from ECR, orchestrated by AWS instead of Docker Compose
- The application has no awareness of what is running the container

### What Changes vs What Stays

| Layer | POC | Production | What changes |
|-------|-----|------------|--------------|
| **App code** | Express + React | Express + React | Nothing |
| **Docker images** | Built in CI, pushed to ECR | Built in CI, pushed to ECR | Nothing |
| **Database** | Postgres in Docker | RDS Postgres | Connection string (env var) |
| **Compute** | EC2 + Docker Compose | ECS Fargate | Terraform modules |
| **Networking** | Elastic IP, direct access | ALB + HTTPS + Route53 | Terraform modules |
| **CI/CD deploy step** | SSH into EC2, `docker compose pull/up` | `aws ecs update-service` | GitHub Actions workflow |
| **Scaling** | Manual (single instance) | Auto-scaling (Fargate) | Terraform config |

The migration is purely infrastructure. App code and Docker images are untouched.

## Scaling Trigger Points

These are the signals that tell you when to upgrade each component:

| Signal | Action | Effort |
|--------|--------|--------|
| Real users sign up, you need data durability | Break out Postgres to **RDS** | Swap Terraform module + change `DATABASE_URL` |
| You need HTTPS and a custom domain | Add **ALB + ACM cert + Route53** | New Terraform modules |
| You need uptime guarantees / auto-scaling | Move compute to **ECS Fargate** | Swap Terraform module + update CI/CD deploy step |
| You're still just testing ideas | Stay on EC2 + Docker Compose | Nothing |

**Do these incrementally, not all at once.** RDS first, then ALB/HTTPS, then Fargate.

## Risk: Postgres in Docker

The single biggest risk in this pattern is running Postgres in a Docker container on EC2 with no automated backups.

- If the EC2 instance terminates, the data is gone
- Docker volumes persist across container restarts but not instance termination
- EBS volumes can help, but it's still a manual backup story

**Mitigation for POC:** This is acceptable. You're testing ideas, not running production. Seed scripts mean you can recreate data.

**First upgrade when PMF is found:** Move to RDS. This is just a connection string change and a new Terraform module.

## Deploy Pattern Trade-off

The SSH-based deploy (`ssh into EC2 -> docker compose pull -> docker compose up`) is the "scrappy" piece of this architecture. It works well for POC but is the part that does not carry over to Fargate.

| Deploy Method | Used In | Mechanism |
|---------------|---------|-----------|
| SSH + Docker Compose | EC2 (POC) | GitHub Actions SSHs into EC2, pulls new images, restarts services |
| ECS Service Update | Fargate (Production) | GitHub Actions calls `aws ecs update-service`, Fargate handles the rest |

This is a small workflow file change — not an architectural concern.

## Cost Comparison

| Setup | Monthly Cost | Use Case |
|-------|-------------|----------|
| EC2 `t4g.small` + Docker Compose | ~$8-12 | POC, demos, PMF testing |
| EC2 + RDS `db.t4g.micro` | ~$25-30 | PMF validated, need data durability |
| Fargate + RDS + ALB | ~$30-50 | Production, auto-scaling, HTTPS |
| Fargate + RDS + ALB + Route53 + CloudWatch | ~$50-80 | Full production stack |

Start at the top. Move down only when the product demands it.

## Reusability as a SaaS Template

This is the real value of getting this pattern right:

1. **Template the Terraform** — parameterize project name, region, instance size
2. **Template the GitHub Actions workflow** — same pipeline, different ECR repo
3. **Template the Docker Compose** — same structure, different app services
4. **Fork, rename, deploy** — new SaaS idea goes from zero to deployed in under an hour

Each new project gets its own:
- ECR repositories
- EC2 instance
- Terraform state
- GitHub Actions workflow
- Independent scaling decisions

## Decision Summary

| Question | Answer |
|----------|--------|
| Is this a good starter pattern? | Yes. Low cost, fast iteration, sufficient scale for POC/PMF. |
| Will it scale for demos and early users? | Yes. Single `t4g.small` handles hundreds of concurrent users. |
| Is the migration path to production clean? | Yes, if you keep config in env vars and stay containerized. App code doesn't change. |
| What's the biggest risk? | Postgres in Docker. Upgrade to RDS first when PMF is found. |
| Can this be reused across SaaS projects? | Yes. Template Terraform + Docker Compose + GitHub Actions. Fork per project. |
