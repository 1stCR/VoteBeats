#!/bin/bash
# =============================================================================
# VoteBeats - Backend Deployment Script (Cloud Run)
# =============================================================================
# This script deploys the VoteBeats Express API to Google Cloud Run
# with persistent SQLite database storage.
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="votebeats-8a94c"
REGION="us-central1"
SERVICE_NAME="votebeats-api"
BUCKET_NAME="votebeats-sqlite-data"
SECRET_NAME="votebeats-jwt-secret"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           VoteBeats Backend Deployment (Cloud Run)           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if gcloud is installed
echo -e "${YELLOW}[1/9] Checking Google Cloud SDK...${NC}"
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: Google Cloud SDK not found. Please install it from:${NC}"
    echo -e "${RED}https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Google Cloud SDK found${NC}"
echo ""

# Step 2: Authenticate (if needed)
echo -e "${YELLOW}[2/9] Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}Please authenticate with Google Cloud:${NC}"
    gcloud auth login
else
    echo -e "${GREEN}✓ Already authenticated${NC}"
fi
echo ""

# Step 3: Set project
echo -e "${YELLOW}[3/9] Setting GCP project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}
echo -e "${GREEN}✓ Project set${NC}"
echo ""

# Step 4: Enable required APIs
echo -e "${YELLOW}[4/9] Enabling required Google Cloud APIs...${NC}"
gcloud services enable run.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    storage.googleapis.com \
    --quiet
echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Step 5: Create storage bucket for SQLite (if it doesn't exist)
echo -e "${YELLOW}[5/9] Setting up Cloud Storage bucket for SQLite database...${NC}"
if gcloud storage buckets describe gs://${BUCKET_NAME} &> /dev/null; then
    echo -e "${GREEN}✓ Bucket already exists: ${BUCKET_NAME}${NC}"
else
    echo -e "Creating bucket: ${BUCKET_NAME}"
    gcloud storage buckets create gs://${BUCKET_NAME} \
        --location=${REGION} \
        --uniform-bucket-level-access
    echo -e "${GREEN}✓ Bucket created${NC}"
fi
echo ""

# Step 6: Create JWT secret (if it doesn't exist)
echo -e "${YELLOW}[6/9] Setting up JWT secret in Secret Manager...${NC}"
if gcloud secrets describe ${SECRET_NAME} &> /dev/null; then
    echo -e "${GREEN}✓ Secret already exists: ${SECRET_NAME}${NC}"
else
    echo -e "Generating and storing JWT secret..."
    echo -n "$(openssl rand -hex 32)" | gcloud secrets create ${SECRET_NAME} --data-file=-
    echo -e "${GREEN}✓ Secret created${NC}"
fi
echo ""

# Step 7: Build Docker image
echo -e "${YELLOW}[7/9] Building Docker image...${NC}"
cd server
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME} --quiet
cd ..
echo -e "${GREEN}✓ Docker image built and pushed${NC}"
echo ""

# Step 8: Deploy to Cloud Run
echo -e "${YELLOW}[8/9] Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production,PORT=8080 \
    --update-secrets JWT_SECRET=${SECRET_NAME}:latest \
    --execution-environment gen2 \
    --cpu 1 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --quiet
echo -e "${GREEN}✓ Deployed to Cloud Run${NC}"
echo ""

# Step 9: Get service URL and update CORS
echo -e "${YELLOW}[9/9] Configuring service...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo -e "${GREEN}✓ Service URL: ${SERVICE_URL}${NC}"

# Update CORS with Firebase Hosting URLs
echo -e "${YELLOW}Updating CORS configuration...${NC}"
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --update-env-vars CORS_ORIGIN=https://votebeats-8a94c.web.app,https://votebeats-8a94c.firebaseapp.com,https://votebeats.com \
    --quiet
echo -e "${GREEN}✓ CORS configured${NC}"
echo ""

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Backend Deployment Successful!                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Service URL:${NC} ${SERVICE_URL}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Update client/.env.production with:"
echo -e "     ${BLUE}REACT_APP_API_URL=${SERVICE_URL}${NC}"
echo -e "  2. Run ${GREEN}./deploy-frontend.sh${NC} to deploy the frontend"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo ""
