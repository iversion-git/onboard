# Cleanup Orphaned AWS Resources

## 1. Find Orphaned VPCs
```bash
# List all VPCs with their names and states
aws ec2 describe-vpcs --region ap-southeast-2 --query 'Vpcs[*].{VpcId:VpcId,State:State,CidrBlock:CidrBlock,Name:Tags[?Key==`Name`].Value|[0]}' --output table

# Look for VPCs with names like:
# - my-cluster-01-*
# - test-cluster-*
# - Any cluster names you've tried to deploy
```

## 2. Find Orphaned Internet Gateways
```bash
# List all Internet Gateways
aws ec2 describe-internet-gateways --region ap-southeast-2 --query 'InternetGateways[*].{GatewayId:InternetGatewayId,State:Attachments[0].State,VpcId:Attachments[0].VpcId,Name:Tags[?Key==`Name`].Value|[0]}' --output table

# Look for IGWs attached to orphaned VPCs
```

## 3. Find Orphaned IAM Roles
```bash
# List IAM roles with your cluster names
aws iam list-roles --query 'Roles[?contains(RoleName, `rds-proxy-role`) || contains(RoleName, `my-cluster`) || contains(RoleName, `test-cluster`)].{RoleName:RoleName,CreateDate:CreateDate}' --output table
```

## 4. Find Orphaned RDS Resources
```bash
# List Aurora clusters
aws rds describe-db-clusters --region ap-southeast-2 --query 'DBClusters[*].{ClusterIdentifier:DBClusterIdentifier,Status:Status,Engine:Engine}' --output table

# List RDS Proxies
aws rds describe-db-proxies --region ap-southeast-2 --query 'DBProxies[*].{ProxyName:DBProxyName,Status:Status,VpcId:VpcId}' --output table
```

## 5. Find Failed CloudFormation Stacks
```bash
# List all stacks (including failed ones)
aws cloudformation list-stacks --region ap-southeast-2 --query 'StackSummaries[?contains(StackName, `control-plane`) || contains(StackName, `my-cluster`)].{StackName:StackName,StackStatus:StackStatus,CreationTime:CreationTime}' --output table

# Get details of failed stacks
aws cloudformation describe-stacks --region ap-southeast-2 --stack-name STACK_NAME_HERE
```