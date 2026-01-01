# Manual Resource Cleanup Order

## Order is CRITICAL - Delete in this sequence:

### 1. RDS Resources (First - most dependencies)
```bash
# Delete RDS Proxy Target Groups
aws rds deregister-db-proxy-targets --db-proxy-name PROXY_NAME --target-group-name default --region ap-southeast-2

# Delete RDS Proxies
aws rds delete-db-proxy --db-proxy-name PROXY_NAME --region ap-southeast-2

# Delete Aurora DB Instances
aws rds delete-db-instance --db-instance-identifier INSTANCE_ID --skip-final-snapshot --region ap-southeast-2

# Delete Aurora Clusters (wait for instances to delete first)
aws rds delete-db-cluster --db-cluster-identifier CLUSTER_ID --skip-final-snapshot --region ap-southeast-2

# Delete DB Subnet Groups
aws rds delete-db-subnet-group --db-subnet-group-name SUBNET_GROUP_NAME --region ap-southeast-2
```

### 2. IAM Roles
```bash
# Detach policies first
aws iam list-attached-role-policies --role-name ROLE_NAME
aws iam detach-role-policy --role-name ROLE_NAME --policy-arn POLICY_ARN

# Delete inline policies
aws iam list-role-policies --role-name ROLE_NAME
aws iam delete-role-policy --role-name ROLE_NAME --policy-name POLICY_NAME

# Delete role
aws iam delete-role --role-name ROLE_NAME
```

### 3. Security Groups
```bash
# Delete security group rules first (if any dependencies)
aws ec2 describe-security-groups --group-ids sg-xxxxx --region ap-southeast-2

# Delete security groups
aws ec2 delete-security-group --group-id sg-xxxxx --region ap-southeast-2
```

### 4. Subnets
```bash
# Delete subnets
aws ec2 delete-subnet --subnet-id subnet-xxxxx --region ap-southeast-2
```

### 5. Route Tables (if any custom ones)
```bash
# Disassociate route tables first
aws ec2 disassociate-route-table --association-id rtbassoc-xxxxx --region ap-southeast-2

# Delete route tables
aws ec2 delete-route-table --route-table-id rtb-xxxxx --region ap-southeast-2
```

### 6. Internet Gateways
```bash
# Detach from VPC first
aws ec2 detach-internet-gateway --internet-gateway-id igw-xxxxx --vpc-id vpc-xxxxx --region ap-southeast-2

# Delete Internet Gateway
aws ec2 delete-internet-gateway --internet-gateway-id igw-xxxxx --region ap-southeast-2
```

### 7. VPCs (Last)
```bash
# Delete VPC
aws ec2 delete-vpc --vpc-id vpc-xxxxx --region ap-southeast-2
```