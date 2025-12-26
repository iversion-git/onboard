# Simple PowerShell Deployment Script
# Edit the variables in serverless.yml to customize your deployment

param(
    [string]$Stage = "dev",
    [string]$Region = "ap-southeast-2",
    [string]$Profile = "node"
)

Write-Host "🚀 Deploying AWS Lambda Control Plane" -ForegroundColor Green
Write-Host "Stage: $Stage" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Profile: $Profile" -ForegroundColor Yellow
Write-Host ""

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Green
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Deploy
Write-Host "☁️  Deploying to AWS..." -ForegroundColor Green
serverless deploy --stage $Stage --region $Region --profile $Profile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Getting deployment info..." -ForegroundColor Green
    serverless info --stage $Stage --region $Region --profile $Profile
    Write-Host ""
    Write-Host "🎉 Your API is ready!" -ForegroundColor Green
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}