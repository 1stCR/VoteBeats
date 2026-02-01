@echo off
REM Windows batch wrapper for deployment scripts
REM This ensures gcloud is in PATH for Windows users

SET PATH=C:\Users\Owner\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;%PATH%

bash -c "./deploy-all.sh %*"
