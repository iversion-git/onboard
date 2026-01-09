# PowerShell script to create initial administrator user using AWS CLI
param(
    [string]$Stage = "dev",
    [string]$Region = "us-east-1",
    [string]$Email = "fahad@flowrix.com",
    [string]$Password = "Password123"
)

# Configuration
$TableName = "onboard-staff-$Stage"
$StaffId = [System.Guid]::NewGuid().ToString()
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

Write-Host "🚀 Creating initial administrator user..." -ForegroundColor Green
Write-Host "Stage: $Stage"
Write-Host "Region: $Region"
Write-Host "Table: $TableName"
Write-Host "Email: $Email"
Write-Host ""

# Check if bcrypt is available (you'll need to install a bcrypt utility or use Node.js)
Write-Host "⚠️  Note: This script requires manual password hashing." -ForegroundColor Yellow
Write-Host "Please run the Node.js script instead for automatic password hashing:" -ForegroundColor Yellow
Write-Host "  node scripts/create-initial-admin.js" -ForegroundColor Cyan
Write-Host ""

# For reference, here's the AWS CLI command structure:
Write-Host "📋 AWS CLI command structure (requires pre-hashed password):" -ForegroundColor Blue
Write-Host ""
Write-Host "aws dynamodb put-item \\" -ForegroundColor Gray
Write-Host "  --region $Region \\" -ForegroundColor Gray
Write-Host "  --table-name $TableName \\" -ForegroundColor Gray
Write-Host "  --item '{" -ForegroundColor Gray
Write-Host "    `"staff_id`": {`"S`": `"$StaffId`"}," -ForegroundColor Gray
Write-Host "    `"email`": {`"S`": `"$($Email.ToLower())`"}," -ForegroundColor Gray
Write-Host "    `"password_hash`": {`"S`": `"<BCRYPT_HASH_HERE>`"}," -ForegroundColor Gray
Write-Host "    `"roles`": {`"SS`": [`"admin`"]}," -ForegroundColor Gray
Write-Host "    `"enabled`": {`"BOOL`": true}," -ForegroundColor Gray
Write-Host "    `"created_at`": {`"S`": `"$Timestamp`"}," -ForegroundColor Gray
Write-Host "    `"updated_at`": {`"S`": `"$Timestamp`"}" -ForegroundColor Gray
Write-Host "  }' \\" -ForegroundColor Gray
Write-Host "  --condition-expression 'attribute_not_exists(email)'" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 Recommended approach:" -ForegroundColor Green
Write-Host "  1. Run: npm install (if not already done)" -ForegroundColor White
Write-Host "  2. Run: node scripts/create-initial-admin.js" -ForegroundColor White
Write-Host "  3. Set environment variables if needed:" -ForegroundColor White
Write-Host "     - Set STAGE=$Stage" -ForegroundColor White
Write-Host "     - Set AWS_REGION=$Region" -ForegroundColor White