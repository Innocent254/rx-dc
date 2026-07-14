# Troubleshooting

## The app says “ADB not found”

Install Android Platform Tools, then either:

- add the platform-tools directory to `PATH`; or
- set `RXDC_ADB_PATH` to the absolute `adb`/`adb.exe` path before starting R|X DC.

Common locations:

- Windows: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
- macOS: `~/Library/Android/sdk/platform-tools/adb`
- Linux: `~/Android/Sdk/platform-tools/adb`

Confirm in a terminal:

```bash
adb version
adb devices -l
```

## The phone appears as `unauthorized`

Unlock the phone and approve the USB debugging RSA prompt. If no prompt appears:

1. Disconnect the cable.
2. In Developer options, revoke USB debugging authorizations.
3. Turn USB debugging off and on.
4. Reconnect with a data-capable cable.
5. Run `adb kill-server`, then reopen R|X DC.

## The phone does not appear over USB

- Try another cable and USB port.
- Change the phone USB mode from charging-only to file transfer.
- Install the correct Windows USB driver when applicable.
- Verify the computer sees the device in `adb devices -l`.

## Wireless pairing succeeds but connection fails

The pairing port and connection port are usually different. Return to Android Wireless debugging and use the IP/port shown on the main screen for **Connect**, not the temporary pairing port.

Wireless debugging may assign a new port after Wi-Fi changes or a phone restart.

## Desktop window says scrcpy is missing

Install scrcpy and ensure its executable is in `PATH`, or set `RXDC_SCRCPY_PATH` to the absolute executable path. The rest of R|X DC does not require scrcpy.

## The preview is blank or slow

- Keep the device unlocked.
- Confirm `adb -s SERIAL exec-out screencap -p` returns an image.
- Wireless debugging latency can make polling slower than USB.
- Protected video and some secure surfaces may render black by Android design.

## File transfer fails

- Use a writable Android destination such as `/sdcard/Download/`.
- Confirm the phone has free storage.
- Avoid removing the cable or changing Wi-Fi during transfer.
- Check the backend log from **Settings → Open logs folder**.

## GitHub installer job fails

1. Open the failed matrix job and identify the platform/architecture.
2. Re-run failed jobs once if the failure is a transient download error.
3. Confirm `package-lock.json` is committed.
4. Confirm the selected Node and Go versions satisfy `package.json` and `backend/go.mod`.
5. Review Electron Builder output for signing, packaging-tool, or target support errors.

## Unsigned installer warning

Unsigned Windows and macOS packages can trigger SmartScreen or Gatekeeper warnings. This is expected for development builds. Do not advise users to disable operating-system protections globally. Production releases should be code-signed and notarized.
