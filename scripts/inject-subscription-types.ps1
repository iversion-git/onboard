# PowerShell script to inject subscription types
# Usage: .\scripts\inject-subscription-types.ps1 [stage]
# Example: .\scripts\inject-subscription-types.ps1 dev

param(
    [string]$Stage = "dev"
)

Write-Host "🚀 Injecting subscription types for stage: $Stage" -ForegroundColor Green
node scripts/inject-subscription-types.js $Stage