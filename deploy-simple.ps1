# Simple deployment script that reads from deployment-config.yml
param(
    [string]$Stage = "",
    [string]$Region = ""
)

# Read the config file to get default values
$configContent = Get-Content -Path "deployment-config.yml" -Raw
$config = $configContent | ConvertFrom-Yaml

# Use config values if not provided as parameters
if (-not $Stage) { $Stage = $config.default_stage }
if (-not $Region) { $Region = $config.default_region }
$Profile = $config.aws_profile

Write-Host "🚀 Deploying with configuration:" -ForegroundColor Green
Write-Host "  Service: $($config.service_name)" -ForegroundColor Yellow
Write-Host "  Stage: $Stage" -ForegroundColor Yellow
Write-Host "  Region: $Region" -ForegroundColor Yellow
Write-Host "  Profile: $Profile" -ForegroundColor Yellow
Write-Host ""

# Deploy using serverless
Write-Host "☁️  Deploying to AWS..." -ForegroundColor Green
serverless deploy --stage $Stage --region $Region --profile $Profile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Getting deployment info..." -ForegroundColor Green
    serverless info --stage $Stage --region $Region --profile $Profile
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}