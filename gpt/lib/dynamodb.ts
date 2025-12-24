import { DynamoDBClient, GetItemCommand, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { env } from "./config.js";

let _ddb: DynamoDBClient | undefined;

export function ddb(): DynamoDBClient {
  if (!_ddb) {
    _ddb = new DynamoDBClient({ region: env().REGION });
  }
  return _ddb;
}

export type StaffRecord = {
  staff_id: string;
  email: string;
  password_hash: string;
  roles: string[];
  enabled: boolean;
};

export async function getStaffByEmail(emailLower: string): Promise<StaffRecord | null> {
  const { STAFF_TABLE } = env();
  const out = await ddb().send(
    new QueryCommand({
      TableName: STAFF_TABLE,
      IndexName: "EmailIndex",
      KeyConditionExpression: "#email = :email",
      ExpressionAttributeNames: { "#email": "email" },
      ExpressionAttributeValues: { ":email": { S: emailLower } },
      Limit: 1
    })
  );
  const item = out.Items?.[0];
  if (!item) return null;
  return unmarshall(item) as StaffRecord;
}

export async function getStaffById(staffId: string): Promise<Pick<StaffRecord, "staff_id" | "email" | "roles" | "enabled"> | null> {
  const { STAFF_TABLE } = env();
  const out = await ddb().send(
    new GetItemCommand({
      TableName: STAFF_TABLE,
      Key: { staff_id: { S: staffId } },
      ConsistentRead: false
    })
  );
  if (!out.Item) return null;
  const rec = unmarshall(out.Item) as StaffRecord;
  return { staff_id: rec.staff_id, email: rec.email, roles: rec.roles, enabled: rec.enabled };
}

export async function putStaff(rec: StaffRecord): Promise<void> {
  const { STAFF_TABLE } = env();
  await ddb().send(
    new PutItemCommand({
      TableName: STAFF_TABLE,
      Item: marshall(rec, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_not_exists(staff_id)"
    })
  );
}
