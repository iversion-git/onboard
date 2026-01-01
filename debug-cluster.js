import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: 'ap-southeast-2' // Your region
}));

async function debugCluster() {
  try {
    const result = await client.send(new GetCommand({
      TableName: 'Clusters-dev', // Your table name
      Key: { cluster_id: '85e1f769-8147-407c-9f73-925e94345ec9' }
    }));
    
    console.log('Raw cluster record:');
    console.log(JSON.stringify(result.Item, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugCluster();