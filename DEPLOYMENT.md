# VoteBeats Deployment Guide

This guide will help you deploy VoteBeats to production using Google Cloud Run (backend) and Firebase Hosting (frontend).

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ Node.js 18+ installed
- ✅ Firebase CLI installed (`npm install -g firebase-tools`)
- ✅ Google Cloud SDK installed (download from [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install))
- ✅ Firebase project created: `votebeats-8a94c`
- ✅ Google Cloud billing enabled for your project

## 🚀 Quick Start - Deploy Everything

The easiest way to deploy the entire application:

```bash
./deploy-all.sh
```

This will:
1. Deploy the backend API to Cloud Run
2. Automatically update the frontend with the backend URL
3. Build and deploy the frontend to Firebase Hosting
4. Deploy Firestore security rules

## 🔧 Step-by-Step Deployment

### Option 1: Deploy Backend Only

```bash
./deploy-backend.sh
```

This script will:
- Set up Google Cloud project
- Enable required APIs
- Create Cloud Storage bucket for SQLite database
- Generate and store JWT secret in Secret Manager
- Build Docker image
- Deploy to Cloud Run
- Configure CORS

**After deployment**, the script will output the backend URL. Copy it for the next step.

### Option 2: Deploy Frontend Only

```bash
./deploy-frontend.sh
```

**Before running**, make sure `client/.env.production` has the correct backend URL:
```env
REACT_APP_API_URL=https://votebeats-api-xxxxxxxxxx-uc.a.run.app
```

This script will:
- Build the React application for production
- Deploy to Firebase Hosting
- Output your live URLs

## 🎯 Deployment Script Options

The `deploy-all.sh` script supports several options:

```bash
# Deploy everything (default)
./deploy-all.sh

# Deploy only backend
./deploy-all.sh --backend-only

# Deploy only frontend
./deploy-all.sh --frontend-only

# Deploy frontend and rules, skip backend
./deploy-all.sh --skip-backend

# Skip Firestore rules deployment
./deploy-all.sh --skip-rules

# Show help
./deploy-all.sh --help
```

## 📝 Manual Configuration

### 1. Firebase Configuration

The following files have been pre-configured with your Firebase project:

- `.firebaserc` - Set to `votebeats-8a94c`
- `client/.env.production` - Firebase SDK configuration

### 2. Backend Environment Variables

The backend uses these environment variables (configured automatically):
- `NODE_ENV=production`
- `PORT=8080`
- `JWT_SECRET` - Stored in Secret Manager
- `CORS_ORIGIN` - Set to Firebase Hosting URLs

To add additional environment variables (like Spotify OAuth):

```bash
gcloud run services update votebeats-api \
  --region us-central1 \
  --update-env-vars SPOTIFY_CLIENT_ID=your-id,SPOTIFY_CLIENT_SECRET=your-secret
```

### 3. Custom Domain Setup

To use a custom domain (e.g., votebeats.com):

1. **Add domain in Firebase Console:**
   - Go to [Firebase Console → Hosting](https://console.firebase.google.com/project/votebeats-8a94c/hosting)
   - Click "Add custom domain"
   - Follow DNS verification steps

2. **Update CORS in backend:**
   ```bash
   gcloud run services update votebeats-api \
     --region us-central1 \
     --update-env-vars CORS_ORIGIN=https://votebeats.com,https://www.votebeats.com
   ```

3. **Update Spotify redirect URI** (if using Spotify):
   - Update in [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Add: `https://votebeats.com/api/spotify/callback`

## 🔍 Monitoring & Debugging

### View Backend Logs

```bash
# Real-time logs
gcloud run services logs tail votebeats-api --region us-central1

# Last 100 entries
gcloud run services logs read votebeats-api --region us-central1 --limit 100
```

### View Service Details

```bash
# Backend service info
gcloud run services describe votebeats-api --region us-central1

# Get service URL
gcloud run services describe votebeats-api --region us-central1 --format 'value(status.url)'
```

### Check Deployment Status

```bash
# Firebase hosting status
firebase hosting:channel:list

# Cloud Run services
gcloud run services list
```

## 🛠️ Database Management

The SQLite database is stored in Cloud Storage bucket `votebeats-sqlite-data`.

### Backup Database

```bash
# Download current database
gcloud storage cp gs://votebeats-sqlite-data/votebeats.db ./backup-$(date +%Y%m%d).db
```

### Restore Database

```bash
# Upload database backup
gcloud storage cp ./backup.db gs://votebeats-sqlite-data/votebeats.db
```

## 🔄 Updating Your Application

### Update Backend Only

```bash
# Make your code changes, then:
./deploy-backend.sh
```

### Update Frontend Only

```bash
# Make your code changes, then:
./deploy-frontend.sh
```

### Update Both

```bash
./deploy-all.sh
```

## 💰 Cost Estimates

### Firebase Hosting (Free Tier)
- Storage: 10 GB free
- Transfer: 360 MB/day free
- Typical cost: **$0/month** (within free tier)

### Cloud Run
- Charged per request and compute time
- Scales to zero (no cost when idle)
- Typical cost: **$5-20/month** for moderate usage

### Cloud Storage
- Database storage: ~$0.02/GB/month
- Typical cost: **< $1/month**

**Total estimated cost: $5-25/month** depending on traffic

## 🐛 Troubleshooting

### "Permission denied" errors
```bash
# Make scripts executable
chmod +x deploy-all.sh deploy-backend.sh deploy-frontend.sh
```

### "gcloud: command not found"
Install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install

### "firebase: command not found"
```bash
npm install -g firebase-tools
```

### Build fails with memory errors
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### CORS errors in production
Ensure backend CORS is configured with your hosting URLs:
```bash
gcloud run services update votebeats-api \
  --region us-central1 \
  --update-env-vars CORS_ORIGIN=https://votebeats-8a94c.web.app
```

## 📚 Additional Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)

## 🎵 Post-Deployment Checklist

After successful deployment:

- [ ] Visit https://votebeats-8a94c.web.app and verify it loads
- [ ] Create a DJ account via the signup page
- [ ] Create a test event
- [ ] Submit a song request as an attendee
- [ ] Test voting functionality
- [ ] Verify DJ dashboard works
- [ ] Check backend logs for any errors
- [ ] Set up monitoring alerts (optional)
- [ ] Configure custom domain (optional)
- [ ] Set up Spotify OAuth (optional)

---

**Need help?** Check the logs or refer to the troubleshooting section above.
