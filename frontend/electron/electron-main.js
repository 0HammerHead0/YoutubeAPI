import { app, BrowserWindow, screen } from "electron";
import path from "path";
import fs from "fs";
import isDev from "electron-is-dev";
import { fileURLToPath } from "url";
import express from "express";
import multer from "multer";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import open from "open";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Adjust the ffmpeg path for packaged Electron apps
let resolvedFfmpegPath = ffmpegPath;
if (!isDev) {
  // In production, we need to reference the app.asar.unpacked directory
  resolvedFfmpegPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
}
ffmpeg.setFfmpegPath(resolvedFfmpegPath);
// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let nodeServer;

const logFilePath = path.join(app.getPath('userData'), 'log.txt');

// Path to different OAuth2 token files for each account
const oauthFiles = {
  // 'i-msg': path.resolve(__dirname, 'oauth2-i-msg.json'),
  'i-msg' : isDev
    ? path.resolve(__dirname, 'oauth2-i-msg.json') // Use local server for development
    : path.resolve(__dirname, '../../oauth2-i-msg.json'), // Production build path
  // 'streamer-clips': path.resolve(__dirname, 'oauth2-streamer-clips.json'),
  // 'female-streamers': path.resolve(__dirname, 'oauth2-female-streamers.json'),
  // 'reddit': path.resolve(__dirname, 'oauth2-reddit.json'),
  // 'podcasts-clips': path.resolve(__dirname, 'oauth2-podcasts-clips.json'),
  // 'random-meme-dump': path.resolve(__dirname, 'oauth2-random-meme-dump.json'),
  'streamer-clips' : isDev
    ? path.resolve(__dirname, 'oauth2-streamer-clips.json') // Use local server for development
    : path.resolve(__dirname, '../../oauth2-streamer-clips.json'), // Production
  'female-streamers' : isDev
    ? path.resolve(__dirname, 'oauth2-streamer-clips.json') // Use local server for development
    : path.resolve(__dirname, '../../oauth2-streamer-clips.json'), // Production
  'reddit' : isDev
    ? path.resolve(__dirname, 'oauth2-reddit.json') // Use local server for development
    : path.resolve(__dirname, '../../oauth2-reddit.json'), // Production
  'podcasts-clips' : isDev
    ? path.resolve(__dirname, 'oauth2-podcasts-clips.json') // Use local server for development
    : path.resolve(__dirname, '../../oauth2-podcasts-clips.json'), // Production
  'random-meme-dump' : isDev
    ? path.resolve(__dirname, 'oauth2-random-meme-dump.json') // Use local server for development
    : path.resolve(__dirname, '../../oauth2-random-meme-dump.json'), // Production

};

// Ensure the log file is created or appended to
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
}
// Initialize Express app
function initializeBackend() {
  const app = express();
  // const envPath = path.resolve(__dirname, '../.env');
  const envPath = isDev
    ? path.resolve(__dirname, '../.env') // Use local server for development
    : path.resolve(__dirname, '../../.env'); // Production build path
  // logStream.write(`Loading environment variables from: ${envPath}\n`);
  log(`Loading environment variables from: ${envPath}`);
  dotenv.config({ path: envPath });

  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const upload = multer({ dest: 'uploads/' });

  // OAuth2 setup
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REDIRECT_URI = 'http://localhost:5000/oauth2callback';
  const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const TOKEN_PATH = path.resolve('youtube-oauth2.json');

  let tempUploadRequest = null;

  // Utility functions for OAuth token handling for multiple accounts
  function getTokenFromFile(oauthId) {
    const tokenPath = oauthFiles[oauthId]; // Select the correct file based on oauthId
    console.log(`Reading token from file: ${tokenPath}`);
    log(`Reading token from file: ${tokenPath}`);
    return new Promise((resolve, reject) => {
      fs.readFile(tokenPath, (err, token) => {
        if (err) return reject(err);
        resolve(JSON.parse(token));
      });
    });
  }

  function saveTokenToFile(tokens, oauthId) {
    const tokenPath = oauthFiles[oauthId]; // Save the token to the correct file
    console.log(`Saving token to file: ${tokenPath}`);
    log(`Saving token to file: ${tokenPath}`);
    return new Promise((resolve, reject) => {
      fs.writeFile(tokenPath, JSON.stringify(tokens), (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // OAuth2 flow
  app.get('/auth/:oauthId', (req, res) => {
    const oauthId = req.params.oauthId;
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    open(authUrl);
    tempUploadRequest = { oauthId };
    res.send('OAuth2 flow started, please complete the authentication in the browser.');
    log(`OAuth2 flow started for account: ${oauthId}`);
  });

  app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    log(`OAuth callback triggered with code: ${code}`);
    try {
      const { tokens } = await oauth2Client.getToken(code);
      log(`Tokens received: ${JSON.stringify(tokens)}`);
      oauth2Client.setCredentials(tokens);
      const oauthId = tempUploadRequest.oauthId;
      await saveTokenToFile(tokens, oauthId);
      log(`Authentication successful for account: ${oauthId}`);
      res.send("Authentication successful!");
    } catch (error) {
      console.error('Error during OAuth callback:', error);
      log(`OAuth callback failed with error: ${error}`);
      res.status(500).send("OAuth callback failed.");
    }
  });
  

  // Middleware to check authentication before video upload
  async function ensureAuthenticated(req, res, next) {
    const oauthId = req.params.oauthId;
    try {
      const tokens = await getTokenFromFile(req.params.oauthId);
      oauth2Client.setCredentials(tokens);
      next();
    } catch (err) {
      res.redirect(`/auth/${req.params.oauthId}`);
    }
  }

  // Handle video upload
  app.post('/upload/:oauthId', upload.single('video'), ensureAuthenticated, async (req, res) => {
    // const filePath = path.resolve(__dirname, req.file.path);
    // const filePath = path.join(__dirname, '../' ,req.file.path);
    log(`FFmpeg path: ${resolvedFfmpegPath}`);

    const filePath = isDev
      ? path.resolve(__dirname, '../', req.file.path) // Use local server for development
      : path.resolve(__dirname, '../../../', req.file.path); // Production build path
    const fileMIMEType = req.file.mimetype;
    console.log('Temporary file saved at:', filePath);
    log(`Temporary file saved at: ${filePath}`);
    const { title, description, category, keywords, privacyStatus } = req.body;
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
      // Process video with FFmpeg (as per your backend.js logic)
      const clippedFilePath = await processVideo(filePath,fileMIMEType);
      console.log('Clipped file saved at:', clippedFilePath);
      log(`Clipped file saved at: ${clippedFilePath}`);
      const response = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: title,
            description: description,
            tags: keywords.split(','),
            categoryId: category,
          },
          status: {
            privacyStatus: privacyStatus || 'private',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(clippedFilePath),
        },
      });

      console.log('Video uploaded successfully:', response.data);
      log('Video uploaded successfully');
      res.json({ status: 'Video uploaded successfully', data: response.data });
      const extension = getExtensionFromMIME(fileMIMEType);
      fs.unlink(`${filePath}.${extension}`, () => {});
      fs.unlink(clippedFilePath, () => {});
    } catch (error) {
      console.error('Error uploading video:', error);
      log(`Error uploading video ${error}`);
      res.status(500).json({ error: 'Error uploading video' });
    }
  });

  app.listen(5000, () => {
    console.log('Backend server running at http://localhost:5000');
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
  // mainWindow.webContents.openDevTools();
  mainWindow.removeMenu(); // Remove default menu bar
  const startUrl = isDev
    ? "http://localhost:5173" // Use local server for development
    : `file://${path.join(__dirname, "../dist/index.html")}`; // Production build path

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(1); // Ensure zoom factor is 1
  });
  mainWindow.loadURL(startUrl);
  
  // Handle window close event
  mainWindow.on("closed", () => {
    if (nodeServer) {
      console.log("Closing node server...");
      log("Closing node server...");
      nodeServer.kill("SIGTERM"); // Gracefully kill the backend server
    }
    mainWindow = null;
  });
}

