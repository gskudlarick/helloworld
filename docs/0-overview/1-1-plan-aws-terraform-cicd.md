# Phase 2 Plan: AWS Deployment with Terraform & GitHub Actions CI/CD

## Goal

POC a complete CI/CD pipeline that deploys our full-stack app to AWS. Build a reusable template we can apply to real SaaS products later.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                           │
│                                                                 │
│  Push to main → Run tests → Build Docker → Deploy to EC2       │
│                                    │                            │
│                              OIDC (no stored secrets)           │
└────────────────────────────────────┼────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS (Terraform-managed)                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              EC2 (t4g.small ~$8/mo)                    │     │
│  │                                                        │     │
│  │   Docker Compose                                       │     │
│  │   ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │     │
│  │   │  Frontend   │ │  Backend   │ │    Postgres      │  │     │
│  │   │  nginx :80  │ │  :8080     │ │    :5432         │  │     │
│  │   │  React      │ │  Express   │ │    states table  │  │     │
│  │   └────────────┘ └────────────┘ └──────────────────┘  │     │
│  │         :3000                                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                         │                                       │
│                    Public IP / DNS                               │
│                  http://<ec2-ip>:3000                            │
└─────────────────────────────────────────────────────────────────┘

Future upgrade path (when ready for production):
┌──────────┐     ┌──────────┐     ┌──────────┐
│  ALB     │ ──> │ Fargate  │ ──> │   RDS    │
│  + HTTPS │     │ (auto-   │     │ Postgres │
│  + domain│     │  scale)  │     │ (managed)│
└──────────┘     └──────────┘     └──────────┘
```

## Pre-Session Checklist (run on your Mac before we start)

### 1. Verify AWS CLI works

```bash
# Check your identity
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDA...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-username"
# }
```

### 2. Check your AWS region

```bash
# See your configured region
aws configure get region

# If blank, set it:
aws configure set region us-east-1
```

### 3. Verify Terraform is installed

```bash
terraform --version

# If not installed:
brew install terraform
```

### 4. Verify Docker is running

```bash
docker info | head -5
```

### 5. Note your GitHub repo URL

```bash
# From the helloworld directory
git remote get-url origin
```

### 6. Check your AWS permissions

```bash
# Quick test - can you create resources?
aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text

# If this returns a VPC ID, you're good
```

## Implementation Steps

### Step 1: Add Postgres to the App

- Add `pg` (node-postgres) to backend
- Create a `states` table: id, name, abbreviation, capital
- Seed with US states data
- New endpoints:
  - `GET /api/states` — list all states
  - `GET /api/states/:id` — get one state
  - `GET /api/states?search=` — search by name
- Update Docker Compose with Postgres service
- Add database migration/seed script
- Tests for new endpoints

### Step 2: Terraform AWS Infrastructure

```
terraform/
├── main.tf              # Provider, backend config
├── variables.tf         # Configurable inputs
├── outputs.tf           # Public IP, URLs
├── ec2.tf               # EC2 instance + security group
├── iam.tf               # IAM role for EC2 + OIDC for GitHub
├── ecr.tf               # Container registry
└── terraform.tfvars     # Your specific values (gitignored)
```

What Terraform creates:
- **VPC** (or use default) + security group (ports 22, 80, 3000, 8080)
- **ECR** repositories for frontend + backend images
- **EC2** t4g.small with Docker + Docker Compose pre-installed
- **IAM role** with OIDC trust for GitHub Actions (no stored secrets)
- **Elastic IP** so the public URL doesn't change on reboot

Estimated cost: **~$8-12/mo**

### Step 3: GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
# Triggered on push to main

Pipeline:
  1. Run backend tests (Jest)
  2. Run frontend tests (Vitest)
  3. Run API tests (Newman)
  4. Build Docker images
  5. Push to ECR
  6. SSH into EC2 → docker compose pull → docker compose up
```

Authentication: **OIDC federation** (GitHub ↔ AWS)
- No AWS access keys stored in GitHub Secrets
- Temporary credentials auto-expire
- More secure than long-lived keys

### Step 4: Verify & Test

- Push a code change to main
- Watch GitHub Actions run
- Hit the public URL
- Confirm the full loop works

## Scaling Up Later

When this POC becomes a real product, the upgrade path is straightforward:

| Component | POC (Day 1) | Production (Later) | Change needed |
|-----------|-------------|---------------------|---------------|
| Compute | EC2 + Docker Compose | ECS Fargate | New Terraform module |
| Database | Postgres in Docker | RDS Postgres | New Terraform module + connection string |
| Load balancer | None (direct IP) | ALB + HTTPS | New Terraform module |
| Domain | EC2 public IP | Route53 + ACM cert | New Terraform module |
| Scaling | Manual | Auto-scaling | Fargate config |
| Cost | ~$8-12/mo | ~$30-50/mo | Gradual |

The key: **Terraform modules are swappable**. The app code doesn't change — only the infrastructure definition does.

## Files We'll Create

```
helloworld/
├── backend/
│   ├── src/
│   │   ├── db.js                  # Postgres connection
│   │   ├── routes/states.js       # State endpoints
│   │   └── seed.js                # Seed US states data
│   └── src/__tests__/
│       └── states.test.js         # State endpoint tests
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── ec2.tf
│   ├── iam.tf
│   └── ecr.tf
├── .github/
│   └── workflows/
│       └── deploy.yml             # CI/CD pipeline
├── docker-compose.yml             # Updated with Postgres
└── docker-compose.prod.yml        # Production overrides
```

## Session Plan

```
1. Add Postgres + states endpoints + tests     (~20 min)
2. Update Docker Compose with Postgres          (~5 min)
3. Write Terraform config                       (~15 min)
4. Write GitHub Actions workflow                 (~10 min)
5. Test locally with Docker Compose              (~5 min)
6. Push and verify                               (~5 min)
```

Then on your Mac:
```bash
cd terraform
terraform init
terraform plan        # Preview what will be created
terraform apply       # Create the infrastructure
# Push to main → GitHub Actions deploys automatically
```
