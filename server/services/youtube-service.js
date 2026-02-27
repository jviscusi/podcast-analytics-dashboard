/**
 * YouTube Data API / YouTube Analytics API Service
 * 
 * STUB: Currently returns mock data.
 * When ready to integrate with real YouTube API:
 * 1. Set USE_MOCK_DATA=false in .env
 * 2. Provide YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_CHANNEL_ID
 * 3. Implement Google OAuth 2.0 flow (see docs/API_INTEGRATION.md)
 * 
 * YouTube APIs provide:
 * - Views, unique viewers, watch time
 * - Likes, comments, shares
 * - Subscriber changes
 * - Impressions and click-through rate
 * - Traffic sources
 * - Demographics (age, country)
 */

const path = require('path');

class YouTubeService {
  constructor() {
    this.useMock = process.env.USE_MOCK_DATA !== 'false';
    this.mockData = null;
  }

  _loadMockData() {
    if (!this.mockData) {
      this.mockData = require(path.join(__dirname, '../mock/youtube-data.json'));
    }
    return this.mockData;
  }

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

    // TODO: Real API implementation
    // Use YouTube Data API v3 for channel info
    // Use YouTube Analytics API for detailed metrics
    // See: https://developers.google.com/youtube/v3
    throw new Error('Real YouTube API not yet implemented. Set USE_MOCK_DATA=true');
  }

  /**
   * Get all episodes with metrics
   */
  async getEpisodes() {
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

    throw new Error('Real YouTube API not yet implemented. Set USE_MOCK_DATA=true');
  }

  /**
   * Get single episode detail
   */
  async getEpisode(episodeId) {
    if (this.useMock) {
      const data = this._loadMockData();
      const episode = data.episodes.find(ep => ep.episodeId === episodeId);
      if (!episode) return null;
      return {
        ...episode,
        platform: 'youtube'
      };
    }

    throw new Error('Real YouTube API not yet implemented. Set USE_MOCK_DATA=true');
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

    throw new Error('Real YouTube API not yet implemented. Set USE_MOCK_DATA=true');
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
          if (!aggregated[day.date]) {
            aggregated[day.date] = 0;
          }
          aggregated[day.date] += day.count;
        });
      });

      return Object.entries(aggregated)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    throw new Error('Real YouTube API not yet implemented. Set USE_MOCK_DATA=true');
  }
}

module.exports = YouTubeService;
