# Security model

## Assets protected

- Local files selected for transfer.
- Android device contents reachable through an authorized ADB session.
- Pairing codes and debugging addresses.
- The privilege boundary between the renderer and the desktop operating system.
- The backend bearer token.

## Trust assumptions

- The user controls the desktop computer and connected phone.
- ADB authorization is approved on the phone by the user.
- The locally installed ADB and scrcpy executables are obtained from trusted sources.
- The operating system account and GitHub release download channel are not compromised.

## Controls

### Loopback binding

The backend binds to `127.0.0.1`, not all interfaces. A device on the LAN cannot directly call the backend.

### Per-launch authentication

Electron creates a random 256-bit token for every launch. The token is passed only to the child process environment and Electron main process. It is not placed in local storage or exposed through the preload API.

### Renderer isolation

The renderer cannot import Node.js modules, start processes, or read arbitrary files. Native actions are performed through narrow IPC handlers.

### External process safety

Go uses `exec.Command` with an argument array rather than a shell command string. Device serials, package names, paths, and input values are passed as distinct arguments.

### User-mediated file access

Uploads and downloads use Electron native dialogs. The backend validates that selected local upload files exist and that a download destination is a directory.

### No remote update channel in the MVP

The application does not silently fetch executable updates. GitHub Releases are the distribution channel. Auto-update should not be added until packages are signed and release metadata is protected.

## Known risks

- ADB is intentionally powerful. Any computer authorized by the phone can access data and issue device commands within Android's debugging rules.
- A malicious or replaced `adb`/`scrcpy` executable can act with the user's desktop privileges.
- Unsigned packages can be replaced or trigger operating-system warnings.
- Text injection uses ADB input semantics and should not be used for secrets.
- Device screenshots can contain private information and remain visible in application memory while displayed.

## Recommended production hardening

- Sign Windows installers and executables.
- Sign and notarize macOS packages.
- Publish checksums and a software bill of materials.
- Add dependency scanning and CodeQL.
- Add explicit path allowlisting for bundled tool directories.
- Add rate limits and request-size limits per endpoint.
- Replace screenshot polling with an authenticated framed stream after a protocol review.
