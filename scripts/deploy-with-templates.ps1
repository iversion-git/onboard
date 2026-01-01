# PowerShell script to deploy the application and upload templates
param(
    [string]$Stage = "dev",
    [string]$Region = "ap-southeast-2"
)

Write-Host "🚀 Deploying AWS Lambda Control Plane with CloudFormation templates..." -ForegroundColor Green
Write-Host "📍 Stage: $Stage" -ForegroundColor Cyan
Write-Host "📍 Region: $Region" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:STAGE = $Stage
$env:AWS_REGION = $Region

try {
    # Deploy the serverless application
    Write-Host "📦 Deploying serverless application..." -ForegroundColor Yellow
    serverless deploy --stage $Stage --region $Region
    
    if ($LASTEXITCODE -ne 0) {
        throw "Serverless deployment failed"
    }
    
    Write-Host "✅ Serverless deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Upload CloudFormation templates
    Write-Host "📤 Uploading CloudFormation templates..." -ForegroundColor Yellow
    node scripts/upload-templates.js
    
    if ($LASTEXITCODE -ne 0) {
        throw "Template upload failed"
    }
    
    Write-Host ""
    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
    Write-Host "✅ Application deployed" -ForegroundColor Green
    Write-Host "✅ CloudFormation templates uploaded" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    exit 1
}