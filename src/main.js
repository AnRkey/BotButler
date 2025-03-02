const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');

// Keep track of all window instances
const windows = new Set();

// Define the allowed URL patterns for internal handling
const allowedUrlPatterns = [
  /.*\.grok\.com.*/,
  /.*\.x\.ai.*/,
  /.*chat\.openai\.com.*/,
  /.*gemini\.google\.com.*/,
  /.*aistudio\.google\.com.*/,
  /.*claude\.ai.*/,
  /.*accounts\.google\.com.*/,
  /.*appleid\.apple\.com.*/,
  /.*auth0\.openai\.com.*/,
  /.*platform\.openai\.com.*/,
  /.*accounts\.google\.com.*/,
  /.*anthropic\.com.*/
];

function createWindow() {
  // Create the browser window
  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // Enable Node.js integration
      contextIsolation: false, // Disable context isolation for this use case
      webviewTag: true // Enable webview tag for tabs
    },
    icon: path.join(__dirname, 'botbutler.png')
  });

  // Add to our windows set
  windows.add(newWindow);

  // Disable the menu bar
  Menu.setApplicationMenu(null);

  // Load the index.html file
  newWindow.loadFile(path.join(__dirname, '../index.html'));

  // Open DevTools in development mode
  // newWindow.webContents.openDevTools();

  // Handle window closed event
  newWindow.on('closed', () => {
    // Remove from our set of windows when closed
    windows.delete(newWindow);
  });

  // Set up URL handling for this window
  setupUrlHandling(newWindow);

  // Set up IPC handlers specific to this window
  setupIpcHandlersForWindow(newWindow);
  
  return newWindow;
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    if (windows.size === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handle URL navigation and determine if URLs should be opened internally
function setupUrlHandling(window) {
  // Handle navigation events from webContents
  window.webContents.setWindowOpenHandler(({ url }) => {
    const shouldHandleInternally = allowedUrlPatterns.some(pattern => pattern.test(url));
    
    if (shouldHandleInternally) {
      // Allow creating a new tab/window within the app
      return { action: 'allow' };
    } else {
      // Open in external browser
      shell.openExternal(url);
      return { action: 'deny' };
    }
  });
}

// Set up global IPC handlers
function setupGlobalIpcHandlers() {
  // Create a new application window
  ipcMain.on('create-new-window', () => {
    createWindow();
  });
}

// Set up IPC handlers specific to a window instance
function setupIpcHandlersForWindow(window) {
  // Generate a unique ID for this window
  const windowId = Date.now().toString();
  
  // Store the window ID in the window object for reference
  window.windowId = windowId;
  
  // Handle always-on-top toggle for this specific window
  const toggleHandler = (event) => {
    // Only process if the event came from this window
    if (event.sender === window.webContents) {
      const isAlwaysOnTop = window.isAlwaysOnTop();
      window.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    }
    return false;
  };
  
  // Get current always-on-top state for this specific window
  const getStateHandler = (event) => {
    // Only process if the event came from this window
    if (event.sender === window.webContents) {
      return window.isAlwaysOnTop();
    }
    return false;
  };
  
  // Register handlers for this window
  window.toggleHandlerId = ipcMain.handle(`toggle-always-on-top-${windowId}`, toggleHandler);
  window.getStateHandlerId = ipcMain.handle(`get-always-on-top-${windowId}`, getStateHandler);
  
  // When window is closed, remove the handlers
  window.on('closed', () => {
    ipcMain.removeHandler(`toggle-always-on-top-${windowId}`);
    ipcMain.removeHandler(`get-always-on-top-${windowId}`);
  });
  
  // Send the window ID to the renderer process
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('set-window-id', windowId);
  });
}

// Set up the global IPC handlers
setupGlobalIpcHandlers(); 