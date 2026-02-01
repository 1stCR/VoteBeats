# VoteBeats 🎵

A web-based DJ song request and voting platform that enables dance attendees to request and vote on songs before and during events, while giving DJs complete control over queue management, timing, and playback flow.

## 🌟 Features

- **Real-time Song Requests** - Attendees can search and request songs via iTunes API
- **Voting System** - Upvote favorite requests to help DJs prioritize
- **DJ Dashboard** - Complete event management, queue control, and analytics
- **Content Filtering** - Profanity and explicit content filters for family-friendly events
- **Now Playing** - Live updates for attendees during events
- **Spotify Integration** - Export playlists directly to Spotify
- **Desktop Helper** - Automatic "Now Playing" detection via Spotify monitoring
- **PWA Support** - Install on mobile devices for app-like experience
- **QR Code Access** - Easy event access for attendees

## 🚀 Live Demo

**Frontend:** https://votebeats-8a94c.web.app
**Backend API:** https://votebeats-api-461337995213.us-central1.run.app

## 🛠️ Technology Stack

### Frontend
- React.js (modern hooks, functional components)
- Tailwind CSS (mobile-responsive design)
- Firebase Authentication (DJ login)
- Firebase Hosting (global CDN)

### Backend
- Node.js + Express
- SQLite (with better-sqlite3)
- Google Cloud Run (containerized deployment)
- Firebase Cloud Functions

### Desktop Helper
- Electron (cross-platform)
- Spotify API integration

## 📋 Prerequisites

- Node.js 18+
- Google Cloud SDK
- Firebase CLI
- Docker (for backend deployment)

## 🏗️ Quick Start (Development)

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Set Up Environment Variables

```bash
# Copy example files
cp client/.env.example client/.env.local
cp server/.env.example server/.env

# Edit with your Firebase and Spotify credentials
```

### 3. Run Development Servers

```bash
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:3002

## 🚀 Deployment

### Quick Deploy (Everything)

```bash
./deploy-all.sh
```

### Deploy Backend Only

```bash
./deploy-backend.sh
```

### Deploy Frontend Only

```bash
./deploy-frontend.sh
```

### Pre-Deployment Check

```bash
./check-deployment-ready.sh
```

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 📖 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
- **[QUICK-DEPLOY.md](QUICK-DEPLOY.md)** - Quick reference for deployment
- **[CLAUDE.md](CLAUDE.md)** - Project assistant documentation

## 🎯 Use Cases

- Church youth dances
- School events
- Wedding receptions
- Private parties
- Club DJ sets
- Any event where attendees want to influence the playlist

## 🔐 Security Features

- JWT authentication for DJs
- Firebase Authentication integration
- Content Security Policy headers
- CORS configuration
- Input validation and sanitization
- Rate limiting on API endpoints
- Profanity and explicit content filtering

## 💰 Cost Estimates

Running on Google Cloud + Firebase:
- **Firebase Hosting:** Free tier (likely $0/month)
- **Cloud Run:** Pay-per-use (~$5-20/month)
- **Cloud Storage:** Database storage (~$0.02/GB/month)

**Total: ~$5-25/month** for moderate usage

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- iTunes API for music search
- Spotify Web API for playlist export
- Firebase for hosting and authentication
- Google Cloud Platform for backend infrastructure

## 📧 Support

For issues and feature requests, please use the GitHub Issues page.

---

**Built with ❤️ for DJs and music lovers**
