#!/usr/bin/env node
/**
 * YouTube OAuth Authorization Helper
 * 
 * Run this script once to authorize the dashboard to access your YouTube data:
 *   cd server && node services/youtube-auth.js
 * 
 * It will:
 * 1. Open your browser to Google's consent screen
 * 2. You log in and grant access
 * 3. Google redirects to localhost with an auth code
 * 4. This script captures the code and exchanges it for tokens
 * 5. Tokens are saved to server/youtube-tokens.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '../youtube-tokens.json');

async function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in server/.env');
    process.exit(1);
  }

  // Use localhost with a dynamic port for the callback
  const PORT = 9876;
  const redirectUri = `http://localhost:${PORT}`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly'
    ]
  });

  console.log('');
  console.log('🎬 YouTube OAuth Authorization');
  console.log('================================');
  console.log('');
  console.log('Opening your browser to authorize...');
  console.log('');
  console.log('If the browser doesn\'t open, visit this URL manually:');
  console.log('');
  console.log(authUrl);
  console.log('');

  // Start a temporary HTTP server to catch the callback
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/' && parsedUrl.query.code) {
      const code = parsedUrl.query.code;

      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save tokens
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0;">
              <div style="text-align: center; max-width: 500px;">
                <h1 style="color: #4ade80;">✅ Authorization Successful!</h1>
                <p>YouTube tokens have been saved. You can close this tab.</p>
                <p style="color: #888;">The dashboard will now use real YouTube data.</p>
              </div>
            </body>
          </html>
        `);

        console.log('✅ Authorization successful! Tokens saved to youtube-tokens.json');
        console.log('');
        console.log('You can now set USE_MOCK_DATA=false in your .env file');
        console.log('and restart the server to use real YouTube data.');
        console.log('');

        // Close the server after a short delay
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);

      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0;">
              <div style="text-align: center; max-width: 500px;">
                <h1 style="color: #ef4444;">❌ Authorization Failed</h1>
                <p>${error.message}</p>
              </div>
            </body>
          </html>
        `);
        console.error('❌ Failed to exchange code for tokens:', error.message);
        setTimeout(() => {
          server.close();
          process.exit(1);
        }, 1000);
      }
    } else if (parsedUrl.pathname === '/' && parsedUrl.query.error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0;">
            <div style="text-align: center; max-width: 500px;">
              <h1 style="color: #ef4444;">❌ Authorization Denied</h1>
              <p>Error: ${parsedUrl.query.error}</p>
            </div>
          </body>
        </html>
      `);
      console.error('❌ Authorization denied:', parsedUrl.query.error);
      setTimeout(() => {
        server.close();
        process.exit(1);
      }, 1000);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, async () => {
    console.log(`Listening for callback on http://localhost:${PORT}...`);

    // Try to open the browser
    try {
      const open = (await import('open')).default;
      await open(authUrl);
    } catch (e) {
      console.log('(Could not auto-open browser. Please visit the URL above manually.)');
    }
  });

  // Timeout after 5 minutes
  setTimeout(() => {
    console.error('⏰ Timed out waiting for authorization. Please try again.');
    server.close();
    process.exit(1);
  }, 5 * 60 * 1000);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
