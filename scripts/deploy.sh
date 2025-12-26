#!/bin/bash

# AWS Lambda Control Plane - Single Function Deployment Script
# This script ensures proper environment setup and deployment for the single function architecture

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo -e "${GREEN}🚀 Deploying AWS Lambda Control Plane (Single Function Architecture)${NC}"
echo -e "Stage: ${YELLOW}${STAGE}${NC}"
echo -e "Region: ${YELLOW}${REGION}${NC}"
echo ""

# Check if JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ Error: JWT_SECRET environment variable is not set${NC}"
    echo -e "${YELLOW}💡 Generate a JWT secret using: npm run generate-jwt-secret${NC}"
    echo -e "${YELLOW}💡 Then export it: export JWT_SECRET=your_generated_secret${NC}"
    exit 1
fi

# Check if SES_FROM_EMAIL is set for production
if [ "$STAGE" = "prod" ] && [ -z "$SES_FROM_EMAIL" ]; then
    echo -e "${YELLOW}⚠️  Warning: SES_FROM_EMAIL not set for production deployment${NC}"
    echo -e "${YELLOW}💡 Set it with: export SES_FROM_EMAIL=noreply@yourdomain.com${NC}"
fi

# Validate Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Error: Node.js 20 or higher is required${NC}"
    echo -e "Current version: $(node --version)"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ Error: pnpm is required but not installed${NC}"
    echo -e "${YELLOW}💡 Install with: npm install -g pnpm${NC}"
    exit 1
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies with pnpm...${NC}"
pnpm install --frozen-lockfile

# Run type checking
echo -e "${GREEN}🔍 Running type checking...${NC}"
pnpm run type-check

# Run tests
echo -e "${GREEN}🧪 Running tests...${NC}"
pnpm run test

# Build the project
echo -e "${GREEN}🔨 Building project...${NC}"
pnpm run build

# Deploy with Serverless Framework
echo -e "${GREEN}☁️  Deploying to AWS...${NC}"
pnpm run deploy -- --stage "$STAGE" --region "$REGION"

# Get the API URL from the deployment output
API_URL=$(serverless info --stage "$STAGE" --region "$REGION" | grep "HttpApiUrl" | awk '{print $2}')

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 API URL: ${YELLOW}${API_URL}${NC}"
echo ""
echo -e "${GREEN}📊 Single Function Architecture Features:${NC}"
echo -e "  • Internal Node.js routing for all endpoints"
echo -e "  • Bundled dependencies with esbuild for optimal performance"
echo -e "  • Stage-scoped DynamoDB tables"
echo -e "  • API Gateway proxy integration with /{proxy+} routing"
echo -e "  • CloudWatch monitoring and alarms"
echo -e "  • X-Ray tracing enabled"
echo ""
echo -e "${GREEN}🔧 Available endpoints:${NC}"
echo -e "  • POST ${API_URL}/auth/login"
echo -e "  • POST ${API_URL}/auth/password-reset/request"
echo -e "  • POST ${API_URL}/auth/password-reset/confirm"
echo -e "  • GET  ${API_URL}/staff/me"
echo -e "  • POST ${API_URL}/staff/register"
echo -e "  • POST ${API_URL}/staff/enable"
echo -e "  • POST ${API_URL}/staff/disable"
echo -e "  • POST ${API_URL}/tenant/register"
echo ""
echo -e "${GREEN}📈 Performance Targets:${NC}"
echo -e "  • p50 response time: ≤ 300ms"
echo -e "  • p95 response time: ≤ 500ms"
echo -e "  • p95 cold start: ≤ 1200ms"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "  • Test the API endpoints"
echo -e "  • Monitor CloudWatch metrics and alarms"
echo -e "  • Review X-Ray traces for performance optimization"