# Dependencies Lambda Layer

This Lambda Layer contains external dependencies for the AWS Lambda Control Plane API.

## Included Dependencies

### AWS Lambda Powertools v2
- `@aws-lambda-powertools/logger` - Structured logging with correlation IDs
- `@aws-lambda-powertools/tracer` - AWS X-Ray distributed tracing
- `@aws-lambda-powertools/metrics` - CloudWatch custom metrics

### Security & Authentication
- `jose` - JWT operations (signing, verification, key management)
- `bcrypt` - Password hashing and verification

### Data Validation
- `zod` - Runtime type validation and schema parsing
- `validator` - String validation utilities (email, URL, etc.)

## Usage

This layer is deployed as a Lambda Layer and referenced by all Lambda functions in the Control Plane API. The dependencies are available in the Lambda runtime at `/opt/nodejs/node_modules/`.

## Build Process

```bash
# Install production dependencies
pnpm install --prod

# Build layer structure
pnpm run build
```

The build process creates a `dist/nodejs/node_modules/` directory structure that Lambda expects for layers.

## Notes

- AWS SDK v3 is NOT included as it's provided by the Lambda runtime
- Only production dependencies are included in the layer
- PNPM is used for efficient dependency management
- Layer is optimized for Node.js 24 runtime