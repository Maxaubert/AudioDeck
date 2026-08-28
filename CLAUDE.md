# AudioDeck

## Build, test, release
- Typecheck/lint: `npm run typecheck` (no lint script)
- Unit: `npm test`
- E2E (headless): `npm run e2e`    Run when: src/renderer/**, electron/window.ts, electron/tray.ts
- Build / package: `npm run dist`   Artifact: `AudioDeck-Setup-x64-<version>.exe`
- First dist on a machine: `pwsh scripts/fetch-headsetcontrol.ps1`, `pwsh scripts/fetch-equalizerapo.ps1`, then publish audioctl per the notes in `audioctl/audioctl.csproj`
- Known failures to tolerate: none
- Version source: `package.json`   Release: release.yml on push to main
- Install locally after merge: `dist\AudioDeck-Setup-x64-<version>.exe /S`   Confirm version: Settings tab footer
- Deploy: installer via GitHub Releases
- Signing: unsigned (SignPath steps in release.yml are no-ops until the repo is enrolled)
