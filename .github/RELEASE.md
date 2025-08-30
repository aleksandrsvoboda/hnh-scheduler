# Release Process

This project uses GitHub Actions for automated releases.

## Creating a Release

1. Go to the **Actions** tab in your GitHub repository
2. Select the **Release** workflow
3. Click **Run workflow**
4. Choose your options:
   - **Release type**: patch (0.1.1), minor (0.2.0), or major (1.0.0)
   - **Pre-release**: Check this box if it's a beta/alpha release
5. Click **Run workflow**

The workflow will:
- Bump the version in package.json
- Build the application for Windows, macOS, and Linux
- Create a GitHub release with all the built assets
- Generate release notes from CHANGELOG.md (if present)

## Release Assets

The following files are automatically built and attached to each release:

### Windows
- `HnH Scheduler Setup.exe` - NSIS installer (recommended)
- `HnH Scheduler.exe` - Portable executable

### macOS
- `HnH Scheduler.dmg` - DMG disk image

### Linux
- `HnH Scheduler.AppImage` - Universal Linux executable
- `hnh-scheduler_*_amd64.deb` - Debian/Ubuntu package

## Requirements

- The workflow runs on GitHub Actions runners
- Native dependencies (like keytar) are automatically rebuilt for each platform
- Python 3.11 is set up for native compilation support