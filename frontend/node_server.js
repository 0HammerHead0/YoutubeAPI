import fs from 'fs';
import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cors from 'cors';
import open from 'open';
import path from 'path';

dotenv.config();

// Initialize Express app
const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// OAuth2 setup
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5000/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// File to store OAuth tokens
const TOKEN_PATH = path.resolve('youtube-oauth2.json');

// Global variable to store request info temporarily
let tempUploadRequest = null;

// Function to read OAuth token from file
function getTokenFromFile() {
  return new Promise((resolve, reject) => {
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return reject(err);
      resolve(JSON.parse(token));
    });
  });
}

// Function to save OAuth token to file
function saveTokenToFile(tokens) {
  return new Promise((resolve, reject) => {
    fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Start OAuth2 flow to get the authorization code
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Opening browser for OAuth2 authentication:', authUrl);

  // Automatically open the authorization URL in the user's browser
  open(authUrl);

  res.send('OAuth2 authorization started. Please complete the authentication in the opened browser window.');
});

// Handle OAuth2 callback and resume upload if needed
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    await saveTokenToFile(tokens); // Save token to file for future use

    res.send('Authentication successful! Resuming upload...');

    // If there was a pending upload, try to resume it
    if (tempUploadRequest) {
      const { reqBody, resObj } = tempUploadRequest;
      tempUploadRequest = null;  // Clear temp request
      
      // Resume the original upload
      return handleUpload(reqBody, resObj);
    }

  } catch (error) {
    console.error('Error retrieving access token', error);
    res.send('Error retrieving access token');
  }
});

// Middleware to ensure authentication is available before video upload
async function ensureAuthenticated(req, res, next) {
  try {
    const tokens = await getTokenFromFile(); // Try reading the token from file
    oauth2Client.setCredentials(tokens); // Set the credentials in the client
    next(); // Continue with the request
  } catch (err) {
    console.log('No token found, starting OAuth flow...');
    tempUploadRequest = { reqBody: req, resObj: res };  // Store request info for later
    res.redirect('/auth');  // Redirect to OAuth2 authentication
  }
}

// Route for handling video upload (using Multer to get the file)
app.post('/upload', upload.single('video'), ensureAuthenticated, async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No video file uploaded.');
  }
  
  tempUploadRequest = { reqBody: req, resObj: res };
  await handleUpload(req, res); // Handle the upload after authentication
});

// Function to handle the actual video upload to YouTube
async function handleUpload(req, res) {
  const filePath = req.file.path;
  const { title, description, category, keywords, privacyStatus } = req.body;

  // Set the credentials for the YouTube API
  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  try {
    // Upload the video to YouTube
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
          privacyStatus: privacyStatus || 'private', // Default to private
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    console.log('Video uploaded successfully:', response.data);

    // Ensure that only one response is sent to the client
    if (!res.headersSent) {
      return res.json({ status: 'Video uploaded successfully', data: response.data });
    }

  } catch (error) {
    console.error('Error uploading video:', error);

    // Ensure that only one error response is sent
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error uploading video' });
    }
  }
}

// Start server
app.listen(5000, () => {
  console.log('Server started on http://localhost:5000');
});
