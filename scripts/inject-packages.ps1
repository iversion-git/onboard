# PowerShell script to inject packages
# Usage: .\scripts\inject-packages.ps1 [stage]
# Example: .\scripts\inject-packages.ps1 dev

param(
    [string]$Stage = "dev"
)

Write-Host "🚀 Injecting packages for stage: $Stage" -ForegroundColor Green
node scripts/inject-packages.js $Stage