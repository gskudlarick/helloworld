# AWS Concepts Reference (with Azure Comparisons)

## Table of Contents

- [Acronyms and Definitions](#acronyms-and-definitions)
- [ARN — Amazon Resource Name](#arn--amazon-resource-name)
- [STS — Security Token Service](#sts--security-token-service)
- [OIDC — How GitHub Actions Authenticates to AWS](#oidc--how-github-actions-authenticates-to-aws)
- [IAM Policies vs Azure RBAC](#iam-policies-vs-azure-rbac)
- [AWS vs Azure Concept Map](#aws-vs-azure-concept-map)
- [The Full Auth Chain in This Project](#the-full-auth-chain-in-this-project)

---

## Acronyms and Definitions

| Acronym | Full Name | What It Is |
|---------|-----------|------------|
| **ARN** | Amazon Resource Name | Unique address for any resource in AWS. Like a URL for AWS resources. |
| **STS** | Security Token Service | AWS service that issues temporary credentials. The credential vending machine. |
| **OIDC** | OpenID Connect | An identity protocol. Lets one service prove identity to another without sharing passwords. |
| **IAM** | Identity and Access Management | AWS service for managing users, roles, and permissions. Who can do what. |
| **ECR** | Elastic Container Registry | AWS Docker image storage. Like Docker Hub but private and in your AWS account. |
| **EC2** | Elastic Compute Cloud | Virtual machines in AWS. Our server. |
| **EIP** | Elastic IP | A static public IP address that doesn't change when you reboot an instance. |
| **EBS** | Elastic Block Store | Disk storage attached to EC2. Our 30GB root volume. |
| **VPC** | Virtual Private Cloud | An isolated network in AWS. All resources live inside one. |
| **AMI** | Amazon Machine Image | A snapshot/template for launching EC2 instances. We use Amazon Linux 2023. |
| **RBAC** | Role-Based Access Control | Azure's permission model. Assign roles at scopes. |
| **ACR** | Azure Container Registry | Azure's Docker image storage. Equivalent of ECR. |

---

## ARN — Amazon Resource Name

Every resource in AWS has a unique ARN. It's just an address:

```
arn:aws:iam::908730326561:role/helloworld-poc-github-actions
│   │   │    │              │    │
│   │   │    │              │    └── Resource name
│   │   │    │              └── Resource type
│   │   │    └── Account ID
│   │   └── Service (iam, ec2, s3, ecr, etc.)
│   └── Partition (always "aws" for standard regions)
└── Prefix (always "arn")
```

### ARN Examples from This Project

| Resource | ARN |
|----------|-----|
| GitHub Actions IAM Role | `arn:aws:iam::908730326561:role/helloworld-poc-github-actions` |
| EC2 Instance | `arn:aws:ec2:us-east-1:908730326561:instance/i-0a5a91923d70d7501` |
| ECR Repo (backend) | `arn:aws:ecr:us-east-1:908730326561:repository/helloworld-poc-backend` |
| Security Group | `arn:aws:ec2:us-east-1:908730326561:security-group/sg-03569eed970dca9aa` |

### Azure Equivalent

Azure uses **Resource IDs** instead of ARNs:

```
/subscriptions/xxx/resourceGroups/myGroup/providers/Microsoft.Compute/virtualMachines/myVM
```

Same idea, different format.

---

## STS — Security Token Service

STS is AWS's service that issues **temporary credentials**. You never interact with it directly — other services call it behind the scenes.

### How It Works

```
1. GitHub Actions says: "I'm a workflow from gskudlarick/helloworld"
2. GitHub sends a signed OIDC token to prove it
3. AWS STS verifies the token with GitHub's OIDC provider
4. STS issues temporary credentials:
   - Access Key ID     (temporary)
   - Secret Access Key (temporary)
   - Session Token     (temporary)
   - Expiration        (1 hour)
5. GitHub Actions uses these temp creds to push to ECR
6. Credentials expire automatically — nothing to rotate or revoke
```

### Azure Equivalent

In Azure, **Entra ID** (formerly Azure AD) serves the same purpose. When a Managed Identity or Federated Credential needs a token, Entra ID issues it.

---

## OIDC — How GitHub Actions Authenticates to AWS

OIDC (OpenID Connect) is the protocol that lets GitHub Actions prove its identity to AWS without storing any AWS keys.

### The Old Way (Bad)

```
Store AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in GitHub Secrets
→ Long-lived credentials
→ Never expire
→ If leaked, full access until manually revoked
```

### The OIDC Way (What We Use)

```
Store only the IAM Role ARN in GitHub Secrets
→ GitHub proves identity via signed OIDC token
→ AWS issues temporary credentials (1 hour)
→ Nothing to leak, nothing to rotate
```

### Three Pieces Make OIDC Work

| Piece | What It Is | Who Creates It |
|-------|-----------|---------------|
| OIDC Provider | AWS trusts `token.actions.githubusercontent.com` | Terraform (`iam.tf`) |
| IAM Role | Has ECR push permissions + trust policy | Terraform (`iam.tf`) |
| Trust Policy | "Only allow repo `gskudlarick/helloworld` on branch `main`" | Terraform (`iam.tf`) |

### Azure Equivalent

Azure calls this **Workload Identity Federation**. Same concept:

| Step | AWS | Azure |
|------|-----|-------|
| Register GitHub as trusted | OIDC Provider | Federated Credential on App Registration |
| Create machine identity | IAM Role | Managed Identity or App Registration |
| Scope permissions | IAM Policy on the role | RBAC role assignment on the resource |
| GitHub Action gets creds | `aws-actions/configure-aws-credentials` | `azure/login` |

---

## IAM Policies vs Azure RBAC

### AWS: IAM Policies

Permissions are JSON documents attached to roles. You explicitly list allowed actions and target resources:

```json
{
  "Effect": "Allow",
  "Action": [
    "ecr:BatchGetImage",
    "ecr:GetDownloadUrlForLayer",
    "ecr:BatchCheckLayerAvailability"
  ],
  "Resource": [
    "arn:aws:ecr:us-east-1:908730326561:repository/helloworld-poc-backend",
    "arn:aws:ecr:us-east-1:908730326561:repository/helloworld-poc-frontend"
  ]
}
```

- Very granular — you pick exact API actions
- Verbose — lots of JSON
- Attached directly to roles/users
- Default deny — nothing is allowed unless explicitly permitted

### Azure: RBAC

Permissions are **role assignments** at a **scope**:

```bash
az role assignment create \
  --role "AcrPull" \
  --assignee <managed-identity-id> \
  --scope /subscriptions/xxx/resourceGroups/myGroup/providers/Microsoft.ContainerRegistry/registries/myRegistry
```

- Cleaner — pick a built-in role (Reader, Contributor, AcrPull, etc.)
- Hierarchical — assign at subscription, resource group, or resource level
- Less verbose but less granular
- Custom roles available when built-in roles aren't enough

### Side-by-Side

| Aspect | AWS IAM Policies | Azure RBAC |
|--------|-----------------|------------|
| Format | JSON policy documents | Role assignments at scopes |
| Granularity | Individual API actions (`ecr:PutImage`) | Pre-built roles (`AcrPush`) |
| Inheritance | No hierarchy — explicit per resource | Cascades down (subscription → RG → resource) |
| Default | Deny everything | Deny everything |
| Custom permissions | Write a custom policy JSON | Create a custom role definition |
| Attach to | IAM Roles, Users, Groups | Service Principals, Managed Identities, Users, Groups |
| Wildcards | `"Action": "ecr:*"` | Supported in custom role definitions |

---

## AWS vs Azure Concept Map

| Concept | AWS | Azure |
|---------|-----|-------|
| **Resource ID** | ARN (`arn:aws:ec2:...`) | Resource ID (`/subscriptions/...`) |
| **Temp credentials** | STS (Security Token Service) | Entra ID (Azure AD) |
| **GitHub → cloud auth** | OIDC Federation | Workload Identity Federation |
| **Machine identity (for VMs)** | IAM Instance Profile + Role | System-Assigned Managed Identity |
| **Machine identity (for CI/CD)** | IAM Role + OIDC Provider | App Registration + Federated Credential |
| **Permissions model** | IAM Policies (JSON) | RBAC (role assignments at scopes) |
| **Container registry** | ECR | ACR |
| **Virtual machines** | EC2 | Azure VMs |
| **Static IP** | Elastic IP (EIP) | Public IP (Static allocation) |
| **Virtual network** | VPC | VNet |
| **Firewall rules** | Security Groups | Network Security Groups (NSGs) |
| **Block storage** | EBS | Managed Disks |
| **Managed Kubernetes** | EKS | AKS |
| **Managed containers (serverless)** | Fargate | Container Apps / ACI |
| **Managed database** | RDS | Azure Database (Flexible Server) |
| **DNS** | Route 53 | Azure DNS |
| **SSL/TLS certs** | ACM (Certificate Manager) | App Service Certificates / Key Vault |
| **Secrets management** | Secrets Manager / Parameter Store | Key Vault |
| **Object storage** | S3 | Blob Storage |
| **CDN** | CloudFront | Azure CDN / Front Door |
| **Serverless functions** | Lambda | Azure Functions |
| **CI/CD** | CodePipeline / CodeBuild | Azure DevOps / GitHub Actions |
| **Monitoring** | CloudWatch | Azure Monitor |
| **IaC** | Terraform / CloudFormation | Terraform / Bicep / ARM Templates |
| **Cost management** | Cost Explorer | Cost Management |
| **Resource tagging/grouping** | Resource Groups (tag-based) | Resource Groups (explicit container) |

---

## The Full Auth Chain in This Project

```
GitHub Actions (push to main)
    │
    │  "I'm repo gskudlarick/helloworld, branch main"
    │  Sends signed OIDC token
    │
    ▼
AWS OIDC Provider (Terraform created)
    │  Verifies token with token.actions.githubusercontent.com
    │  Checks trust policy: correct repo? correct branch?
    │
    ▼
AWS STS
    │  Issues temporary credentials (1 hour)
    │  Scoped to IAM Role: helloworld-poc-github-actions
    │
    ▼
IAM Role: helloworld-poc-github-actions
    │  Policy: Can push images to ECR (helloworld-poc-frontend + backend)
    │
    │  → Builds Docker images
    │  → Pushes to ECR ✓
    │
    │  Uses: EC2_SSH_KEY secret (the .pem file)
    │  Connects to: EC2_HOST (54.197.71.91)
    │
    ▼
EC2 Instance
    │  Has IAM Instance Profile: helloworld-poc-ec2
    │  Policy: Can pull images from ECR
    │
    │  → docker compose pull (from ECR) ✓
    │  → docker compose up ✓
    │
    ▼
App is live at http://54.197.71.91:3000
```
