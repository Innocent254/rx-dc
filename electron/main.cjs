const { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme } = require('electron');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { createWriteStream, existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const net = require('node:net');

let mainWindow;
let splashWindow;
let backendProcess;
let backendPort;
let backendToken;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 21743;
      server.close(() => resolve(port));
    });
  });
}

function backendExecutablePath() {
  const filename = process.platform === 'win32' ? 'rxdc-backend.exe' : 'rxdc-backend';
  return isDev
    ? join(__dirname, '..', 'build', 'backend', filename)
    : join(process.resourcesPath, 'backend', filename);
}

async function waitForBackend(timeoutMs = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/api/health`, {
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Backend did not become ready: ${lastError?.message ?? 'timeout'}`);
}

async function startBackend() {
  backendPort = await getFreePort();
  backendToken = randomBytes(32).toString('hex');
  const executable = backendExecutablePath();

  if (!existsSync(executable)) {
    throw new Error(`Backend executable is missing: ${executable}. Run npm run backend:build.`);
  }

  const logDir = app.getPath('logs');
  mkdirSync(logDir, { recursive: true });
  const logStream = createWriteStream(join(logDir, 'backend.log'), { flags: 'a' });

  backendProcess = spawn(executable, [], {
    env: {
      ...process.env,
      RXDC_PORT: String(backendPort),
      RXDC_AUTH_TOKEN: backendToken
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);
  backendProcess.once('exit', (code, signal) => {
    logStream.write(`\nBackend exited with code=${code} signal=${signal}\n`);
    mainWindow?.webContents.send('rxdc:backend-exit', { code, signal });
  });

  await waitForBackend();
}

async function backendRequest({ path, method = 'GET', body, responseType = 'json' }) {
  if (!backendPort || !backendToken) throw new Error('Backend is not ready');
  if (typeof path !== 'string' || !path.startsWith('/api/')) throw new Error('Invalid API path');

  const headers = { Authorization: `Bearer ${backendToken}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`http://127.0.0.1:${backendPort}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(11 * 60 * 1000)
  });

  const contentType = response.headers.get('content-type') ?? '';
  let data;
  if (responseType === 'dataUrl') {
    const bytes = Buffer.from(await response.arrayBuffer());
    data = `data:${contentType || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
  } else if (response.status === 204) {
    data = null;
  } else if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = data && typeof data === 'object' && data.error ? data.error : `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  splashWindow.loadFile(join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#08101b',
    title: 'R|X DC',
    icon: join(__dirname, 'icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? process.env.VITE_DEV_SERVER_URL : 'file://';
    if (!url.startsWith(allowed)) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    splashWindow?.close();
    splashWindow = null;
    mainWindow.show();
  });
}

function registerIpc() {
  ipcMain.handle('rxdc:request', (_event, request) => backendRequest(request));
  ipcMain.handle('rxdc:select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Choose files to send to your phone'
    });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle('rxdc:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose a destination folder'
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('rxdc:app-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    darkMode: nativeTheme.shouldUseDarkColors,
    logsPath: app.getPath('logs')
  }));
  ipcMain.handle('rxdc:open-logs', () => shell.openPath(app.getPath('logs')));
}

app.whenReady().then(async () => {
  registerIpc();
  createSplashWindow();
  try {
    await startBackend();
    createMainWindow();
  } catch (error) {
    splashWindow?.close();
    await dialog.showMessageBox({
      type: 'error',
      title: 'R|X DC could not start',
      message: 'The local backend could not be started.',
      detail: error instanceof Error ? error.message : String(error)
    });
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && backendProcess) createMainWindow();
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
});
