# Check AWS Account Limits

## VPC Limits
```bash
# Check current VPCs
aws ec2 describe-vpcs --region ap-southeast-2

# Check VPC limit
aws service-quotas get-service-quota --service-code ec2 --quota-code L-F678F1CE --region ap-southeast-2
```

## Internet Gateway Limits
```bash
# Check current Internet Gateways
aws ec2 describe-internet-gateways --region ap-southeast-2

# Check IGW limit
aws service-quotas get-service-quota --service-code ec2 --quota-code L-A4707A72 --region ap-southeast-2
```

## IAM Role Limits
```bash
# Check current IAM roles count
aws iam list-roles --query 'Roles | length(@)'

# Check IAM role limit
aws service-quotas get-service-quota --service-code iam --quota-code L-62FBD8A2
```

## DHCP Options Limits
```bash
# Check current DHCP options
aws ec2 describe-dhcp-options --region ap-southeast-2
```