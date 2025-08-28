## electron-builder config (example package.json snippet)
```
{
"name": "hnh-scheduler",
"version": "0.1.0",
"main": "dist/main/app.js",
"build": {
"appId": "com.example.hnhscheduler",
"files": ["dist/**/*", "package.json"],
"asar": true,
"directories": { "buildResources": "build" },
"win": { "target": ["nsis","portable"] },
"mac": { "target": ["dmg"] },
"linux": { "target": ["AppImage","deb"] }
},
"scripts": {
"dev": "vite-electron",
"build": "tsc -b && vite build && electron-builder"
}
}
```

## Signing / notarization (macOS)

- Optional if distributing broadly; otherwise can bypass for local installs.

## Autostart

- Optional toggle in Settings; use electron-auto-launch or OS-specific mechanisms.