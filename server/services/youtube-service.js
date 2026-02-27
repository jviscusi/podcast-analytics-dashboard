/**
 * YouTube Data API / YouTube Analytics API Service
 * 
 * Supports two modes:
 * 1. Mock mode (USE_MOCK_DATA=true) - returns generated mock data
 * 2. Live mode (USE_MOCK_DATA=false) - fetches real data from YouTube APIs
 * 
 * Live mode uses:
 * - YouTube Data API v3: public video data (views, likes, comments)
 * - YouTube Analytics API: private analytics (watch time, retention) [requires OAuth]
 * 
 * OAuth flow:
 * 1. Run `node services/youtube-auth.js` to get initial tokens
 * 2. Tokens are saved to server/youtube-tokens.json
 * 3. Service auto-refreshes tokens as needed
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const TOKEN_PATH = path.join(__dirname, '../youtube-tokens.json');

class YouTubeService {
  constructor() {
    this.useMock = process.env.USE_MOCK_DATA !== 'false';
    this.mockData = null;
    this._oauth2Client = null;
    this._youtube = null;
    this._youtubeAnalytics = null;
    this._videoCache = null;
    this._videoCacheTime = 0;
    this._cacheTTL = 30 * 60 * 1000; // 30 minutes
  }

  _loadMockData() {
    if (!this.mockData) {
      this.mockData = require(path.join(__dirname, '../mock/youtube-data.json'));
    }
    return this.mockData;
  }

  /**
   * Initialize OAuth2 client and YouTube API instances
   */
  _initClient() {
    if (this._oauth2Client) return;

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost';

    if (!clientId || !clientSecret) {
      throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env');
    }

    this._oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Load saved tokens if they exist
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      this._oauth2Client.setCredentials(tokens);

      // Auto-refresh handler
      this._oauth2Client.on('tokens', (newTokens) => {
        const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        const merged = { ...existing, ...newTokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
        console.log('🔄 YouTube tokens refreshed and saved');
      });
    }

    this._youtube = google.youtube({ version: 'v3', auth: this._oauth2Client });
    this._youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: this._oauth2Client });
  }

  /**
   * Check if we have valid OAuth tokens
   */
  hasValidTokens() {
    if (this.useMock) return true;
    return fs.existsSync(TOKEN_PATH);
  }

  /**
   * Get OAuth authorization URL for initial setup
   */
  getAuthUrl() {
    this._initClient();
    return this._oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/yt-analytics.readonly'
      ]
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code) {
    this._initClient();
    const { tokens } = await this._oauth2Client.getToken(code);
    this._oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('✅ YouTube tokens saved');
    return tokens;
  }

  /**
   * Fetch all videos from the podcast playlist using YouTube Data API
   */
  async _fetchPlaylistVideos() {
    const now = Date.now();
    if (this._videoCache && (now - this._videoCacheTime) < this._cacheTTL) {
      return this._videoCache;
    }

    this._initClient();
    const playlistId = process.env.YOUTUBE_PLAYLIST_ID;
    if (!playlistId) {
      throw new Error('YOUTUBE_PLAYLIST_ID must be set in .env');
    }

    const videos = [];
    let nextPageToken = null;

    do {
      const response = await this._youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });

      for (const item of response.data.items) {
        videos.push({
          videoId: item.contentDetails.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          publishDate: item.snippet.publishedAt?.split('T')[0] || item.contentDetails.videoPublishedAt?.split('T')[0],
          thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          position: item.snippet.position
        });
      }

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Now fetch statistics for all videos in batches of 50
    const videoIds = videos.map(v => v.videoId);
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const statsResponse = await this._youtube.videos.list({
        part: 'statistics,contentDetails',
        id: batch.join(',')
      });

      for (const item of statsResponse.data.items) {
        const video = videos.find(v => v.videoId === item.id);
        if (video) {
          video.statistics = {
            viewCount: parseInt(item.statistics.viewCount || '0'),
            likeCount: parseInt(item.statistics.likeCount || '0'),
            commentCount: parseInt(item.statistics.commentCount || '0'),
            favoriteCount: parseInt(item.statistics.favoriteCount || '0')
          };
          // Parse duration from ISO 8601 (PT1H2M3S)
          const dur = item.contentDetails.duration;
          const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const hours = parseInt(match[1] || '0');
            const minutes = parseInt(match[2] || '0');
            const seconds = parseInt(match[3] || '0');
            video.durationSeconds = hours * 3600 + minutes * 60 + seconds;
          }
        }
      }
    }

    this._videoCache = videos;
    this._videoCacheTime = now;
    return videos;
  }

  /**
   * Fetch analytics for a specific video (requires OAuth)
   */
  async _fetchVideoAnalytics(videoId, startDate, endDate) {
    this._initClient();
    const channelId = process.env.YOUTUBE_CHANNEL_ID;

    try {
      const response = await this._youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate,
        endDate: endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
        dimensions: 'video',
        filters: `video==${videoId}`
      });

      if (response.data.rows && response.data.rows.length > 0) {
        const row = response.data.rows[0];
        return {
          views: row[1],
          estimatedMinutesWatched: row[2],
          averageViewDuration: row[3],
          averageViewPercentage: row[4],
          likes: row[5],
          comments: row[6],
          shares: row[7],
          subscribersGained: row[8]
        };
      }
      return null;
    } catch (error) {
      console.warn(`Analytics unavailable for video ${videoId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch daily views for a video from YouTube Analytics
   */
  async _fetchDailyViews(videoId, startDate, endDate) {
    this._initClient();
    const channelId = process.env.YOUTUBE_CHANNEL_ID;

    try {
      const response = await this._youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate,
        endDate: endDate,
        metrics: 'views',
        dimensions: 'day',
        filters: `video==${videoId}`,
        sort: 'day'
      });

      if (response.data.rows) {
        return response.data.rows.map(row => ({
          date: row[0],
          count: row[1]
        }));
      }
      return [];
    } catch (error) {
      console.warn(`Daily views unavailable for video ${videoId}:`, error.message);
      return [];
    }
  }

  /**
   * Map a YouTube video to an RSS episode by title matching
   */
  _mapVideoToEpisodeId(video, rssEpisodes) {
    if (!rssEpisodes || rssEpisodes.length === 0) return null;

    // Try exact title match first
    const exactMatch = rssEpisodes.find(ep =>
      ep.title.toLowerCase() === video.title.toLowerCase()
    );
    if (exactMatch) return exactMatch.id;

    // Try partial match - check if episode title is contained in video title or vice versa
    const partialMatch = rssEpisodes.find(ep => {
      const epTitle = ep.title.toLowerCase().replace(/[^\w\s]/g, '');
      const vidTitle = video.title.toLowerCase().replace(/[^\w\s]/g, '');
      return vidTitle.includes(epTitle) || epTitle.includes(vidTitle);
    });
    if (partialMatch) return partialMatch.id;

    // Try episode number matching (e.g., "Ep 3" or "Episode 3")
    const epNumMatch = video.title.match(/(?:ep(?:isode)?\.?\s*#?\s*)(\d+)/i);
    if (epNumMatch) {
      const epNum = parseInt(epNumMatch[1]);
      const numMatch = rssEpisodes.find(ep => ep.episodeNumber === epNum);
      if (numMatch) return numMatch.id;
    }

    return null;
  }

  // ============================================
  // Public API (same interface as mock version)
  // ============================================

  /**
   * Get channel/podcast overview metrics
   */
  async getPodcastOverview() {
    if (this.useMock) {
      const data = this._loadMockData();
      return {
        podcastName: data.podcastName,
        platform: 'youtube',
        totalSubscribers: data.totalSubscribers,
        totalEpisodes: data.episodes.length,
        lastUpdated: data.lastUpdated
      };
    }

    const videos = await this._fetchPlaylistVideos();
    const totalViews = videos.reduce((sum, v) => sum + (v.statistics?.viewCount || 0), 0);

    return {
      podcastName: 'Impact Over Optics',
      platform: 'youtube',
      totalViews,
      totalEpisodes: videos.length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get all episodes with metrics
   */
  async getEpisodes(rssEpisodes = null) {
    if (this.useMock) {
      const data = this._loadMockData();
      return data.episodes.map(ep => ({
        episodeId: ep.episodeId,
        title: ep.title,
        publishDate: ep.publishDate,
        platform: 'youtube',
        metrics: ep.metrics,
        trafficSources: ep.trafficSources,
        demographics: ep.demographics
      }));
    }

    // If no tokens, return empty (YouTube not yet authorized)
    if (!this.hasValidTokens()) {
      console.warn('YouTube not authorized. Run: node services/youtube-auth.js');
      return [];
    }

    let videos;
    try {
      videos = await this._fetchPlaylistVideos();
    } catch (error) {
      console.error('Failed to fetch YouTube videos:', error.message);
      return [];
    }
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return videos.map(video => {
      const episodeId = this._mapVideoToEpisodeId(video, rssEpisodes) || `yt-${video.videoId}`;
      const stats = video.statistics || {};

      return {
        episodeId: episodeId,
        videoId: video.videoId,
        title: video.title,
        publishDate: video.publishDate,
        platform: 'youtube',
        dataSource: 'live',
        metrics: {
          totalViews: stats.viewCount || 0,
          uniqueViewers: Math.round((stats.viewCount || 0) * 0.85), // Estimate: ~85% unique
          likes: stats.likeCount || 0,
          comments: stats.commentCount || 0,
          shares: 0, // Not available from Data API, needs Analytics API
          watchTimeHours: 0, // Needs Analytics API
          avgViewDuration: 0, // Needs Analytics API
          subscribersGained: 0 // Needs Analytics API
        },
        thumbnailUrl: video.thumbnailUrl,
        durationSeconds: video.durationSeconds
      };
    });
  }

  /**
   * Get single episode detail
   */
  async getEpisode(episodeId) {
    if (this.useMock) {
      const data = this._loadMockData();
      const episode = data.episodes.find(ep => ep.episodeId === episodeId);
      if (!episode) return null;
      return { ...episode, platform: 'youtube' };
    }

    const episodes = await this.getEpisodes();
    return episodes.find(ep => ep.episodeId === episodeId) || null;
  }

  /**
   * Get daily views for an episode
   */
  async getDailyViews(episodeId) {
    if (this.useMock) {
      const data = this._loadMockData();
      const episode = data.episodes.find(ep => ep.episodeId === episodeId);
      if (!episode) return [];
      return episode.dailyViews;
    }

    // For live mode, we need the videoId
    const episodes = await this.getEpisodes();
    const episode = episodes.find(ep => ep.episodeId === episodeId);
    if (!episode || !episode.videoId) return [];

    const today = new Date().toISOString().split('T')[0];
    const publishDate = episode.publishDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this._fetchDailyViews(episode.videoId, publishDate, today);
  }

  /**
   * Get aggregate daily views across all episodes
   */
  async getAggregateDailyViews() {
    if (this.useMock) {
      const data = this._loadMockData();
      const aggregated = {};
      data.episodes.forEach(ep => {
        ep.dailyViews.forEach(day => {
          if (!aggregated[day.date]) aggregated[day.date] = 0;
          aggregated[day.date] += day.count;
        });
      });
      return Object.entries(aggregated)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // If no tokens, return empty
    if (!this.hasValidTokens()) return [];

    // For live mode, fetch aggregate from YouTube Analytics API
    this._initClient();
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    const playlistId = process.env.YOUTUBE_PLAYLIST_ID;
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      // Get all video IDs in the playlist
      const videos = await this._fetchPlaylistVideos();
      const videoIds = videos.map(v => v.videoId);

      // Query analytics for all playlist videos
      const response = await this._youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: sixMonthsAgo,
        endDate: today,
        metrics: 'views',
        dimensions: 'day',
        filters: `video==${videoIds.join(',')}`,
        sort: 'day'
      });

      if (response.data.rows) {
        return response.data.rows.map(row => ({
          date: row[0],
          count: row[1]
        }));
      }
      return [];
    } catch (error) {
      console.warn('Aggregate daily views unavailable:', error.message);
      // Fallback: generate from video publish dates and view counts
      const videos = await this._fetchPlaylistVideos();
      return this._estimateDailyViewsFromVideos(videos);
    }
  }

  /**
   * Estimate daily views from video data when Analytics API is unavailable
   */
  _estimateDailyViewsFromVideos(videos) {
    const dailyMap = {};
    const today = new Date();

    videos.forEach(video => {
      if (!video.publishDate || !video.statistics) return;
      const pubDate = new Date(video.publishDate);
      const daysSincePublish = Math.max(1, Math.floor((today - pubDate) / (24 * 60 * 60 * 1000)));
      const totalViews = video.statistics.viewCount || 0;

      // Simple decay model: more views early, fewer later
      for (let d = 0; d < Math.min(daysSincePublish, 90); d++) {
        const date = new Date(pubDate);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split('T')[0];

        // Exponential decay: 50% of views in first week
        const weight = Math.exp(-d / 7);
        const dailyViews = Math.max(1, Math.round(totalViews * weight / (daysSincePublish * 0.3)));

        if (!dailyMap[dateStr]) dailyMap[dateStr] = 0;
        dailyMap[dateStr] += dailyViews;
      }
    });

    return Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Enrich episodes with YouTube Analytics data (watch time, retention, etc.)
   * Call this separately as it requires OAuth and is slower
   */
  async enrichWithAnalytics(episodes) {
    if (this.useMock || !this.hasValidTokens()) return episodes;

    this._initClient();
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const ep of episodes) {
      if (!ep.videoId) continue;
      const analytics = await this._fetchVideoAnalytics(ep.videoId, sixMonthsAgo, today);
      if (analytics) {
        ep.metrics.watchTimeHours = parseFloat((analytics.estimatedMinutesWatched / 60).toFixed(1));
        ep.metrics.avgViewDuration = analytics.averageViewPercentage / 100; // Convert to 0-1 range
        ep.metrics.shares = analytics.shares;
        ep.metrics.subscribersGained = analytics.subscribersGained;
      }
    }

    return episodes;
  }
}

module.exports = YouTubeService;
