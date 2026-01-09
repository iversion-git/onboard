# PowerShell script to inject all initial data (packages and subscription types)
# Usage: .\scripts\inject-all-data.ps1 [stage]
# Example: .\scripts\inject-all-data.ps1 dev

param(
    [string]$Stage = "dev"
)

Write-Host "🚀 Injecting all initial data for stage: $Stage" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Step 1: Injecting packages..." -ForegroundColor Yellow
node scripts/inject-packages.js $Stage

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🏷️  Step 2: Injecting subscription types..." -ForegroundColor Yellow
    node scripts/inject-subscription-types.js $Stage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 All data injection completed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Subscription types injection failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "❌ Packages injection failed!" -ForegroundColor Red
    exit 1
}