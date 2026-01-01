# PowerShell script to deploy the application and upload templates
param(
    [string]$Stage = "dev",
    [string]$Region = "ap-southeast-2"
)

Write-Host "🚀 Deploying AWS Lambda Control Plane with CloudFormation templates..." -ForegroundColor Green
Write-Host "📍 Stage: $Stage" -ForegroundColor Cyan
Write-Host "📍 Region: $Region" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for the upload script
$env:STAGE = $Stage
$env:AWS_REGION = $Region

try {
    # Deploy the serverless application
    Write-Host "📦 Deploying serverless application..." -ForegroundColor Yellow
    
    if ($Stage -eq "dev") {
        npm run deploy:dev
    } elseif ($Stage -eq "staging") {
        npm run deploy:staging  
    } elseif ($Stage -eq "prod") {
        npm run deploy:prod
    } else {
        serverless deploy --stage $Stage --region $Region
        if ($LASTEXITCODE -ne 0) {
            throw "Serverless deployment failed"
        }
        
        # Upload templates manually for custom stages
        Write-Host "📤 Uploading CloudFormation templates..." -ForegroundColor Yellow
        node scripts/upload-templates.js
        if ($LASTEXITCODE -ne 0) {
            throw "Template upload failed"
        }
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