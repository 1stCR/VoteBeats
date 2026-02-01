#!/bin/bash
# =============================================================================
# VoteBeats - Complete Deployment Script
# =============================================================================
# This script orchestrates the full deployment of VoteBeats:
#   1. Backend API to Google Cloud Run
#   2. Frontend React app to Firebase Hosting
#   3. Firestore security rules
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="votebeats-8a94c"
REGION="us-central1"

# Print banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║                ${BLUE}VoteBeats Deployment${CYAN}                         ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║         Complete deployment to production environment        ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Deployment options
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
DEPLOY_RULES=true
UPDATE_API_URL=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            DEPLOY_FRONTEND=false
            DEPLOY_RULES=false
            shift
            ;;
        --frontend-only)
            DEPLOY_BACKEND=false
            DEPLOY_RULES=false
            UPDATE_API_URL=false
            shift
            ;;
        --skip-backend)
            DEPLOY_BACKEND=false
            UPDATE_API_URL=false
            shift
            ;;
        --skip-frontend)
            DEPLOY_FRONTEND=false
            shift
            ;;
        --skip-rules)
            DEPLOY_RULES=false
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend-only      Deploy only the backend (Cloud Run)"
            echo "  --frontend-only     Deploy only the frontend (Firebase Hosting)"
            echo "  --skip-backend      Skip backend deployment"
            echo "  --skip-frontend     Skip frontend deployment"
            echo "  --skip-rules        Skip Firestore rules deployment"
            echo "  --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Deploy everything"
            echo "  $0 --backend-only     # Deploy only backend"
            echo "  $0 --skip-backend     # Deploy frontend and rules only"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# Show deployment plan
echo -e "${YELLOW}Deployment Plan:${NC}"
echo -e "  Backend (Cloud Run):      $([ "$DEPLOY_BACKEND" = true ] && echo "${GREEN}✓ Yes${NC}" || echo "${YELLOW}⊘ Skip${NC}")"
echo -e "  Frontend (Firebase):      $([ "$DEPLOY_FRONTEND" = true ] && echo "${GREEN}✓ Yes${NC}" || echo "${YELLOW}⊘ Skip${NC}")"
echo -e "  Firestore Rules:          $([ "$DEPLOY_RULES" = true ] && echo "${GREEN}✓ Yes${NC}" || echo "${YELLOW}⊘ Skip${NC}")"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1: BACKEND DEPLOYMENT
# ═════════════════════════════════════════════════════════════════════════════
if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                    PHASE 1: BACKEND                           ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Run backend deployment script
    chmod +x deploy-backend.sh
    ./deploy-backend.sh

    # Get the service URL
    SERVICE_URL=$(gcloud run services describe votebeats-api --region ${REGION} --format 'value(status.url)')

    # Update .env.production with the API URL
    if [ "$UPDATE_API_URL" = true ]; then
        echo -e "${YELLOW}Updating client/.env.production with backend URL...${NC}"
        sed -i.bak "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=${SERVICE_URL}|" client/.env.production
        echo -e "${GREEN}✓ API URL updated: ${SERVICE_URL}${NC}"
        echo ""
    fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2: FRONTEND DEPLOYMENT
# ═════════════════════════════════════════════════════════════════════════════
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                   PHASE 2: FRONTEND                           ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Run frontend deployment script
    chmod +x deploy-frontend.sh
    ./deploy-frontend.sh
fi

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3: FIRESTORE RULES
# ═════════════════════════════════════════════════════════════════════════════
if [ "$DEPLOY_RULES" = true ]; then
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                 PHASE 3: FIRESTORE RULES                      ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${YELLOW}Deploying Firestore security rules...${NC}"
    firebase deploy --only firestore:rules
    echo -e "${GREEN}✓ Firestore rules deployed${NC}"
    echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# DEPLOYMENT COMPLETE
# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║              🎉  DEPLOYMENT SUCCESSFUL!  🎉                   ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Display URLs
if [ "$DEPLOY_BACKEND" = true ]; then
    SERVICE_URL=$(gcloud run services describe votebeats-api --region ${REGION} --format 'value(status.url)' 2>/dev/null || echo "N/A")
    echo -e "${BLUE}Backend API:${NC}"
    echo -e "  ${SERVICE_URL}"
    echo ""
fi

if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "${BLUE}Frontend App:${NC}"
    echo -e "  https://votebeats-8a94c.web.app"
    echo -e "  https://votebeats-8a94c.firebaseapp.com"
    echo ""
fi

# Next steps
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "1. ${GREEN}Test your application:${NC}"
echo -e "   Visit: ${BLUE}https://votebeats-8a94c.web.app${NC}"
echo ""
echo -e "2. ${GREEN}Create your first DJ account:${NC}"
echo -e "   - Navigate to the Sign Up page"
echo -e "   - Use email/password authentication"
echo ""
echo -e "3. ${GREEN}Set up custom domain (optional):${NC}"
echo -e "   - Go to: ${BLUE}https://console.firebase.google.com/project/${PROJECT_ID}/hosting${NC}"
echo -e "   - Add custom domain (e.g., votebeats.com)"
echo -e "   - Update DNS records as instructed"
echo ""
echo -e "4. ${GREEN}Configure Spotify OAuth (optional):${NC}"
echo -e "   - Get credentials from: ${BLUE}https://developer.spotify.com/dashboard${NC}"
echo -e "   - Update server environment variables in Cloud Run"
echo ""
echo -e "5. ${GREEN}Monitor your services:${NC}"
echo -e "   Backend logs:  ${BLUE}gcloud run services logs read votebeats-api --region ${REGION}${NC}"
echo -e "   Hosting:       ${BLUE}https://console.firebase.google.com/project/${PROJECT_ID}/hosting${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Happy DJing! 🎵🎧${NC}"
echo ""
