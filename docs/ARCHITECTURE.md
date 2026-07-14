# Architecture

## Overview

R|X DC is a two-process desktop application:

1. **Electron/React desktop process** — window management, native file/folder dialogs, renderer sandbox, and user interface.
2. **Go local backend** — Android Debug Bridge orchestration, device state, file transfer, screen capture, input commands, and activity history.

Electron starts the backend as a child process for each application launch.

```text
┌──────────────────────────────────────────────────────────┐
│ Electron main process                                    │
│  - chooses a free loopback port                          │
│  - generates a random bearer token                       │
│  - starts rxdc-backend                                   │
│  - exposes narrow IPC methods through preload            │
└───────────────┬──────────────────────────────────────────┘
                │ authenticated HTTP on 127.0.0.1
┌───────────────▼──────────────────────────────────────────┐
│ Go backend                                               │
│  - REST API                                              │
│  - ADB and optional scrcpy process adapter               │
│  - short-lived in-memory activity store                  │
└───────────────┬──────────────────────────────────────────┘
                │ local adb/scrcpy executables
┌───────────────▼──────────────────────────────────────────┐
│ Authorized Android device                                │
│  - USB debugging or Wireless debugging                   │
└──────────────────────────────────────────────────────────┘
```

## Electron security model

The renderer runs with:

- `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- a restrictive Content Security Policy;
- no direct access to backend credentials.

The preload layer exposes only these operations:

- authenticated API request to an `/api/` path;
- file picker;
- folder picker;
- application diagnostics;
- opening the logs directory;
- backend-exit notification.

## Backend lifecycle

1. Electron asks the operating system for an unused local port.
2. Electron creates a 32-byte random token.
3. Electron starts the backend with `RXDC_PORT` and `RXDC_AUTH_TOKEN`.
4. Electron polls `/api/health` until the service is ready.
5. Renderer requests cross the preload IPC boundary.
6. Electron adds the token and forwards the request to the loopback backend.
7. On application shutdown, Electron terminates the child process.

## Backend API groups

| Group | Purpose |
|---|---|
| `/api/status`, `/api/dependencies` | Runtime health and tool detection |
| `/api/devices` | ADB device list and detailed device properties |
| `/api/devices/{serial}/screenshot` | PNG screen capture using `adb exec-out screencap` |
| `/api/input/*` | Tap, swipe, key event, and text injection |
| `/api/files/*` | ADB push and pull |
| `/api/apps/*` | User package listing and launcher invocation |
| `/api/pair`, `/api/connect`, `/api/disconnect` | Android Wireless debugging |
| `/api/discovery` | ADB mDNS service discovery |
| `/api/session/start` | Optional scrcpy process launch |
| `/api/activity` | In-memory user-visible operation history |

## Packaging

The Node build script cross-compiles the Go backend with `CGO_ENABLED=0`, using the `GOOS` and `GOARCH` environment variables supplied by GitHub Actions. Electron Builder then packages that matching backend as an `extraResource`.

Each matrix job handles exactly one operating-system/architecture pair so an ARM64 package never receives an x64 backend.

## Deliberate non-goals for the MVP

- No cloud account or remote control relay.
- No telemetry or analytics.
- No Android security bypass.
- No silent enabling of Developer options or USB debugging.
- No claim of native DeX parity.
- No persistent storage of device serials, pairing codes, or tokens.
