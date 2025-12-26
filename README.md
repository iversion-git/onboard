# AWS Lambda Control Plane API

A serverless control plane API built with a single Lambda function architecture using Node.js 20, TypeScript, and internal routing. This system provides staff authentication, role-based access control, and tenant registration capabilities for ERP provisioning workflows.

## Architecture

- **Single Function**: All API endpoints handled by one Lambda function with internal Node.js routing
- **Deployment Flexibility**: Can run on AWS Lambda or AWS App Runner without code changes
- **Bundled Dependencies**: All dependencies bundled with esbuild for optimal performance
- **TypeScript**: Strict TypeScript configuration for type safety
- **Property-Based Testing**: Comprehensive testing with fast-check for correctness properties

## Project Structure

```
├── index.ts                 # Main Lambda handler entry point
├── lib/                     # Shared utilities and core logic
├── handlers/                # Route handlers organized by domain
├── middleware/              # Authentication, validation, CORS middleware
├── tests/                   # Unit tests, property tests, integration tests
├── package.json             # PNPM workspace configuration
├── serverless.yml           # Serverless Framework v3 configuration
├── tsconfig.json            # TypeScript strict configuration
└── vitest.config.ts         # Testing framework configuration
```

## Prerequisites

- Node.js 20+
- PNPM (required for workspace management)
- AWS CLI configured
- Serverless Framework v3

## Installation

```bash
# Install dependencies using PNPM
pnpm install

# Type check
pnpm run type-check

# Build the project
pnpm run build
```

## Development

```bash
# Run in development mode with hot reload
pnpm run dev

# Run tests
pnpm run test

# Run property-based tests
pnpm run test:properties

# Watch mode for tests
pnpm run test:watch

# Lint code
pnpm run lint
```

## Deployment

```bash
# Deploy to development stage
pnpm run deploy:dev

# Deploy to production stage
pnpm run deploy:prod

# Remove deployment
pnpm run remove
```

## Key Features

- **Single Function Architecture**: All endpoints in one Lambda function with internal routing
- **JWT Authentication**: Secure token-based authentication with role-based access control
- **Password Reset**: Secure password reset flow with time-limited tokens via Amazon SES
- **Staff Management**: Admin-controlled staff registration and role management
- **Tenant Registration**: Controlled tenant onboarding for ERP provisioning workflows
- **Comprehensive Testing**: Both unit tests and property-based tests for correctness
- **Observability**: AWS Lambda Powertools for logging, metrics, and tracing
- **Security**: Input validation, PII-safe logging, least-privilege IAM roles

## Environment Variables

The following environment variables are automatically configured by Serverless Framework:

- `STAGE`: Deployment stage (dev, staging, prod)
- `DYNAMODB_STAFF_TABLE`: Staff table name
- `DYNAMODB_PASSWORD_RESET_TOKENS_TABLE`: Password reset tokens table name
- `DYNAMODB_TENANTS_TABLE`: Tenants table name
- `JWT_SECRET_NAME`: Secrets Manager secret name for JWT signing
- `SES_FROM_EMAIL`: Email address for sending notifications

## API Endpoints

- `POST /auth/login` - Staff authentication
- `POST /auth/password-reset/request` - Request password reset
- `POST /auth/password-reset/confirm` - Confirm password reset
- `POST /staff/register` - Register new staff (admin only)
- `POST /staff/enable` - Enable staff account (admin only)
- `POST /staff/disable` - Disable staff account (admin only)
- `GET /staff/me` - Get current staff profile
- `POST /tenant/register` - Register new tenant (admin/manager only)

## Testing Strategy

The project uses a dual testing approach:

- **Unit Tests**: Specific examples, edge cases, integration points
- **Property-Based Tests**: Universal properties tested across generated inputs
- **Framework**: Vitest for unit tests, fast-check for property-based testing
- **Coverage**: Comprehensive coverage of business logic and correctness properties

## License

MIT