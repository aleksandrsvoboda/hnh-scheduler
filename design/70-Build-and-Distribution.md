## electron-builder config (OPTIMIZED - package.json snippet)
```json
{
"name": "hnh-scheduler",
"version": "0.1.0",
"main": "dist/main/app.js",
"build": {
"appId": "com.example.hnhscheduler",
"files": [
  "dist/main/**/*",
  "dist/renderer/**/*", 
  "dist/preload/**/*",
  "package.json",
  "!dist/win-unpacked/**/*",
  "!dist/*.exe",
  "!dist/*.7z",
  "!dist/*.yml",
  "!dist/*.yaml",
  "!dist/*.blockmap",
  "!**/*.map",
  "!**/node_modules/*/.cache/**/*",
  "!src/**/*",
  "!tsconfig.json",
  "!vite.config.ts",
  "!.git/**/*",
  "!.gitignore",
  "!README.md",
  "!CLAUDE.md"
],
"asar": true,
"directories": { "buildResources": "build" },
"win": { "target": ["nsis","portable"] },
"mac": { "target": ["dmg"] },
"linux": { "target": ["AppImage","deb"] }
},
"scripts": {
"dev": "concurrently \"tsc --watch\" \"vite\" \"electron dist/main/app.js\"",
"build": "tsc && vite build && electron-builder"
}
}
```

## ✅ SIZE OPTIMIZATION SUCCESS

**Problem Solved**: Massive 1.1GB+ installer size due to recursive file inclusion
- **Before**: 1.1GB installer, 5.3GB unpacked, 5.1GB corrupted asar
- **After**: 68MB installer, 238MB unpacked, 7.1MB clean asar
- **Reduction**: 94% smaller installer, 95% smaller unpacked size

**Root Cause**: 
- `"dist/**/*"` pattern included build artifacts recursively
- Temporary extraction directories were being re-included in builds
- No exclusions for development files, source maps, or build outputs

**Solution**:
- Specific inclusion of only essential compiled directories
- Explicit exclusions for build artifacts, dev files, and source code
- Proper build artifact cleanup between builds

## Signing / notarization (macOS)

- Optional if distributing broadly; otherwise can bypass for local installs.

## Autostart

- Optional toggle in Settings; use electron-auto-launch or OS-specific mechanisms.