# PowerShell script to upload CloudFormation templates to S3
param(
    [string]$Stage = "dev",
    [string]$Region = "ap-southeast-2"
)

Write-Host "🚀 Starting CloudFormation template upload..." -ForegroundColor Green
Write-Host "📍 Region: $Region"
Write-Host "📍 Stage: $Stage"

# Dynamic bucket name (matches serverless.yml pattern)
$BucketName = "onboard-templates-$Stage"
Write-Host "📍 Bucket: $BucketName"

# Set environment variables for the Node.js script
$env:STAGE = $Stage
$env:AWS_REGION = $Region

# Run the Node.js upload script
node scripts/upload-templates.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Templates uploaded successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Template upload failed!" -ForegroundColor Red
    exit 1
}