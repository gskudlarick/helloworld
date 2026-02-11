# High-Level Plan: AWS Deployment with Terraform & GitHub Actions CI/CD

## Table of Contents

- [AWS Services and Prerequisites](#aws-services-and-prerequisites)
  - [Security](#security)
  - [Compute and Infrastructure](#compute-and-infrastructure)
  - [CI/CD](#cicd)
- [Pre-Flight Setup](#pre-flight-setup)
  - [1. Verify Local Tools](#1-verify-local-tools)
  - [2. Verify AWS Identity and Permissions](#2-verify-aws-identity-and-permissions)
  - [3. Create ECR Repositories](#3-create-ecr-repositories)
  - [4. Create EC2 Key Pair](#4-create-ec2-key-pair)
  - [5. Set Up OIDC Provider for GitHub Actions](#5-set-up-oidc-provider-for-github-actions)
- [Implementation Steps](#implementation-steps)
  - [Step 1: Add Postgres and States API](#step-1-add-postgres-and-states-api)
  - [Step 2: Update Docker Compose for Postgres](#step-2-update-docker-compose-for-postgres)
  - [Step 3: Write Terraform Configuration](#step-3-write-terraform-configuration)
  - [Step 4: Write GitHub Actions Workflow](#step-4-write-github-actions-workflow)
  - [Step 5: Deploy and Verify](#step-5-deploy-and-verify)
- [File Map](#file-map)
- [Estimated Cost](#estimated-cost)

---

## AWS Services and Prerequisites

Everything below is either created by Terraform or set up once via the AWS CLI before we start.

### Security

| AWS Service | Purpose | Setup Method | Notes |
|-------------|---------|--------------|-------|
| **IAM User** | Your AWS CLI identity | Already exists | Must have programmatic access |
| **IAM Role** (GitHub OIDC) | GitHub Actions assumes this role to deploy | Terraform | No long-lived AWS keys stored in GitHub |
| **IAM OIDC Provider** | Trust relationship between GitHub and AWS | Terraform (or CLI one-time) | Allows GitHub Actions to get temporary creds |
| **IAM Instance Profile** | EC2 permission to pull from ECR | Terraform | Attached to the EC2 instance |
| **EC2 Key Pair** | SSH access to EC2 for deploys + debugging | AWS CLI (one-time) | Private key stored locally, never committed |
| **Security Group** | Firewall rules for EC2 | Terraform | Ports: 22 (SSH), 80 (HTTP), 3000, 8080 |

### Compute and Infrastructure

| AWS Service | Purpose | Setup Method | Notes |
|-------------|---------|--------------|-------|
| **EC2** (`t4g.small`) | Runs Docker Compose (frontend + backend + Postgres) | Terraform | ARM-based, ~$8/mo |
| **Elastic IP** | Static public IP that survives reboots | Terraform | Associated with the EC2 instance |
| **ECR** (Elastic Container Registry) | Stores Docker images for frontend + backend | Terraform (or CLI) | GitHub Actions pushes images here |
| **Default VPC** | Network for the EC2 instance | Already exists | Using default VPC to keep it simple |
| **EBS Volume** | EC2 root disk (Postgres data lives here) | Terraform | 20GB gp3, included in instance |

### CI/CD

| Service | Purpose | Setup Method | Notes |
|---------|---------|--------------|-------|
| **GitHub Actions** | CI/CD pipeline — test, build, push, deploy | `.github/workflows/deploy.yml` | Triggered on push to `main` |
| **GitHub OIDC → AWS** | Auth GitHub Actions to AWS without stored secrets | Terraform (IAM side) + workflow config | Uses `aws-actions/configure-aws-credentials` |
| **ECR** (push target) | GitHub Actions pushes built images here | Terraform | Frontend + backend repos |
| **SSH Deploy** | GitHub Actions SSHs into EC2 to pull + restart | GitHub Actions + EC2 key pair | The "scrappy" part — replaced by ECS later |

---

## Pre-Flight Setup

Run these on your Mac before we start building. Each step includes the AWS CLI command so you can verify or create what's needed.

### 1. Verify Local Tools

```bash
# AWS CLI
aws --version
# Expected: aws-cli/2.x.x

# Terraform
terraform --version
# Expected: Terraform v1.x.x
# Install if missing: brew install terraform

# Docker
docker info | head -3
# Should show "Server: Docker Desktop"

# GitHub CLI (optional but handy)
gh --version
```

### 2. Verify AWS Identity and Permissions

```bash
# Who am I?
aws sts get-caller-identity

# What region am I in?
aws configure get region
# If blank: aws configure set region us-east-1

# Can I create resources? Quick smoke test:
aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text
# Should return a VPC ID like vpc-xxxxxxxx
```

**Required IAM permissions** (your IAM user needs these):

| Permission | Why |
|------------|-----|
| `ec2:*` | Create/manage EC2 instances, security groups, key pairs, Elastic IPs |
| `ecr:*` | Create/manage container registries |
| `iam:*` | Create roles, policies, OIDC providers, instance profiles |
| `sts:GetCallerIdentity` | Verify your identity |

If you're using an admin user, you have all of these. For a scoped-down user, these are the minimum.

### 3. Create ECR Repositories

Terraform will handle this, but if you want to verify ECR access now:

```bash
# Test ECR access
aws ecr describe-repositories --query 'repositories[].repositoryName' --output table

# These will be created by Terraform:
#   helloworld-frontend
#   helloworld-backend
```

### 4. Create EC2 Key Pair

This is the one thing to do manually before Terraform runs — you need the private key locally.

```bash
# Create the key pair and save the private key
aws ec2 create-key-pair \
  --key-name helloworld-deploy \
  --key-type ed25519 \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/helloworld-deploy.pem

# Lock down permissions
chmod 400 ~/.ssh/helloworld-deploy.pem

# Verify it exists in AWS
aws ec2 describe-key-pairs --key-names helloworld-deploy --query 'KeyPairs[0].KeyName' --output text
# Expected: helloworld-deploy
```

### 5. Set Up OIDC Provider for GitHub Actions

Terraform will create this, but here's what it does under the hood:

```bash
# This is what Terraform creates — you don't need to run this manually.
# Shown here so you understand what's happening.

# Creates a trust relationship:
#   "GitHub Actions running on repo gskudlarick/helloworld
#    on the main branch can assume an IAM role in my AWS account"

# The OIDC provider thumbprint for GitHub:
# token.actions.githubusercontent.com
```

No GitHub Secrets needed. No AWS access keys stored anywhere. OIDC handles it all.

---

## Implementation Steps

### Step 1: Add Postgres and States API

Update the backend with a real database and new endpoints.

| Task | Detail |
|------|--------|
| Add `pg` dependency | `npm install pg` in backend |
| Create `db.js` | Postgres connection pool using `DATABASE_URL` env var |
| Create `routes/states.js` | `GET /api/states`, `GET /api/states/:id`, `GET /api/states?search=` |
| Create `seed.js` | Insert US states data (name, abbreviation, capital) |
| Add tests | Jest tests for the new endpoints |

### Step 2: Update Docker Compose for Postgres

| Task | Detail |
|------|--------|
| Add `postgres` service | Postgres 16, exposed on 5432, volume for data |
| Add `DATABASE_URL` env var | Pass to backend service |
| Add `depends_on` | Backend waits for Postgres |
| Create `docker-compose.prod.yml` | Production overrides (no bind mounts, ECR image refs) |
| Test locally | `docker compose up` — verify full stack works |

### Step 3: Write Terraform Configuration

| File | Purpose |
|------|---------|
| `terraform/main.tf` | AWS provider, backend config (local state for POC) |
| `terraform/variables.tf` | Inputs: region, instance type, key pair name, GitHub repo |
| `terraform/outputs.tf` | Outputs: public IP, ECR URLs, SSH command |
| `terraform/ec2.tf` | EC2 instance + security group + Elastic IP + user data (install Docker) |
| `terraform/iam.tf` | IAM role for EC2 (ECR pull) + OIDC provider + GitHub Actions role |
| `terraform/ecr.tf` | ECR repositories for frontend + backend |
| `terraform/terraform.tfvars` | Your values (gitignored) |

```bash
# Deploy infrastructure
cd terraform
terraform init
terraform plan        # Preview
terraform apply       # Create everything
```

### Step 4: Write GitHub Actions Workflow

| Stage | What Happens |
|-------|-------------|
| **Test** | Run Jest (backend), Vitest (frontend), Newman (API) in parallel |
| **Build** | Build frontend + backend Docker images |
| **Push** | Authenticate to ECR via OIDC, push images |
| **Deploy** | SSH into EC2, `docker compose pull`, `docker compose up -d` |

File: `.github/workflows/deploy.yml`
Trigger: Push to `main`
Auth: OIDC (no stored secrets)

### Step 5: Deploy and Verify

| Task | Detail |
|------|--------|
| Push to `main` | Triggers the GitHub Actions pipeline |
| Monitor Actions | Watch the workflow run in the GitHub Actions tab |
| Hit the public URL | `http://<elastic-ip>:3000` — should load the app |
| Test the API | `curl http://<elastic-ip>:8080/api/states` — should return states |
| SSH and inspect | `ssh -i ~/.ssh/helloworld-deploy.pem ec2-user@<elastic-ip>` |

---

## File Map

Files we'll create or modify, organized by step:

```
helloworld/
├── backend/
│   ├── src/
│   │   ├── db.js                        # [Step 1] Postgres connection
│   │   ├── routes/states.js             # [Step 1] States endpoints
│   │   └── seed.js                      # [Step 1] Seed US states data
│   └── src/__tests__/
│       └── states.test.js               # [Step 1] States endpoint tests
├── terraform/
│   ├── main.tf                          # [Step 3] Provider config
│   ├── variables.tf                     # [Step 3] Input variables
│   ├── outputs.tf                       # [Step 3] Outputs (IP, URLs)
│   ├── ec2.tf                           # [Step 3] EC2 + security group
│   ├── iam.tf                           # [Step 3] IAM + OIDC
│   ├── ecr.tf                           # [Step 3] Container registry
│   └── terraform.tfvars                 # [Step 3] Your values (gitignored)
├── .github/
│   └── workflows/
│       └── deploy.yml                   # [Step 4] CI/CD pipeline
├── docker-compose.yml                   # [Step 2] Updated with Postgres
└── docker-compose.prod.yml              # [Step 2] Production overrides
```

---

## Estimated Cost

| Resource | Monthly Cost |
|----------|-------------|
| EC2 `t4g.small` (on-demand) | ~$8 |
| Elastic IP (while attached) | $0 |
| ECR (storage, minimal images) | ~$1 |
| Data transfer (minimal for POC) | ~$1 |
| **Total** | **~$10/mo** |

GitHub Actions: Free for public repos, 2,000 min/mo for private repos on the free tier.
