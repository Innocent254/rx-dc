# R|X DC

**R|X DC — Xiaomi & Redmi Desktop Companion** is an independent, local-first desktop application for authorized Android devices. It combines a polished Electron/React interface with a small Go backend.

The repository builds installable Windows, macOS, and Linux packages automatically with GitHub Actions on every push. Tagged versions such as `v1.0.0` are published as GitHub Releases.

> **Project status:** working MVP. USB/wireless ADB discovery, device details, interactive screen snapshots, input actions, app launching, file transfer, and text injection are implemented. The optional external desktop window uses scrcpy. Native Samsung DeX-equivalent behavior is not possible through an ordinary desktop application alone; it requires an Android-side privileged desktop shell or OEM firmware support.

## What works

- Local Go service bound only to `127.0.0.1`.
- Random per-launch bearer token between Electron and the backend.
- USB ADB device discovery and details.
- Android Wireless debugging pairing, connection, discovery, and disconnection.
- Interactive local screenshot preview with tap, Back, Home, and Recent controls.
- Launching user-installed Android apps.
- Sending files to `/sdcard/Download/` and pulling phone paths to the computer.
- Text injection into the currently focused Android field.
- Optional scrcpy desktop-control window.
- Windows NSIS installers, macOS DMG/ZIP packages, and Linux AppImage/DEB packages through CI.
- x64 and ARM64 build jobs.

## Requirements

For development:

- Node.js 22.12 or newer.
- Go 1.23 or newer.
- Git.

For phone features:

- Android Platform Tools (`adb`) installed and available in `PATH`, an Android SDK folder, or `RXDC_ADB_PATH`.
- `scrcpy` is optional. Install it or set `RXDC_SCRCPY_PATH` to enable **Open desktop window**.
- USB debugging or Wireless debugging enabled on an Android device you own or are authorized to control.

The installed R|X DC application does not use a cloud service. Phone operations continue to work offline after the required local Android tools are installed.

## Start locally

```bash
git clone https://github.com/Innocent254/rxdc.git
cd rx-dc
npm install
npm run dev
```

The development command starts Vite, Electron, and the compiled local backend. Run this once first if the backend binary does not yet exist:

```bash
npm run backend:build
```

## Validate the repository

```bash
npm test
npm run build
```

`npm test` runs the Go tests and TypeScript type checker. `npm run build` compiles the Go service and production renderer.

## Build an installer locally

Build for the current operating system and CPU architecture:

```bash
npm run dist
```

Useful explicit examples:

```bash
npm run dist -- --win --x64
npm run dist -- --mac --arm64
npm run dist -- --linux --x64
```

Artifacts are written to `release/`. The first installer build needs internet access because Electron Builder downloads the matching Electron runtime and platform packaging tools.

## Automatic GitHub builds

Three workflows are included:

| Workflow | Trigger | Result |
|---|---|---|
| `Validate` | Every push and pull request | Go tests, TypeScript checks, production source build |
| `Build installers` | Every push, pull request, or manual run | Windows, macOS, and Linux installer artifacts for x64 and ARM64 |
| `Publish release` | Push a tag matching `v*` | Creates a GitHub Release containing all installer artifacts |

After pushing code, open **Actions → Build installers → latest run** and download the artifact for the required platform. See [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) for beginner-friendly push and release steps.

To publish version `1.0.0`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

No GitHub secret is required for unsigned builds. Production distribution should add Windows code signing and Apple signing/notarization credentials as repository secrets.

## Phone connection

### USB

1. Open **Settings → About phone** and tap the OS/build version repeatedly to enable Developer options.
2. Open **Developer options** and enable **USB debugging**.
3. Connect the phone by USB.
4. Approve the RSA authorization prompt on the phone.
5. Open R|X DC and press Refresh.

### Wireless debugging

1. Put the computer and phone on the same trusted network.
2. On Android, open **Developer options → Wireless debugging**.
3. Select **Pair device with pairing code**.
4. In R|X DC, open **Devices → Enter pairing code** and enter the pairing address and code.
5. Enter the separate connection address shown by Android and select **Connect**.

Pairing and connection ports can be different. Use the exact values displayed by Android.

## Environment variables

| Variable | Purpose |
|---|---|
| `RXDC_ADB_PATH` | Absolute path to `adb` |
| `RXDC_SCRCPY_PATH` | Absolute path to `scrcpy` |
| `RXDC_PORT` | Backend port; assigned automatically by Electron |
| `RXDC_AUTH_TOKEN` | Local IPC bearer token; generated automatically by Electron |

## Repository structure

```text
rx-dc/
├── .github/workflows/       GitHub validation, installer, and release automation
├── backend/                 Go local service and ADB integration
├── build/                   Application icons and generated backend binary
├── docs/                    Architecture, security, roadmap, and troubleshooting
├── electron/                Secure Electron main/preload processes and splash screen
├── scripts/                 Cross-platform backend build script
├── src/                     React/TypeScript desktop interface
├── package.json             Build and Electron Builder configuration
└── README.md
```

## Security boundaries

- The backend listens on loopback only.
- Electron generates a new 256-bit token each launch.
- The renderer has no Node.js access.
- Context isolation and renderer sandboxing are enabled.
- API paths are allow-scoped to `/api/` through the preload bridge.
- R|X DC never enables Android debugging automatically and never bypasses the device authorization prompt.

See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) and [SECURITY.md](SECURITY.md).

## Important limitation

Samsung DeX is an OEM-integrated Android desktop environment. A normal third-party desktop application cannot reproduce all of it merely by connecting to a phone. This repository provides a legitimate local transport, control, file, app, and UI foundation. Future native desktop-shell work must be implemented on Android using permitted APIs, user-granted services, or supported OEM interfaces. The project will not include security bypasses, hidden Xiaomi APIs obtained unlawfully, or unauthorized firmware modification.

## Legal

R|X DC is unofficial and is not affiliated with Xiaomi Corporation, Redmi, Google, Samsung, or the scrcpy project. Trademarks belong to their respective owners.

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
