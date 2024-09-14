import { app, BrowserWindow, screen } from "electron";
import path from "path";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;
let nodeServer;

// Function to start the backend server
function startNodeServer() {
  nodeServer = spawn("node", [path.join(__dirname, "../backend.js")], {
    stdio: "inherit", // Inherit the output to show in terminal
    shell: false,
    windowsHide: true, // Hide the terminal window
  });

  nodeServer.on("close", (code) => {
    console.log(`Node server exited with code ${code}`);
  });

  nodeServer.on("error", (error) => {
    console.error(`Node server error: ${error}`);
  });
}

// Function to create the Electron window
function createWindow() {
  // Get display size using Electron's screen module
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(800, width), // Set window width
    height: Math.min(1000, height), // Set window height
    center: true, // Center the window
    webPreferences: {
      nodeIntegration: false, // Keep this false for security
      contextIsolation: true, // Isolate context for security
    },
  });

  // Open DevTools for debugging (optional)
  mainWindow.webContents.openDevTools();
  mainWindow.removeMenu(); // Remove default menu bar
  const startUrl = isDev
    ? "http://localhost:5173" // Use local server for development
    : `file://${path.join(__dirname, "../build/index.html")}`; // Production build path

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(1); // Ensure zoom factor is 1
  });

  mainWindow.loadURL(startUrl);

  // Handle window close event
  mainWindow.on("closed", () => {
    if (nodeServer) {
      console.log("Closing node server...");
      nodeServer.kill("SIGTERM"); // Gracefully kill the backend server
    }
    mainWindow = null;
  });
}

// Electron app event handlers
app.on("ready", () => {
  createWindow();
  startNodeServer(); // Start backend server when app is ready
});

app.on("window-all-closed", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    nodeServer.kill("SIGTERM");
  }
  if (process.platform !== "darwin") {
    app.quit(); // Quit app unless on macOS
  }
});

app.on("before-quit", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    nodeServer.kill("SIGTERM"); // Kill backend server before quitting
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow(); // Recreate window on macOS when dock icon is clicked
  }
});

// Handle process signals for graceful shutdown
process.on("SIGINT", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    nodeServer.kill("SIGTERM");
  }
  process.exit();
});

process.on("SIGTERM", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    nodeServer.kill("SIGTERM");
  }
  process.exit();
});
