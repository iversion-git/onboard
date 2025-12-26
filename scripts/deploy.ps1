# AWS Lambda Control Plane - Single Function Deployment Script (PowerShell)
# This script ensures proper environment setup and deployment for the single function architecture

param(
    [string]$Stage = "dev",
    [string]$Region = "us-east-1"
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"

Write-Host "🚀 Deploying AWS Lambda Control Plane (Single Function Architecture)" -ForegroundColor $Green
Write-Host "Stage: $Stage" -ForegroundColor $Yellow
Write-Host "Region: $Region" -ForegroundColor $Yellow
Write-Host ""

# Check if JWT_SECRET is set
if (-not $env:JWT_SECRET) {
    Write-Host "❌ Error: JWT_SECRET environment variable is not set" -ForegroundColor $Red
    Write-Host "💡 Generate a JWT secret using: npm run generate-jwt-secret" -ForegroundColor $Yellow
    Write-Host "💡 Then set it: `$env:JWT_SECRET='your_generated_secret'" -ForegroundColor $Yellow
    exit 1
}

# Check if SES_FROM_EMAIL is set for production
if ($Stage -eq "prod" -and -not $env:SES_FROM_EMAIL) {
    Write-Host "⚠️  Warning: SES_FROM_EMAIL not set for production deployment" -ForegroundColor $Yellow
    Write-Host "💡 Set it with: `$env:SES_FROM_EMAIL='noreply@yourdomain.com'" -ForegroundColor $Yellow
}

# Validate Node.js version
$nodeVersion = (node --version).Substring(1).Split('.')[0]
if ([int]$nodeVersion -lt 20) {
    Write-Host "❌ Error: Node.js 20 or higher is required" -ForegroundColor $Red
    Write-Host "Current version: $(node --version)"
    exit 1
}

# Check if pnpm is installed
try {
    pnpm --version | Out-Null
} catch {
    Write-Host "❌ Error: pnpm is required but not installed" -ForegroundColor $Red
    Write-Host "💡 Install with: npm install -g pnpm" -ForegroundColor $Yellow
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies with pnpm..." -ForegroundColor $Green
pnpm install --frozen-lockfile

# Run type checking
Write-Host "🔍 Running type checking..." -ForegroundColor $Green
pnpm run type-check

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor $Green
pnpm run test

# Build the project
Write-Host "🔨 Building project..." -ForegroundColor $Green
pnpm run build

# Deploy with Serverless Framework
Write-Host "☁️  Deploying to AWS..." -ForegroundColor $Green
pnpm run deploy -- --stage $Stage --region $Region

# Get the API URL from the deployment output
$apiUrl = (serverless info --stage $Stage --region $Region | Select-String "HttpApiUrl" | ForEach-Object { $_.Line.Split()[1] })

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor $Green
Write-Host "🌐 API URL: $apiUrl" -ForegroundColor $Yellow
Write-Host ""
Write-Host "📊 Single Function Architecture Features:" -ForegroundColor $Green
Write-Host "  • Internal Node.js routing for all endpoints"
Write-Host "  • Bundled dependencies with esbuild for optimal performance"
Write-Host "  • Stage-scoped DynamoDB tables"
Write-Host "  • API Gateway proxy integration with /{proxy+} routing"
Write-Host "  • CloudWatch monitoring and alarms"
Write-Host "  • X-Ray tracing enabled"
Write-Host ""
Write-Host "🔧 Available endpoints:" -ForegroundColor $Green
Write-Host "  • POST $apiUrl/auth/login"
Write-Host "  • POST $apiUrl/auth/password-reset/request"
Write-Host "  • POST $apiUrl/auth/password-reset/confirm"
Write-Host "  • GET  $apiUrl/staff/me"
Write-Host "  • POST $apiUrl/staff/register"
Write-Host "  • POST $apiUrl/staff/enable"
Write-Host "  • POST $apiUrl/staff/disable"
Write-Host "  • POST $apiUrl/tenant/register"
Write-Host ""
Write-Host "📈 Performance Targets:" -ForegroundColor $Green
Write-Host "  • p50 response time: ≤ 300ms"
Write-Host "  • p95 response time: ≤ 500ms"
Write-Host "  • p95 cold start: ≤ 1200ms"
Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor $Yellow
Write-Host "  • Test the API endpoints"
Write-Host "  • Monitor CloudWatch metrics and alarms"
Write-Host "  • Review X-Ray traces for performance optimization"