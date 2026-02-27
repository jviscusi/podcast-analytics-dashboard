/**
 * Apple Podcasts Connect API Service
 * 
 * STUB: Currently returns mock data.
 * When ready to integrate with real Apple Podcasts API:
 * 1. Set USE_MOCK_DATA=false in .env
 * 2. Provide APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY_PATH, APPLE_PODCAST_ID
 * 3. Implement JWT token auth (see docs/API_INTEGRATION.md)
 * 
 * Apple Podcasts Analytics API provides:
 * - Downloads, plays, unique listeners
 * - Engaged listeners
 * - Average consumption / listen duration
 * - Device breakdown (iPhone, iPad, Mac, CarPlay, HomePod)
 * - Country breakdown
 */

const path = require('path');

class AppleService {
  constructor() {
    this.useMock = process.env.USE_MOCK_DATA !== 'false';
    this.mockData = null;
  }

  _loadMockData() {
    if (!this.mockData) {
      this.mockData = require(path.join(__dirname, '../mock/apple-data.json'));
    }
    return this.mockData;
  }

  /**
   * Get podcast overview metrics
   */
  async getPodcastOverview() {
    if (this.useMock) {
      const data = this._loadMockData();
      return {
        podcastName: data.podcastName,
        platform: 'apple',
        totalSubscribers: data.totalSubscribers,
        totalEpisodes: data.episodes.length,
        lastUpdated: data.lastUpdated
      };
    }

    // TODO: Real API implementation
    // Use Apple's Podcast Analytics API with JWT authentication
    // See: https://developer.apple.com/documentation/appstoreconnectapi
    throw new Error('Real Apple Podcasts API not yet implemented. Set USE_MOCK_DATA=true');
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
        platform: 'apple',
        metrics: ep.metrics,
        devices: ep.devices,
        topCountries: ep.topCountries
      }));
    }

    throw new Error('Real Apple Podcasts API not yet implemented. Set USE_MOCK_DATA=true');
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
        platform: 'apple'
      };
    }

    throw new Error('Real Apple Podcasts API not yet implemented. Set USE_MOCK_DATA=true');
  }

  /**
   * Get daily downloads for an episode
   */
  async getDailyDownloads(episodeId) {
    if (this.useMock) {
      const data = this._loadMockData();
      const episode = data.episodes.find(ep => ep.episodeId === episodeId);
      if (!episode) return [];
      return episode.dailyDownloads;
    }

    throw new Error('Real Apple Podcasts API not yet implemented. Set USE_MOCK_DATA=true');
  }

  /**
   * Get aggregate daily downloads across all episodes
   */
  async getAggregateDailyDownloads() {
    if (this.useMock) {
      const data = this._loadMockData();
      const aggregated = {};
      
      data.episodes.forEach(ep => {
        ep.dailyDownloads.forEach(day => {
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

    throw new Error('Real Apple Podcasts API not yet implemented. Set USE_MOCK_DATA=true');
  }
}

module.exports = AppleService;
