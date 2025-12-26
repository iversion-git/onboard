# Quick Deployment Guide

## Prerequisites
1. AWS CLI configured with profile "node"
2. Node.js 20+ installed
3. PNPM installed

## Step-by-Step Deployment

### 1. Set Environment Variables

```powershell
# Generate JWT Secret
node scripts/generate-jwt-secret.js

# Copy the generated secret and set it as environment variable
$env:JWT_SECRET="paste-your-generated-secret-here"

# Optional: Set SES email for production
$env:SES_FROM_EMAIL="noreply@yourdomain.com"
```

### 2. Install Dependencies

```powershell
pnpm install --frozen-lockfile
```

### 3. Deploy to AWS

```powershell
# Deploy to development stage
serverless deploy --stage dev --profile node

# Or deploy to production stage
serverless deploy --stage prod --profile node
```

### 4. Verify Deployment

```powershell
# Get deployment info
serverless info --stage dev --profile node

# Test the API
curl https://your-api-url.execute-api.ap-southeast-2.amazonaws.com/auth/login
```

## Common Issues and Solutions

### Issue 1: JWT_SECRET not found
**Solution**: Make sure you set the environment variable:
```powershell
$env:JWT_SECRET="your-secret-here"
```

### Issue 2: AWS credentials not found
**Solution**: Use the --profile flag:
```powershell
serverless deploy --stage dev --profile node
```

### Issue 3: Region mismatch
**Solution**: The serverless.yml is configured for ap-southeast-2. If you want a different region:
```powershell
serverless deploy --stage dev --region us-east-1 --profile node
```

## Available Commands

```powershell
# Deploy
serverless deploy --stage dev --profile node

# Get info about deployed stack
serverless info --stage dev --profile node

# View logs
serverless logs -f api --stage dev --profile node

# Remove deployment
serverless remove --stage dev --profile node
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| JWT_SECRET | Yes | - | JWT signing secret (min 32 chars) |
| SES_FROM_EMAIL | No | noreply@example.com | Email for notifications |
| CORS_ORIGINS | No | * | Allowed CORS origins |

## API Endpoints

After deployment, your API will have these endpoints:

- `POST /auth/login` - Staff authentication
- `POST /auth/password-reset/request` - Request password reset
- `POST /auth/password-reset/confirm` - Confirm password reset
- `GET /staff/me` - Get current staff profile
- `POST /staff/register` - Register new staff (admin only)
- `POST /staff/enable` - Enable staff account (admin only)
- `POST /staff/disable` - Disable staff account (admin only)
- `POST /tenant/register` - Register new tenant (admin/manager only)