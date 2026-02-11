output "public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Frontend URL"
  value       = "http://${aws_eip.app.public_ip}:3000"
}

output "api_url" {
  description = "Backend API URL"
  value       = "http://${aws_eip.app.public_ip}:8080"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_eip.app.public_ip}"
}

output "ecr_frontend_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_backend_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}

output "aws_account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}
