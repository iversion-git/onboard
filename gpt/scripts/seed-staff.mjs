#!/usr/bin/env node
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

function arg(name, defVal = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return defVal;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith("--")) return defVal;
  return v;
}

const stage = arg("stage", process.env.STAGE || "dev");
const region = arg("region", process.env.AWS_REGION || process.env.REGION || "ap-southeast-2");
const email = arg("email");
const password = arg("password");
const rolesRaw = arg("roles", "staff");
const enabledRaw = arg("enabled", "true");

if (!email || !password) {
  console.error("Usage: node scripts/seed-staff.mjs --stage dev --email a@b.com --password Passw0rd! --roles admin,staff [--enabled true]");
  process.exit(1);
}

const staff_id = crypto.randomUUID();
const roles = rolesRaw.split(",").map(s => s.trim()).filter(Boolean);
const enabled = enabledRaw.toLowerCase() !== "false";

const salt = await bcrypt.genSalt(12);
const password_hash = await bcrypt.hash(password, salt);

const item = {
  staff_id,
  email: email.trim().toLowerCase(),
  password_hash,
  roles,
  enabled
};

const tableName = `Staff-${stage}`;

const ddb = new DynamoDBClient({ region });

try {
  await ddb.send(new PutItemCommand({
    TableName: tableName,
    Item: marshall(item, { removeUndefinedValues: true }),
    ConditionExpression: "attribute_not_exists(staff_id)"
  }));
  console.log("Seeded staff:");
  console.log(JSON.stringify({ tableName, staff_id, email: item.email, roles, enabled }, null, 2));
} catch (e) {
  console.error("Failed to seed staff:", e?.message || e);
  process.exit(1);
}
