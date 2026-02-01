# VoteBeats - Quick Deployment Reference

## ⚡ One-Command Deployment

```bash
./deploy-all.sh
```

## 📋 Before You Start

1. **Install Google Cloud SDK:**
   - Windows/Mac: https://cloud.google.com/sdk/docs/install
   - Verify: `gcloud --version`

2. **Authenticate:**
   ```bash
   gcloud auth login
   firebase login
   ```

3. **Enable billing** for project `votebeats-8a94c`:
   - https://console.cloud.google.com/billing

## 🎯 Deployment Commands

| Command | What it does |
|---------|-------------|
| `./deploy-all.sh` | Deploy everything (recommended) |
| `./deploy-backend.sh` | Deploy API to Cloud Run only |
| `./deploy-frontend.sh` | Deploy React app to Firebase only |
| `./deploy-all.sh --backend-only` | Backend + rules only |
| `./deploy-all.sh --frontend-only` | Frontend only |

## 🔗 Your URLs

- **Frontend:** https://votebeats-8a94c.web.app
- **Backend:** Will be provided after backend deployment
- **Firebase Console:** https://console.firebase.google.com/project/votebeats-8a94c

## 🛠️ Common Tasks

### View Backend Logs
```bash
gcloud run services logs tail votebeats-api --region us-central1
```

### Get Backend URL
```bash
gcloud run services describe votebeats-api --region us-central1 --format 'value(status.url)'
```

### Update Environment Variable
```bash
gcloud run services update votebeats-api \
  --region us-central1 \
  --update-env-vars KEY=VALUE
```

### Backup Database
```bash
gcloud storage cp gs://votebeats-sqlite-data/votebeats.db ./backup.db
```

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| Permission denied | `chmod +x deploy-*.sh` |
| gcloud not found | Install Google Cloud SDK |
| firebase not found | `npm install -g firebase-tools` |
| CORS errors | Check backend CORS_ORIGIN variable |
| Build memory errors | `export NODE_OPTIONS="--max-old-space-size=4096"` |

## 📞 Need Help?

See full documentation: [DEPLOYMENT.md](./DEPLOYMENT.md)
