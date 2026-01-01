# VPC Deletion Troubleshooting Guide

## Common VPC Deletion Blockers

### 1. Network Interfaces (Most Common)
```bash
# Find network interfaces in the VPC
aws ec2 describe-network-interfaces --region ap-southeast-2 --filters "Name=vpc-id,Values=vpc-xxxxx" --query 'NetworkInterfaces[*].{NetworkInterfaceId:NetworkInterfaceId,Status:Status,Description:Description,PrivateIpAddress:PrivateIpAddress}'

# Delete network interfaces (if safe)
aws ec2 delete-network-interface --network-interface-id eni-xxxxx --region ap-southeast-2
```

### 2. Security Groups with Dependencies
```bash
# Find security groups in VPC
aws ec2 describe-security-groups --region ap-southeast-2 --filters "Name=vpc-id,Values=vpc-xxxxx" --query 'SecurityGroups[*].{GroupId:GroupId,GroupName:GroupName,Description:Description}'

# Check security group dependencies
aws ec2 describe-security-groups --group-ids sg-xxxxx --region ap-southeast-2 --query 'SecurityGroups[0].IpPermissions[*].UserIdGroupPairs'

# Delete security group rules first, then groups
aws ec2 revoke-security-group-ingress --group-id sg-xxxxx --protocol tcp --port 80 --source-group sg-yyyyy --region ap-southeast-2
aws ec2 delete-security-group --group-id sg-xxxxx --region ap-southeast-2
```

### 3. Subnets with Resources
```bash
# Find subnets in VPC
aws ec2 describe-subnets --region ap-southeast-2 --filters "Name=vpc-id,Values=vpc-xxxxx" --query 'Subnets[*].{SubnetId:SubnetId,AvailabilityZone:AvailabilityZone,CidrBlock:CidrBlock}'

# Check what's in each subnet
aws ec2 describe-instances --region ap-southeast-2 --filters "Name=subnet-id,Values=subnet-xxxxx" --query 'Reservations[*].Instances[*].{InstanceId:InstanceId,State:State.Name}'
```

### 4. Route Tables
```bash
# Find route tables in VPC
aws ec2 describe-route-tables --region ap-southeast-2 --filters "Name=vpc-id,Values=vpc-xxxxx" --query 'RouteTables[*].{RouteTableId:RouteTableId,Associations:Associations[*].SubnetId}'

# Disassociate and delete custom route tables
aws ec2 disassociate-route-table --association-id rtbassoc-xxxxx --region ap-southeast-2
aws ec2 delete-route-table --route-table-id rtb-xxxxx --region ap-southeast-2
```

### 5. Internet/NAT Gateways
```bash
# Find Internet Gateways attached to VPC
aws ec2 describe-internet-gateways --region ap-southeast-2 --filters "Name=attachment.vpc-id,Values=vpc-xxxxx" --query 'InternetGateways[*].{InternetGatewayId:InternetGatewayId,State:Attachments[0].State}'

# Detach and delete
aws ec2 detach-internet-gateway --internet-gateway-id igw-xxxxx --vpc-id vpc-xxxxx --region ap-southeast-2
aws ec2 delete-internet-gateway --internet-gateway-id igw-xxxxx --region ap-southeast-2

# Find NAT Gateways in VPC subnets
aws ec2 describe-nat-gateways --region ap-southeast-2 --filter "Name=vpc-id,Values=vpc-xxxxx" --query 'NatGateways[*].{NatGatewayId:NatGatewayId,State:State,SubnetId:SubnetId}'

# Delete NAT Gateways
aws ec2 delete-nat-gateway --nat-gateway-id nat-xxxxx --region ap-southeast-2
```

## Quick VPC Cleanup Script
```bash
#!/bin/bash
VPC_ID="vpc-xxxxx"
REGION="ap-southeast-2"

echo "Cleaning up VPC: $VPC_ID"

# 1. Delete NAT Gateways
echo "Deleting NAT Gateways..."
aws ec2 describe-nat-gateways --region $REGION --filter "Name=vpc-id,Values=$VPC_ID" --query 'NatGateways[?State==`available`].NatGatewayId' --output text | xargs -I {} aws ec2 delete-nat-gateway --nat-gateway-id {} --region $REGION

# 2. Delete Network Interfaces
echo "Deleting Network Interfaces..."
aws ec2 describe-network-interfaces --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'NetworkInterfaces[?Status==`available`].NetworkInterfaceId' --output text | xargs -I {} aws ec2 delete-network-interface --network-interface-id {} --region $REGION

# 3. Delete Security Groups (except default)
echo "Deleting Security Groups..."
aws ec2 describe-security-groups --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text | xargs -I {} aws ec2 delete-security-group --group-id {} --region $REGION

# 4. Delete Subnets
echo "Deleting Subnets..."
aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text | xargs -I {} aws ec2 delete-subnet --subnet-id {} --region $REGION

# 5. Delete Route Tables (except main)
echo "Deleting Route Tables..."
aws ec2 describe-route-tables --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text | xargs -I {} aws ec2 delete-route-table --route-table-id {} --region $REGION

# 6. Detach and Delete Internet Gateway
echo "Deleting Internet Gateway..."
IGW_ID=$(aws ec2 describe-internet-gateways --region $REGION --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[0].InternetGatewayId' --output text)
if [ "$IGW_ID" != "None" ]; then
    aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $REGION
    aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID --region $REGION
fi

# 7. Finally Delete VPC
echo "Deleting VPC..."
aws ec2 delete-vpc --vpc-id $VPC_ID --region $REGION

echo "VPC cleanup complete!"
```