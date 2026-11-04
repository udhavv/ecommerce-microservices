Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Starting all 6 E-Commerce Microservices locally..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

node "$PSScriptRoot\dev-runner.js"
