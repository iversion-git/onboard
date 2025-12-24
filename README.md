# AWS Lambda Control Plane API

A serverless control plane API for ERP provisioning workflows, built with AWS Lambda, Node.js 24, and TypeScript.

## Architecture

This project follows a microservices architecture with:
- **One Lambda per route** pattern for focused functionality
- **Shared Lambda Layers** for common utilities and dependencies
- **Centralized JWT authentication** via API Gateway Lambda Authorizer
- **DynamoDB** for data persistence
- **Amazon SES** for email notifications
- **AWS Secrets Manager** for JWT signing keys

## Project Structure

```
├── api/                    # Lambda function handlers
│   ├── auth/              # Authentication endpoints
│   ├── staff/             # Staff management endpoints
│   └── tenant/            # Tenant management endpoints
├── core/                  # Shared core utilities
├── layers/                # Lambda layers
│   ├── dependencies/      # External dependencies layer
│   └── shared-core/       # Shared core utilities layer
├── tests/                 # Test files
├── serverless.yml         # Serverless Framework configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Root package.json with workspace config
└── pnpm-workspace.yaml    # PNPM workspace configuration
```

## Prerequisites

- Node.js 24.x or later
- PNPM (required for dependency management)
- AWS CLI configured with appropriate permissions
- Serverless Framework v3

## Installation

1. Install PNPM if not already installed:
   ```bash
   npm install -g pnpm
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm build
   ```

## Development

### Running Tests
```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run property-based tests only
pnpm test:properties
```

### Local Development
```bash
# Start serverless offline
pnpm offline
```

### Deployment
```bash
# Deploy to development
pnpm deploy:dev

# Deploy to production
pnpm deploy:prod
```

## API Endpoints

### Authentication
- `POST /auth/login` - Staff login with JWT generation
- `POST /auth/password-reset/request` - Request password reset
- `POST /auth/password-reset/confirm` - Confirm password reset

### Staff Management (Admin only)
- `POST /staff/register` - Register new staff member
- `POST /staff/enable` - Enable staff account
- `POST /staff/disable` - Disable staff account
- `GET /staff/me` - Get current staff profile (authenticated)

### Tenant Management (Admin/Manager only)
- `POST /tenant/register` - Register new tenant

## Environment Variables

The following environment variables are automatically configured by Serverless Framework:

- `STAGE` - Deployment stage (dev/prod)
- `REGION` - AWS region
- `STAFF_TABLE` - DynamoDB staff table name
- `PASSWORD_RESET_TOKENS_TABLE` - DynamoDB password reset tokens table name
- `TENANTS_TABLE` - DynamoDB tenants table name
- `JWT_SECRET_NAME` - Secrets Manager secret name for JWT signing key

## Security Features

- JWT-based authentication with role-based access control
- Password hashing with bcrypt
- Input validation with Zod schemas
- PII-safe logging
- Least-privilege IAM roles
- CORS configuration
- API throttling

## Monitoring & Observability

- AWS X-Ray distributed tracing
- Structured logging with AWS Lambda Powertools
- Correlation ID tracking
- Performance metrics collection
- Error tracking and alerting

## Package Management

This project uses **PNPM** for dependency management instead of npm. PNPM provides:
- Faster installs
- Better disk space efficiency
- Stricter dependency resolution
- Prevention of phantom dependencies

Always use `pnpm` commands instead of `npm` when working with this project.