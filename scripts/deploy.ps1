# AWS Lambda Control Plane - Single Function Deployment Script (PowerShell)
# This script ensures proper environment setup and deployment for the single function architecture

param(
    [string]$Stage = "dev",
    [string]$Region = "ap-southeast-2",
    [string]$Profile = "node"
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"

Write-Host "🚀 Deploying AWS Lambda Control Plane (Single Function Architecture)" -ForegroundColor $Green
Write-Host "Stage: $Stage" -ForegroundColor $Yellow
Write-Host "Region: $Region" -ForegroundColor $Yellow
Write-Host "Profile: $Profile" -ForegroundColor $Yellow
Write-Host ""

# Check if JWT_SECRET is set
if (-not $env:JWT_SECRET) {
    Write-Host "❌ Error: JWT_SECRET environment variable is not set" -ForegroundColor $Red
    Write-Host "💡 Generate a JWT secret using: node scripts/generate-jwt-secret.js" -ForegroundColor $Yellow
    Write-Host "💡 Then set it: `$env:JWT_SECRET='your_generated_secret'" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "Example:" -ForegroundColor $Yellow
    Write-Host "  node scripts/generate-jwt-secret.js" -ForegroundColor $Yellow
    Write-Host "  `$env:JWT_SECRET='r2P19YQ0kv59MUGL5Ppi9pvGnmmaerxpBox5i0PRpBNd3J1IKptaphEIf7Lbe9BI'" -ForegroundColor $Yellow
    exit 1
}

Write-Host "✅ JWT_SECRET is configured" -ForegroundColor $Green

# Check if AWS profile exists
try {
    aws sts get-caller-identity --profile $Profile | Out-Null
    Write-Host "✅ AWS profile '$Profile' is working" -ForegroundColor $Green
} catch {
    Write-Host "❌ Error: AWS profile '$Profile' is not configured or not working" -ForegroundColor $Red
    Write-Host "💡 Configure with: aws configure --profile $Profile" -ForegroundColor $Yellow
    exit 1
}

# Validate Node.js version
$nodeVersion = (node --version).Substring(1).Split('.')[0]
if ([int]$nodeVersion -lt 20) {
    Write-Host "❌ Error: Node.js 20 or higher is required" -ForegroundColor $Red
    Write-Host "Current version: $(node --version)"
    exit 1
}

Write-Host "✅ Node.js version $(node --version) is supported" -ForegroundColor $Green

# Check if pnpm is installed
try {
    pnpm --version | Out-Null
    Write-Host "✅ PNPM is installed" -ForegroundColor $Green
} catch {
    Write-Host "❌ Error: pnpm is required but not installed" -ForegroundColor $Red
    Write-Host "💡 Install with: npm install -g pnpm" -ForegroundColor $Yellow
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies with pnpm..." -ForegroundColor $Green
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Failed to install dependencies" -ForegroundColor $Red
    exit 1
}

# Deploy with Serverless Framework
Write-Host "☁️  Deploying to AWS..." -ForegroundColor $Green
serverless deploy --stage $Stage --region $Region --profile $Profile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Deployment failed" -ForegroundColor $Red
    exit 1
}

# Get the API URL from the deployment output
Write-Host "📊 Getting deployment information..." -ForegroundColor $Green
serverless info --stage $Stage --region $Region --profile $Profile

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor $Green
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
Write-Host "  • POST /auth/login"
Write-Host "  • POST /auth/password-reset/request"
Write-Host "  • POST /auth/password-reset/confirm"
Write-Host "  • GET  /staff/me"
Write-Host "  • POST /staff/register"
Write-Host "  • POST /staff/enable"
Write-Host "  • POST /staff/disable"
Write-Host "  • POST /tenant/register"
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