# API Integration Guide

This document explains how to connect the Podcast Analytics Dashboard to real platform APIs. Currently, the app uses mock data. When you're ready to use real data, follow these steps for each platform.

## General Setup

1. Copy `.env.example` to `server/.env`
2. Set `USE_MOCK_DATA=false`
3. Fill in the platform-specific credentials below

---

## Spotify for Podcasters API

### Prerequisites
- A Spotify for Podcasters account with your podcast
- A Spotify Developer App (create at https://developer.spotify.com/dashboard)

### Steps

1. **Create a Spotify App**
   - Go to https://developer.spotify.com/dashboard
   - Click "Create App"
   - Set the redirect URI to `http://localhost:3001/api/auth/spotify/callback`
   - Note your Client ID and Client Secret

2. **Configure Environment Variables**
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:3001/api/auth/spotify/callback
   SPOTIFY_PODCAST_ID=your_show_id
   ```

3. **Implement OAuth Flow**
   - The stub service at `server/services/spotify-service.js` has TODO comments showing where to add real API calls
   - You'll need to implement the OAuth 2.0 Authorization Code flow
   - Required scopes: `user-read-playback-position`, `streaming`

### Available Data
- Episode streams, starts, listeners
- Completion rates
- Follower changes
- Demographics (age, gender, country)

### API Documentation
- https://developer.spotify.com/documentation/web-api
- https://podcasters.spotify.com (analytics section)

---

## Apple Podcasts Connect API

### Prerequisites
- An Apple Developer account
- Your podcast listed on Apple Podcasts
- An API key from App Store Connect

### Steps

1. **Generate API Key**
   - Go to https://appstoreconnect.apple.com
   - Navigate to Users and Access → Keys
   - Generate a new API key with "App Manager" role
   - Download the `.p8` private key file

2. **Configure Environment Variables**
   ```
   APPLE_KEY_ID=your_key_id
   APPLE_ISSUER_ID=your_issuer_id
   APPLE_PRIVATE_KEY_PATH=./keys/apple_private_key.p8
   APPLE_PODCAST_ID=your_podcast_id
   ```

3. **Place the Private Key**
   - Create a `keys/` directory in the server folder
   - Place your `.p8` file there (it's gitignored)

4. **Implement JWT Auth**
   - The stub service at `server/services/apple-service.js` has TODO comments
   - Apple uses JWT tokens signed with your private key
   - Tokens expire after 20 minutes

### Available Data
- Downloads, plays, unique listeners
- Engaged listeners
- Average consumption / listen duration
- Device breakdown (iPhone, iPad, Mac, CarPlay, HomePod)
- Country breakdown

### API Documentation
- https://developer.apple.com/documentation/appstoreconnectapi
- https://developer.apple.com/documentation/podcastsconnectapi

---

## YouTube Data API / YouTube Analytics API

### Prerequisites
- A Google Cloud project
- YouTube channel with your podcast episodes as videos
- OAuth 2.0 credentials

### Steps

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create a new project
   - Enable "YouTube Data API v3" and "YouTube Analytics API"

2. **Create OAuth Credentials**
   - Go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Set redirect URI to `http://localhost:3001/api/auth/youtube/callback`

3. **Configure Environment Variables**
   ```
   YOUTUBE_CLIENT_ID=your_client_id
   YOUTUBE_CLIENT_SECRET=your_client_secret
   YOUTUBE_REDIRECT_URI=http://localhost:3001/api/auth/youtube/callback
   YOUTUBE_CHANNEL_ID=your_channel_id
   YOUTUBE_PLAYLIST_ID=your_podcast_playlist_id
   ```

4. **Implement OAuth Flow**
   - The stub service at `server/services/youtube-service.js` has TODO comments
   - Use Google's OAuth 2.0 for server-side web apps
   - Required scopes: `youtube.readonly`, `yt-analytics.readonly`

### Available Data
- Views, unique viewers, watch time
- Likes, comments, shares
- Subscriber changes
- Impressions and click-through rate
- Traffic sources (search, suggested, browse, external)
- Demographics (age, country)

### API Documentation
- https://developers.google.com/youtube/v3
- https://developers.google.com/youtube/analytics

---

## Implementation Pattern

Each platform service follows the same pattern:

```javascript
class PlatformService {
  constructor() {
    this.useMock = process.env.USE_MOCK_DATA !== 'false';
  }

  async getEpisodes() {
    if (this.useMock) {
      // Return mock data
      return this._loadMockData().episodes;
    }
    
    // Real API call
    const response = await fetch('https://api.platform.com/...', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    return response.json();
  }
}
```

To integrate a real API:
1. Set `USE_MOCK_DATA=false` in `.env`
2. Implement the OAuth flow for the platform
3. Replace the `throw new Error(...)` lines with real API calls
4. Map the API response to match the mock data schema

The aggregator service (`server/services/aggregator.js`) will automatically normalize data from all platforms into the unified schema the frontend expects.

---

## Testing Your Integration

1. Start with one platform at a time
2. Set `USE_MOCK_DATA=false` only for the platform you're testing
3. Check the API response matches the expected schema
4. The frontend should work without changes since the aggregator normalizes everything

## Rate Limits

Be aware of API rate limits:
- **Spotify**: 30 requests per second
- **Apple**: Varies by endpoint
- **YouTube**: 10,000 quota units per day (each request costs different units)

Consider implementing caching (the SQLite schema is prepared for this) to avoid hitting rate limits.
