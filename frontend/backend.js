import fs from 'fs';
import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cors from 'cors';
import open from 'open';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';

// Create __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Set the path to your .env file
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// Initialize Express app
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


// Global variable to store request info temporarily
let tempUploadRequest = null;

// Path to different o-auth2 files
const oauthFiles = {
  'i-msg': path.resolve('oauth2-i-msg.json'),
  'streamer-clips': path.resolve('oauth2-streamer-clips.json'),
  'female-streamers': path.resolve('oauth2-female-streamers.json'),
  'reddit': path.resolve('oauth2-reddit.json'),
  'podcasts-clips': path.resolve('oauth2-podcasts-clips.json'),
  'random-meme-dump': path.resolve('oauth2-random-meme-dump.json'),
};

// Function to read OAuth token from file
// Modify getTokenFromFile to accept an OAuth2 ID
function getTokenFromFile(oauthId) {
  const tokenPath = oauthFiles[oauthId];
  return new Promise((resolve, reject) => {
    fs.readFile(tokenPath, (err, token) => {
      if (err) return reject(err);
      resolve(JSON.parse(token));
    });
  });
}

// Function to save OAuth token to file
// Same for saveTokenToFile:
function saveTokenToFile(tokens, oauthId) {
  const tokenPath = oauthFiles[oauthId];
  return new Promise((resolve, reject) => {
    fs.writeFile(tokenPath, JSON.stringify(tokens), (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Utility function to get video duration
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration);
    });
  });
}

function processVideo(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get video duration
      const duration = await getVideoDuration(filePath);
      
      // Determine the actual processing duration
      const processingDuration = Math.min(duration, 59.028); // 59 seconds and 28 frames
      
      // Path to save the clipped video
      const clippedFilePath = path.join(__dirname, 'uploads', 'clipped_' + path.basename(filePath));
      
      ffmpeg(filePath)
        .setStartTime('00:00:00')
        .setDuration(processingDuration)
        .output(clippedFilePath)
        .on('end', () => {
          console.log('Processing finished.');
          resolve(clippedFilePath);
        })
        .on('error', (err) => {
          console.error('Error processing video:', err);
          reject(err);
        })
        .run();
    } catch (error) {
      console.error('Error getting video duration:', error);
      reject(error);
    }
  });
}



// Start OAuth2 flow to get the authorization code
app.get('/auth/:oauthId', (req, res) => {
  const oauthId = req.params.oauthId;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log(`Opening browser for OAuth2 authentication (${oauthId}):`, authUrl);

  // Store the oauthId temporarily for the callback
  tempUploadRequest = { oauthId };
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
    
    // Use the temporarily stored oauthId to save the token to the correct file
    const oauthId = tempUploadRequest.oauthId;
    await saveTokenToFile(tokens, oauthId); // Save token for the specific OAuth2 ID

    res.send(`Authentication successful for ${oauthId}! You can now upload videos.`);

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
  const oauthId = req.params.oauthId; // Get the oauthId from the request params

  try {
    const tokens = await getTokenFromFile(oauthId); // Read the token for the specific OAuth2 ID
    oauth2Client.setCredentials(tokens); // Set the credentials in the client
    next(); // Continue with the request
  } catch (err) {
    console.log(`No token found for ${oauthId}, starting OAuth flow...`);
    tempUploadRequest = { reqBody: req, resObj: res, oauthId }; // Store request info for later
    res.redirect(`/auth/${oauthId}`); // Redirect to OAuth2 authentication for the specific account
  }
}

// Route for handling video upload (using Multer to get the file)
app.post('/upload/:oauthId', upload.single('video'), ensureAuthenticated, async (req, res) => {
  if (!req.file) {
    console.log('File upload issue:', req.file); // Log the file data
    return res.status(400).send('No video file uploaded.');
  }
  
  console.log('File received:', req.file); // Debugging output
  tempUploadRequest = { reqBody: req, resObj: res, oauthId: req.params.oauthId };
  try {
    // Handle the video upload
    await handleUpload(req, res);
  } catch (error) {
    console.error('Error uploading video:', error.response ? error.response.data : error.message);
    
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error uploading video' });
    }
  }
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
    // Process the video with FFmpeg
    const clippedFilePath = await processVideo(filePath);

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
        body: fs.createReadStream(clippedFilePath), // Use the correct file path
      },
    });

    console.log('Video uploaded successfully:', response.data);
    if (!res.headersSent) {
      return res.json({ status: 'Video uploaded successfully', data: response.data });
    }
    // Clean up the temporary files
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temporary file:', err);
    });

    fs.unlink(clippedFilePath, (err) => {
      if (err) console.error('Failed to delete processed file:', err);
    });
    
  } catch (error) {
    console.error('Error uploading video:', error.response ? error.response.data : error.message);

    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error uploading video' });
    }
    
  }
}


// Start server
app.listen(5000, () => {
  console.log('Server started on http://localhost:5000');
});
