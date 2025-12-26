@echo off
echo AWS Lambda Control Plane - Simple Deploy Script
echo ================================================

echo Reading configuration from deployment-config.yml...

REM Deploy using serverless (it will read the config automatically)
echo Deploying to AWS...
serverless deploy --profile node
if %errorlevel% neq 0 (
    echo ERROR: Deployment failed
    pause
    exit /b 1
)

echo.
echo ✅ Deployment completed successfully!
echo.
echo Getting deployment info...
serverless info --profile node

echo.
echo 🎉 Your API is now deployed and ready to use!
echo.
pause