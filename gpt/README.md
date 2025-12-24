# aws-lambda-control-plane (complete minimal)

Two Lambdas:
- `POST /auth/login` → validates credentials against DynamoDB (Staff table) and returns a JWT
- `authorizer` → HTTP API Lambda Request Authorizer that verifies the JWT and (optionally) checks staff enabled status

## Prereqs
- Node 24+
- pnpm 9+
- AWS credentials configured (e.g. `AWS_PROFILE=dev`)

## Install
```bash
pnpm install
```

## Create JWT secret (Secrets Manager)
This project expects an **HS256** signing key stored as the SecretString in Secrets Manager.

Example (dev stage, ap-southeast-2):
```bash
aws secretsmanager create-secret \
  --name aws-lambda-control-plane-dev-jwt-secret \
  --secret-string "replace-with-long-random-secret" \
  --region ap-southeast-2
```

If it already exists, update it:
```bash
aws secretsmanager put-secret-value \
  --secret-id aws-lambda-control-plane-dev-jwt-secret \
  --secret-string "replace-with-long-random-secret" \
  --region ap-southeast-2
```

## Deploy
```bash
pnpm run deploy:dev
```

This will also create DynamoDB table `Staff-dev` with a GSI `EmailIndex`.

## Seed a staff user
```bash
# Example:
pnpm run seed:dev -- --email admin@example.com --password "Passw0rd!" --roles admin,staff
```

## Test login
```bash
curl -s -X POST \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"Passw0rd!"}' \
  https://<YOUR_HTTP_API_ENDPOINT>/auth/login
```

Response:
```json
{
  "token": "<jwt>",
  "staff": { "staff_id": "...", "email": "...", "roles": ["admin","staff"] }
}
```

## Use the authorizer on protected routes
In Serverless, attach the authorizer to a route:

```yml
events:
  - httpApi:
      path: /protected
      method: get
      authorizer:
        name: jwtAuthorizer
```

Authorizer context contains:
- `staff_id`
- `email`
- `roles` (JSON string)
- `stage`
