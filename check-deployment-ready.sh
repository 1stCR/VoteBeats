#!/bin/bash
# =============================================================================
# VoteBeats - Deployment Readiness Check
# =============================================================================
# Run this script before deploying to verify all prerequisites are met
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           VoteBeats Deployment Readiness Check               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}[1/10] Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js installed: ${NODE_VERSION}${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo -e "${YELLOW}  Install from: https://nodejs.org/${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check npm
echo -e "${YELLOW}[2/10] Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm installed: ${NPM_VERSION}${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ npm not found${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check Firebase CLI
echo -e "${YELLOW}[3/10] Checking Firebase CLI...${NC}"
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version)
    echo -e "${GREEN}✓ Firebase CLI installed: ${FIREBASE_VERSION}${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ Firebase CLI not found${NC}"
    echo -e "${YELLOW}  Install: npm install -g firebase-tools${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check gcloud CLI
echo -e "${YELLOW}[4/10] Checking Google Cloud SDK...${NC}"
if command -v gcloud &> /dev/null; then
    GCLOUD_VERSION=$(gcloud --version | head -n 1)
    echo -e "${GREEN}✓ Google Cloud SDK installed: ${GCLOUD_VERSION}${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ Google Cloud SDK not found${NC}"
    echo -e "${YELLOW}  Install from: https://cloud.google.com/sdk/docs/install${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check gcloud authentication
echo -e "${YELLOW}[5/10] Checking Google Cloud authentication...${NC}"
if gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    echo -e "${GREEN}✓ Authenticated as: ${ACTIVE_ACCOUNT}${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ Not authenticated with Google Cloud${NC}"
    echo -e "${YELLOW}  Run: gcloud auth login${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check Firebase authentication
echo -e "${YELLOW}[6/10] Checking Firebase authentication...${NC}"
if firebase projects:list &> /dev/null; then
    echo -e "${GREEN}✓ Authenticated with Firebase${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ Not authenticated with Firebase${NC}"
    echo -e "${YELLOW}  Run: firebase login${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check Firebase project configuration
echo -e "${YELLOW}[7/10] Checking Firebase project configuration...${NC}"
if [ -f ".firebaserc" ]; then
    PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)
    if [ "$PROJECT_ID" = "votebeats-8a94c" ]; then
        echo -e "${GREEN}✓ Firebase project configured: ${PROJECT_ID}${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    elif [ "$PROJECT_ID" = "your-firebase-project-id" ]; then
        echo -e "${RED}✗ Firebase project not configured (still has placeholder)${NC}"
        echo -e "${YELLOW}  Update .firebaserc with your project ID${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    else
        echo -e "${GREEN}✓ Firebase project configured: ${PROJECT_ID}${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    fi
else
    echo -e "${RED}✗ .firebaserc not found${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check client environment configuration
echo -e "${YELLOW}[8/10] Checking client production environment...${NC}"
if [ -f "client/.env.production" ]; then
    if grep -q "your-production-firebase-api-key\|your-project-id\|your-cloud-run-service-url" client/.env.production; then
        echo -e "${YELLOW}⚠ Production environment has placeholder values${NC}"
        echo -e "${YELLOW}  Update client/.env.production with real values${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${GREEN}✓ Production environment configured${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    fi
else
    echo -e "${RED}✗ client/.env.production not found${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi
echo ""

# Check dependencies installed
echo -e "${YELLOW}[9/10] Checking dependencies...${NC}"
if [ -d "node_modules" ] && [ -d "client/node_modules" ] && [ -d "server/node_modules" ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ Some dependencies missing${NC}"
    echo -e "${YELLOW}  Run: npm run install:all${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi
echo ""

# Check billing enabled
echo -e "${YELLOW}[10/10] Checking Google Cloud billing...${NC}"
if gcloud beta billing projects describe votebeats-8a94c &> /dev/null; then
    echo -e "${GREEN}✓ Billing enabled for project${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ Unable to verify billing status${NC}"
    echo -e "${YELLOW}  Ensure billing is enabled: https://console.cloud.google.com/billing${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${GREEN}  Passed: ${CHECKS_PASSED}/10${NC}"
if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}  Failed: ${CHECKS_FAILED}/10${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          ✓ Ready to deploy!                                   ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Run: ${GREEN}./deploy-all.sh${NC} to deploy your application"
    echo ""
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ✗ Not ready to deploy - please fix issues above            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi
