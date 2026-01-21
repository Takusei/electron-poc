const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess;

function loadAppConfig() {
  const configPath = path.join(__dirname, 'app.config.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (error) {
    console.warn(`Failed to load app.config.json: ${error.message}`);
  }
  return {};
}

function resolveBackendConfig() {
  const backendRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '../backend');

  const envFile = path.join(backendRoot, '.env');
  const backendBinaryName = process.platform === 'win32' ? 'backend.exe' : 'backend';
  const backendBinary = path.join(backendRoot, backendBinaryName);
  const backendDistBinary = path.join(backendRoot, 'dist', backendBinaryName);

  const selectedBinary = fs.existsSync(backendDistBinary)
    ? backendDistBinary
    : backendBinary;

  return {
    backendRoot,
    envFile,
    backendBinary: selectedBinary,
  };
}

function getBackendBaseUrl() {
  const host = process.env.BACKEND_HOST || '127.0.0.1';
  const port = process.env.BACKEND_PORT || '8000';
  return `http://${host}:${port}`;
}

async function waitForBackend({ timeoutMs = 20000, intervalMs = 500 } = {}) {
  const start = Date.now();
  const healthUrl = `${getBackendBaseUrl()}/api/v1/health`;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Backend not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

function startBackend() {
  const { backendRoot, envFile, backendBinary } = resolveBackendConfig();

  const hasBinary = fs.existsSync(backendBinary);
  const pythonCmd = process.env.BACKEND_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

  const command = hasBinary ? backendBinary : pythonCmd;
  const args = hasBinary ? [] : ['-m', 'app.entrypoint'];

  backendProcess = spawn(command, args, {
    cwd: backendRoot,
    env: {
      ...process.env,
      BACKEND_ENV_FILE: fs.existsSync(envFile) ? envFile : process.env.BACKEND_ENV_FILE,
      BACKEND_HOST: process.env.BACKEND_HOST || '127.0.0.1',
      BACKEND_PORT: process.env.BACKEND_PORT || '8000',
    },
    stdio: 'pipe',
  });

  backendProcess.stdout.on('data', (data) => {
    const message = `[backend] ${data}`;
    console.log(message);
  });

  backendProcess.stderr.on('data', (data) => {
    const message = `[backend] ${data}`;
    console.error(message);
  });

  backendProcess.on('exit', (code) => {
    const message = `Backend exited with code ${code}\n`;
    console.log(message);
  });

  backendProcess.on('error', (error) => {
    const message = `Backend spawn error: ${error.message}\n`;
    console.error(message);
  });
}

function createWindow() {
  const config = loadAppConfig();
  const devtoolsEnabled =
    process.env.ENABLE_DEVTOOLS === '1' || config.devtoolsEnabled === true;

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: devtoolsEnabled,
    },
  });

  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);

  // Show a loading screen while waiting for the backend
  win.loadFile(path.join(__dirname, 'loading.html'));

  if (devtoolsEnabled) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

app.whenReady().then(() => {
  startBackend();
  const win = createWindow();

  Menu.setApplicationMenu(null);

  waitForBackend().then((ready) => {
    if (!ready) {
      console.warn('Backend did not become ready before timeout.');
    }

    win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = createWindow();
    waitForBackend().then((ready) => {
      if (!ready) {
        console.warn('Backend did not become ready before timeout.');
      }

      win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
  }
});
