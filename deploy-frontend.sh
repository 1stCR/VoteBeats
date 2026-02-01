#!/bin/bash
# =============================================================================
# VoteBeats - Frontend Deployment Script (Firebase Hosting)
# =============================================================================
# This script builds the React app and deploys it to Firebase Hosting
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

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         VoteBeats Frontend Deployment (Firebase)             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if Firebase CLI is installed
echo -e "${YELLOW}[1/6] Checking Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: Firebase CLI not found. Installing...${NC}"
    npm install -g firebase-tools
fi
echo -e "${GREEN}✓ Firebase CLI found${NC}"
echo ""

# Step 2: Check Firebase login
echo -e "${YELLOW}[2/6] Checking Firebase authentication...${NC}"
if ! firebase projects:list &> /dev/null; then
    echo -e "${YELLOW}Please authenticate with Firebase:${NC}"
    firebase login
else
    echo -e "${GREEN}✓ Already authenticated${NC}"
fi
echo ""

# Step 3: Set Firebase project
echo -e "${YELLOW}[3/6] Setting Firebase project to ${PROJECT_ID}...${NC}"
firebase use ${PROJECT_ID}
echo -e "${GREEN}✓ Project set${NC}"
echo ""

# Step 4: Check if API URL is configured
echo -e "${YELLOW}[4/6] Checking production environment configuration...${NC}"
if grep -q "your-cloud-run-service-url" client/.env.production; then
    echo -e "${RED}Warning: API URL not configured in client/.env.production${NC}"
    echo -e "${YELLOW}Please update REACT_APP_API_URL with your Cloud Run service URL${NC}"
    echo -e "${YELLOW}You can get it by running: ./deploy-backend.sh${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Production environment configured${NC}"
fi
echo ""

# Step 5: Build React app
echo -e "${YELLOW}[5/6] Building React application for production...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 6: Deploy to Firebase Hosting
echo -e "${YELLOW}[6/6] Deploying to Firebase Hosting...${NC}"
firebase deploy --only hosting
echo -e "${GREEN}✓ Deployed to Firebase Hosting${NC}"
echo ""

# Get hosting URL
HOSTING_URL="https://votebeats-8a94c.web.app"
HOSTING_URL_ALT="https://votebeats-8a94c.firebaseapp.com"

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║             Frontend Deployment Successful!                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Hosting URLs:${NC}"
echo -e "  Primary:   ${HOSTING_URL}"
echo -e "  Alternate: ${HOSTING_URL_ALT}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Visit ${GREEN}${HOSTING_URL}${NC} to test your app"
echo -e "  2. Set up custom domain (optional) in Firebase Console:"
echo -e "     ${BLUE}https://console.firebase.google.com/project/${PROJECT_ID}/hosting${NC}"
echo ""
