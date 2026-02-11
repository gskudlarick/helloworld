# AWS Configuration — helloworld-poc

## Quick Reference

| Key | Value |
|-----|-------|
| **AWS Account** | `908730326561` |
| **Region** | `us-east-1` |
| **AWS Profile** | `serverless-admin` |
| **Project Tag** | `Project = helloworld-poc` |
| **Public IP** | `54.197.71.91` |
| **Frontend URL** | `http://54.197.71.91:3000` |
| **API URL** | `http://54.197.71.91:8080` |
| **SSH Command** | `ssh -i ~/.ssh/gregdev.pem ec2-user@54.197.71.91` |

## Terraform Resources (13)

| # | Resource | Type | Name / ID |
|---|----------|------|-----------|
| 1 | EC2 Instance | `aws_instance.app` | `i-0a5a91923d70d7501` — t4g.small, AL2023 ARM |
| 2 | Elastic IP | `aws_eip.app` | `54.197.71.91` |
| 3 | Security Group | `aws_security_group.app` | `sg-03569eed970dca9aa` — ports 22, 80, 3000, 8080 |
| 4 | ECR Repo (frontend) | `aws_ecr_repository.frontend` | `helloworld-poc-frontend` |
| 5 | ECR Repo (backend) | `aws_ecr_repository.backend` | `helloworld-poc-backend` |
| 6 | ECR Lifecycle (frontend) | `aws_ecr_lifecycle_policy.frontend` | Keep last 5 images |
| 7 | ECR Lifecycle (backend) | `aws_ecr_lifecycle_policy.backend` | Keep last 5 images |
| 8 | OIDC Provider | `aws_iam_openid_connect_provider.github` | GitHub Actions trust |
| 9 | IAM Role (GitHub) | `aws_iam_role.github_actions` | `helloworld-poc-github-actions` — ECR push |
| 10 | IAM Policy (GitHub) | `aws_iam_role_policy.github_actions_ecr` | `helloworld-poc-ecr-push` |
| 11 | IAM Role (EC2) | `aws_iam_role.ec2` | `helloworld-poc-ec2` — ECR pull |
| 12 | IAM Policy (EC2) | `aws_iam_role_policy.ec2_ecr_pull` | `helloworld-poc-ecr-pull` |
| 13 | Instance Profile | `aws_iam_instance_profile.ec2` | `helloworld-poc-ec2` |

## GitHub Secrets Needed

Set these in GitHub repo Settings → Secrets and variables → Actions:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `AWS_ROLE_ARN` | `arn:aws:iam::908730326561:role/helloworld-poc-github-actions` | `terraform output github_actions_role_arn` |
| `AWS_ACCOUNT_ID` | `908730326561` | `terraform output aws_account_id` |
| `EC2_HOST` | `54.197.71.91` | `terraform output public_ip` |
| `EC2_SSH_KEY` | Contents of `~/.ssh/gregdev.pem` | Your local key file |

## Useful Terraform Commands

```bash
# List all resources Terraform is managing
terraform state list

# Show all outputs (IPs, URLs, ARNs)
terraform output

# Show a single output
terraform output public_ip

# Show details of a specific resource
terraform state show aws_instance.app

# Show full current state
terraform show

# Preview changes before applying
terraform plan

# Tear down everything
terraform destroy
```

## Useful AWS CLI Commands

```bash
# Find all resources tagged with this project
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=helloworld-poc \
  --profile serverless-admin \
  --query 'ResourceTagMappingList[*].ResourceARN' \
  --output table

# Check EC2 instance status
aws ec2 describe-instances \
  --filters "Name=tag:Project,Values=helloworld-poc" \
  --profile serverless-admin \
  --query 'Reservations[*].Instances[*].{Id:InstanceId,State:State.Name,Type:InstanceType,IP:PublicIpAddress}' \
  --output table

# Check ECR repositories
aws ecr describe-repositories \
  --profile serverless-admin \
  --query 'repositories[?starts_with(repositoryName,`helloworld-poc`)].{Name:repositoryName,URI:repositoryUri}' \
  --output table
```
