# Terraform Basics Reference

## Table of Contents

- [CLI Workflow](#cli-workflow)
- [Project File Structure](#project-file-structure)
- [Core Constructs](#core-constructs)
- [Variable Types](#variable-types)
- [State Management](#state-management)
- [Common Patterns](#common-patterns)

---

## CLI Workflow

The commands we used to set up, validate, and run Terraform in this project:

### Setup

| Step | Command | What It Does |
|------|---------|-------------|
| 1 | `brew install terraform` | Install Terraform via Homebrew |
| 2 | `terraform --version` | Verify installation |
| 3 | `aws configure set region us-east-1 --profile serverless-admin` | Set AWS region for the profile Terraform will use |
| 4 | `aws sts get-caller-identity --profile serverless-admin` | Verify AWS identity and access |

### Init & Validate

| Step | Command | What It Does |
|------|---------|-------------|
| 5 | `cd terraform/` | Navigate to the Terraform directory |
| 6 | `terraform init` | Downloads provider plugins (AWS), creates `.terraform/` directory and lock file |
| 7 | `terraform validate` | Checks syntax and internal consistency — no AWS calls, just config validation |
| 8 | `terraform fmt` | Auto-formats all `.tf` files to canonical style |

### Plan & Apply

| Step | Command | What It Does |
|------|---------|-------------|
| 9 | `terraform plan` | Dry run — shows what will be created/changed/destroyed. No changes made. |
| 10 | `terraform apply` | Runs the plan and prompts for confirmation. Creates real resources. |
| 11 | `terraform apply -auto-approve` | Same as apply but skips the confirmation prompt |
| 12 | `terraform output` | Shows all output values (IPs, URLs, ARNs) after apply |
| 13 | `terraform output public_ip` | Shows a single output value |

### Inspect & Debug

| Step | Command | What It Does |
|------|---------|-------------|
| 14 | `terraform show` | Shows the full current state (all resources and their attributes) |
| 15 | `terraform state list` | Lists all resources Terraform is tracking |
| 16 | `terraform state show aws_instance.app` | Shows details of a specific resource |
| 17 | `terraform plan -target=aws_instance.app` | Plan for a single resource only |

### Teardown

| Step | Command | What It Does |
|------|---------|-------------|
| 18 | `terraform destroy` | Destroys all resources Terraform created. Prompts for confirmation. |
| 19 | `terraform destroy -target=aws_instance.app` | Destroy a single resource only |

---

## Project File Structure

```
terraform/
├── main.tf              # Provider config (AWS region, profile, default tags)
│                        #   "Who am I connecting to and how?"
│
├── variables.tf         # Input variables (region, instance type, key pair, etc.)
│                        #   "What can be customized?"
│
├── terraform.tfvars     # Actual values for variables (gitignored)
│                        #   "What ARE the custom values?"
│
├── ec2.tf               # EC2 instance, security group, Elastic IP, user data
│                        #   "The server and its firewall rules"
│
├── iam.tf               # IAM roles, policies, OIDC provider, instance profile
│                        #   "Who can do what (permissions)"
│
├── ecr.tf               # ECR repositories + lifecycle policies
│                        #   "Where Docker images are stored"
│
├── outputs.tf           # Output values (IP, URLs, ARNs) shown after apply
│                        #   "What do I need to know after deploy?"
│
├── .gitignore           # Ignores .terraform/, *.tfstate, *.tfvars
│
├── .terraform/          # (auto-generated) Downloaded provider plugins
│
├── .terraform.lock.hcl  # (auto-generated) Locked provider versions
│
├── terraform.tfstate    # (auto-generated) Current state of all resources
│                        #   THE source of truth — Terraform compares this
│                        #   to your .tf files to decide what to change
│
└── terraform.tfstate.backup  # (auto-generated) Previous state backup
```

**Key insight:** Terraform reads ALL `.tf` files in the directory as one configuration. File names are just for human organization — `ec2.tf`, `iam.tf`, etc. could all be in one big `main.tf` and it would work the same way.

---

## Core Constructs

| Construct | Keyword | Purpose | Example |
|-----------|---------|---------|---------|
| **Provider** | `provider` | Configures the cloud platform connection (AWS, GCP, etc.) | `provider "aws" { region = "us-east-1" }` |
| **Resource** | `resource` | Creates a real cloud resource | `resource "aws_instance" "app" { ... }` |
| **Data Source** | `data` | Reads existing info from AWS (doesn't create anything) | `data "aws_ami" "amazon_linux" { ... }` |
| **Variable** | `variable` | Declares an input parameter | `variable "region" { default = "us-east-1" }` |
| **Output** | `output` | Exposes a value after apply (like a return value) | `output "ip" { value = aws_eip.app.public_ip }` |
| **Locals** | `locals` | Internal computed values (like const variables) | `locals { app_name = "${var.project}-app" }` |
| **Module** | `module` | Reusable group of resources (like a function) | `module "vpc" { source = "./modules/vpc" }` |
| **Terraform** | `terraform` | Top-level config (required version, backend, providers) | `terraform { required_version = ">= 1.0" }` |

### How They Relate

```
terraform { }          ← Version constraints, backend (where state is stored)
    │
provider "aws" { }     ← Connect to AWS with region + profile
    │
variable "x" { }       ← Inputs (customizable knobs)
locals { }              ← Computed values from variables
    │
    ├── resource "aws_instance" "app" { }   ← Creates things
    ├── resource "aws_security_group" { }   ← Creates things
    │
    ├── data "aws_ami" { }                  ← Reads existing things
    │
    └── output "ip" { }                     ← Exposes values after apply
```

### Naming Convention

Resources follow the pattern: `resource "type" "name"`

```hcl
resource "aws_instance" "app" { ... }
#         ^^^^^^^^^^^    ^^^
#         AWS resource   Your local name
#         type           (used to reference it)

# Reference it elsewhere as:
aws_instance.app.id
aws_instance.app.public_ip
```

---

## Variable Types

| Type | Syntax | Example Value |
|------|--------|---------------|
| `string` | `variable "region" { type = string }` | `"us-east-1"` |
| `number` | `variable "port" { type = number }` | `8080` |
| `bool` | `variable "enable" { type = bool }` | `true` |
| `list` | `variable "ports" { type = list(number) }` | `[80, 443, 8080]` |
| `map` | `variable "tags" { type = map(string) }` | `{ Name = "app", Env = "poc" }` |

### Where Variables Get Their Values (Priority Order)

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | CLI flag | `terraform apply -var="region=us-west-2"` |
| 2 | `terraform.tfvars` file | `region = "us-west-2"` |
| 3 | Environment variable | `export TF_VAR_region=us-west-2` |
| 4 (lowest) | `default` in variable block | `variable "region" { default = "us-east-1" }` |

---

## State Management

Terraform state (`terraform.tfstate`) is the single most important concept:

| Concept | Description |
|---------|-------------|
| **What is state?** | A JSON file mapping your `.tf` config to real AWS resource IDs |
| **Why does it matter?** | Terraform compares state to your config to know what to create, update, or delete |
| **Local state** (our POC) | State file lives on your machine in the `terraform/` directory |
| **Remote state** (production) | State stored in S3 + DynamoDB for team collaboration and locking |
| **State lock** | Prevents two people from running `terraform apply` at the same time |
| **Don't edit state manually** | Use `terraform state mv`, `terraform state rm`, `terraform import` |

### POC vs Production State

```hcl
# POC (what we're using) — state lives locally
terraform {
  # no backend block = local state file
}

# Production — state lives in S3
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "helloworld-poc/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
  }
}
```

---

## Common Patterns

### Reference Another Resource

```hcl
# Security group
resource "aws_security_group" "app" {
  name = "my-sg"
}

# EC2 references the security group
resource "aws_instance" "app" {
  vpc_security_group_ids = [aws_security_group.app.id]
  #                         ^^^^^^^^^^^^^^^^^^^^^^^^
  #                         type.name.attribute
}
```

### String Interpolation

```hcl
variable "project_name" { default = "helloworld-poc" }

resource "aws_ecr_repository" "backend" {
  name = "${var.project_name}-backend"
  #       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  #       Result: "helloworld-poc-backend"
}
```

### Default Tags (Tag Everything Automatically)

```hcl
provider "aws" {
  default_tags {
    tags = {
      Project     = "helloworld-poc"
      Environment = "poc"
      ManagedBy   = "terraform"
    }
  }
}
# Now EVERY resource gets these tags without adding them individually
```

### Conditional Logic

```hcl
# Create a resource only if a variable is true
resource "aws_eip" "app" {
  count    = var.create_eip ? 1 : 0
  instance = aws_instance.app.id
}
```
