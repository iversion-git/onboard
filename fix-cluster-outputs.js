import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: 'ap-southeast-2'
}));

async function fixClusterOutputs() {
  try {
    // Convert the array to an object
    const outputsArray = [
      {"ExportName": "my-cluster-01-PublicRouteTable","Description": "Public Route Table ID","OutputKey": "PublicRouteTable","OutputValue": "rtb-06921d1ca346823ee"},
      {"ExportName": "my-cluster-01-NATGateways","Description": "Comma-delimited list of NAT Gateway IDs","OutputKey": "NATGateways","OutputValue": "nat-06e42a6525f9a7867"},
      {"ExportName": "my-cluster-01-PrivateDBSubnet1","Description": "Private DB Subnet in Availability Zone 1","OutputKey": "PrivateDBSubnet1","OutputValue": "subnet-00789e9dfb570820c"},
      {"ExportName": "my-cluster-01-PrivateDBSubnets","Description": "Comma-delimited list of Private DB Subnet IDs","OutputKey": "PrivateDBSubnets","OutputValue": "subnet-00789e9dfb570820c,subnet-0b460a29aab583b09"},
      {"ExportName": "my-cluster-01-PrivateDBSubnet2","Description": "Private DB Subnet in Availability Zone 2","OutputKey": "PrivateDBSubnet2","OutputValue": "subnet-0b460a29aab583b09"},
      {"ExportName": "my-cluster-01-ALBSecurityGroup","Description": "ALB Security Group ID for Public Zone","OutputKey": "ALBSecurityGroup","OutputValue": "sg-0a9dcd04e2b8abe93"},
      {"ExportName": "my-cluster-01-VPC","Description": "VPC ID","OutputKey": "VPC","OutputValue": "vpc-00ac82852f7040643"},
      {"ExportName": "my-cluster-01-DBSecurityGroup","Description": "DB Security Group ID for Private DB Zone","OutputKey": "DBSecurityGroup","OutputValue": "sg-08e86627ea5847e54"},
      {"OutputKey": "TemplateVersion","OutputValue": "1.0.0","Description": "CloudFormation template version"},
      {"ExportName": "my-cluster-01-PrivateAppRouteTables","Description": "Comma-delimited list of Private App Route Table IDs","OutputKey": "PrivateAppRouteTables","OutputValue": "rtb-0051520e59a655d41"},
      {"ExportName": "my-cluster-01-PrivateDBRouteTable","Description": "Private DB Route Table ID","OutputKey": "PrivateDBRouteTable","OutputValue": "rtb-0f9d042ca3a35f677"},
      {"ExportName": "my-cluster-01-PrivateAppRouteTable1","Description": "Private App Route Table for Availability Zone 1","OutputKey": "PrivateAppRouteTable1","OutputValue": "rtb-0051520e59a655d41"},
      {"ExportName": "my-cluster-01-VPC-CIDR","Description": "VPC CIDR block","OutputKey": "VPCCidr","OutputValue": "10.201.0.0/16"},
      {"ExportName": "my-cluster-01-PrivateAppSubnet2","Description": "Private App Subnet in Availability Zone 2","OutputKey": "PrivateAppSubnet2","OutputValue": "subnet-0a04ebe22ea602c95"},
      {"ExportName": "my-cluster-01-InternetGateway","Description": "Internet Gateway ID","OutputKey": "InternetGateway","OutputValue": "igw-04449c3439f780a3e"},
      {"ExportName": "my-cluster-01-PrivateAppSubnet1","Description": "Private App Subnet in Availability Zone 1","OutputKey": "PrivateAppSubnet1","OutputValue": "subnet-08f8ed4cd804a4b83"},
      {"ExportName": "my-cluster-01-PublicSubnets","Description": "Comma-delimited list of Public Subnet IDs","OutputKey": "PublicSubnets","OutputValue": "subnet-06d31c5780fb4f06c,subnet-05e1c56ea1898d910"},
      {"ExportName": "my-cluster-01-PublicSubnet2","Description": "Public Subnet in Availability Zone 2","OutputKey": "PublicSubnet2","OutputValue": "subnet-05e1c56ea1898d910"},
      {"ExportName": "my-cluster-01-PrivateAppSubnets","Description": "Comma-delimited list of Private App Subnet IDs","OutputKey": "PrivateAppSubnets","OutputValue": "subnet-08f8ed4cd804a4b83,subnet-0a04ebe22ea602c95"},
      {"ExportName": "my-cluster-01-AppSecurityGroup","Description": "App Security Group ID for Private App Zone","OutputKey": "AppSecurityGroup","OutputValue": "sg-00c544aa71ed4c7dc"},
      {"ExportName": "my-cluster-01-PublicSubnet1","Description": "Public Subnet in Availability Zone 1","OutputKey": "PublicSubnet1","OutputValue": "subnet-06d31c5780fb4f06c"},
      {"ExportName": "my-cluster-01-NATGateway1","Description": "NAT Gateway in Availability Zone 1","OutputKey": "NATGateway1","OutputValue": "nat-06e42a6525f9a7867"}
    ];

    // Convert array to object
    const outputsObject = outputsArray.reduce((acc, output) => {
      if (output.OutputKey && output.OutputValue) {
        acc[output.OutputKey] = output.OutputValue;
      }
      return acc;
    }, {});

    console.log('Converting stack_outputs from array to object...');
    console.log('New format:', JSON.stringify(outputsObject, null, 2));

    const result = await client.send(new UpdateCommand({
      TableName: 'Clusters-dev',
      Key: { cluster_id: '85e1f769-8147-407c-9f73-925e94345ec9' },
      UpdateExpression: 'SET stack_outputs = :outputs, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':outputs': outputsObject,
        ':updated_at': new Date().toISOString()
      }
    }));

    console.log('✅ Successfully fixed cluster record!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixClusterOutputs();