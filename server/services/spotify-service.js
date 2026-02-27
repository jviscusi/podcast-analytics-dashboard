/**
 * Spotify for Podcasters API Service
 * 
 * STUB: Currently returns mock data.
 * When ready to integrate with real Spotify API:
 * 1. Set USE_MOCK_DATA=false in .env
 * 2. Provide SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_PODCAST_ID
 * 3. Implement OAuth 2.0 flow (see docs/API_INTEGRATION.md)
 * 
 * Spotify Podcast Analytics API provides:
 * - Episode streams, starts, listeners
 * - Completion rates
 * - Follower counts
 * - Demographics (age, gender, country)
 */

const path = require('path');

class SpotifyService {
  constructor() {
    this.useMock = process.env.USE_MOCK_DATA !== 'false';
    this.mockData = null;
  }

  _loadMockData() {
    if (!this.mockData) {
      this.mockData = require(path.join(__dirname, '../mock/spotify-data.json'));
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
        platform: 'spotify',
        totalFollowers: data.totalFollowers,
        totalEpisodes: data.episodes.length,
        lastUpdated: data.lastUpdated
      };
    }

    // TODO: Real API implementation
    // const response = await fetch(`https://api.spotify.com/v1/shows/${process.env.SPOTIFY_PODCAST_ID}`, {
    //   headers: { 'Authorization': `Bearer ${this.accessToken}` }
    // });
    // return response.json();
    throw new Error('Real Spotify API not yet implemented. Set USE_MOCK_DATA=true');
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
        platform: 'spotify',
        metrics: ep.metrics,
        demographics: ep.demographics
      }));
    }

    throw new Error('Real Spotify API not yet implemented. Set USE_MOCK_DATA=true');
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
        platform: 'spotify'
      };
    }

    throw new Error('Real Spotify API not yet implemented. Set USE_MOCK_DATA=true');
  }

  /**
   * Get daily streams for an episode
   */
  async getDailyStreams(episodeId) {
    if (this.useMock) {
      const data = this._loadMockData();
      const episode = data.episodes.find(ep => ep.episodeId === episodeId);
      if (!episode) return [];
      return episode.dailyStreams;
    }

    throw new Error('Real Spotify API not yet implemented. Set USE_MOCK_DATA=true');
  }

  /**
   * Get aggregate daily streams across all episodes
   */
  async getAggregateDailyStreams() {
    if (this.useMock) {
      const data = this._loadMockData();
      const aggregated = {};
      
      data.episodes.forEach(ep => {
        ep.dailyStreams.forEach(day => {
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

    throw new Error('Real Spotify API not yet implemented. Set USE_MOCK_DATA=true');
  }
}

module.exports = SpotifyService;