// Utility function to map MIME types to file extensions
function getExtensionFromMIME(mimeType) {
  const mimeToExt = {
    'video/mp4': 'mp4',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'video/avi': 'avi',
    'video/mpeg': 'mpg',
  };
  return mimeToExt[mimeType] || null;
}

// FFmpeg video processing function
async function processVideo(filePath, fileMIMEType) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.error('Input file does not exist:', filePath);
      log(`Input file does not exist: ${filePath}`);
      return reject(new Error('Input file does not exist'));
    }

    // Determine the correct extension based on the file MIME type
    const extension = getExtensionFromMIME(fileMIMEType);
    if (!extension) {
      console.error('Unsupported MIME type:', fileMIMEType);
      log(`Unsupported MIME type: ${fileMIMEType}`);
      return reject(new Error('Unsupported file type'));
    }

    // Rename the file to include the correct extension
    const newFilePath = `${filePath}.${extension}`;
    fs.renameSync(filePath, newFilePath);  // Rename the file to include the extension

    // const clippedFilePath = path.resolve(__dirname, '../uploads', 'clipped_' + path.basename(newFilePath));
    const clippedFilePath = isDev
      ? path.resolve(__dirname, '../uploads', 'clipped_' + path.basename(newFilePath))
      : path.resolve(__dirname, '../../../uploads', 'clipped_' + path.basename(newFilePath));


    // const uploadDir = path.resolve(__dirname, '../uploads');
    const uploadDir = isDev
      ? path.resolve(__dirname, '../uploads')
      : path.resolve(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    console.log('Processing video with FFmpeg:', newFilePath, '->', clippedFilePath);  // Log paths
    log(`Processing video with FFmpeg: ${newFilePath} -> ${clippedFilePath}`);

    const command = ffmpeg()
      .input(newFilePath)  // Use the file with the correct extension
      .setStartTime('00:00:00')
      .setDuration(59.028)
      .output(clippedFilePath);  // Output file

    // Log the full FFmpeg command for debugging
    console.log('FFmpeg command:', command._getArguments().join(' '));

    command.on('end', () => {
      console.log('Video processing finished.');
      log('Video processing finished.');
      resolve(clippedFilePath);
    }).on('error', (err) => {
      console.error('Error processing video:', err);
      log('Error processing video.'+err);
      reject(err);
    }).run();
  });
}




// Electron app event handlers
app.on("ready", () => {
  createWindow();
  initializeBackend(); // Initialize Express backend
});

app.on("window-all-closed", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    log("Closing node server...");
    nodeServer.kill("SIGTERM");
  }
  if (process.platform !== "darwin") {
    app.quit(); // Quit app unless on macOS
  }
});

app.on("before-quit", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    log("Closing node server...");
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
    log("Closing node server...");
    nodeServer.kill("SIGTERM");
  }
  process.exit();
});

process.on("SIGTERM", () => {
  if (nodeServer) {
    console.log("Closing node server...");
    log("Closing node server...");
    nodeServer.kill("SIGTERM");
  }
  process.exit();
});
