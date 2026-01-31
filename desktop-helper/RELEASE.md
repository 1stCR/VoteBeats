# VoteBeats Desktop Helper - Release Process

## Prerequisites

- Node.js 18+ installed
- GitHub CLI (`gh`) or GitHub web UI access
- Code signing certificates (optional but recommended):
  - **Windows**: EV Code Signing Certificate
  - **Mac**: Apple Developer ID Certificate
- `GH_TOKEN` environment variable set with a GitHub Personal Access Token (repo scope)

## Version Bumping

1. Update version in `desktop-helper/package.json`:
   ```bash
   cd desktop-helper
   npm version patch   # for bug fixes (1.0.0 -> 1.0.1)
   npm version minor   # for features (1.0.0 -> 1.1.0)
   npm version major   # for breaking changes (1.0.0 -> 2.0.0)
   ```

2. Commit the version bump:
   ```bash
   git add package.json package-lock.json
   git commit -m "Bump desktop helper version to vX.Y.Z"
   git tag desktop-helper-vX.Y.Z
   git push && git push --tags
   ```

## Building Distributable Packages

### Windows (NSIS Installer)
```bash
cd desktop-helper
npm run build:win
```
Output: `desktop-helper/dist/VoteBeats Desktop Helper Setup X.Y.Z.exe`

### Mac (DMG)
```bash
cd desktop-helper
npm run build:mac
```
Output: `desktop-helper/dist/VoteBeats Desktop Helper-X.Y.Z.dmg`

### Both Platforms
```bash
cd desktop-helper
npm run build:all
```

## Publishing a GitHub Release

### Option A: Using electron-builder publish (Recommended)

Set the `GH_TOKEN` environment variable and use electron-builder's publish feature:

```bash
export GH_TOKEN=<your-github-personal-access-token>
cd desktop-helper

# Build and publish to GitHub Releases
npx electron-builder --win --publish always
npx electron-builder --mac --publish always
```

This automatically:
- Creates a GitHub Release (draft) with the version tag
- Uploads the installer files
- Generates `latest.yml` / `latest-mac.yml` for auto-updater

### Option B: Manual Release

1. Build the packages (see above)
2. Go to https://github.com/votebeats/desktop-helper/releases
3. Click "Create a new release"
4. Tag: `vX.Y.Z` (must match package.json version)
5. Title: `VoteBeats Desktop Helper vX.Y.Z`
6. Upload artifacts:
   - Windows: `.exe` installer + `latest.yml`
   - Mac: `.dmg` + `latest-mac.yml`
7. Write release notes describing changes
8. Publish the release

## Auto-Update Flow

Once a release is published on GitHub:

1. The desktop app checks for updates on startup via `autoUpdater.checkForUpdatesAndNotify()`
2. Users can also manually check via system tray > "Check for Updates"
3. If a new version is found:
   - Desktop notification: "Version X.Y.Z is available. Downloading..."
   - Progress bar shown in the app window
4. After download completes:
   - Desktop notification: "Update downloaded. Restart to apply."
   - "Restart & Update" button appears in the app
5. On next app quit (or clicking "Restart & Update"), the update is installed

## Configuration

The publish target is configured in `package.json`:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "votebeats",
      "repo": "desktop-helper"
    }
  }
}
```

## Troubleshooting

- **Update not detected**: Ensure the GitHub Release is published (not draft) and the tag matches the version format (`vX.Y.Z`)
- **Download fails**: Check network connectivity; errors are shown in the app and logged to console
- **Code signing warnings**: Unsigned builds may trigger OS security warnings; use proper code signing for production
- **`GH_TOKEN` errors**: Ensure the token has `repo` scope and is valid
