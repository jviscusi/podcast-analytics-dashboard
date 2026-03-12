/**
 * Cross-Platform Data Aggregator
 * 
 * Hybrid data architecture:
 * - YouTube: Real data from YouTube Data API + Analytics API
 * - Spotify: Manual data entry (SQLite) or mock data fallback
 * - Apple: Manual data entry (SQLite) or mock data fallback
 * - Amazon Music: Manual data entry (SQLite)
 * - Episode catalog: Live RSS feed from Riverside.fm
 */

const path = require('path');
const YouTubeService = require('./youtube-service');
const ManualDataService = require('./manual-data-service');
const RSSService = require('./rss-service');

class Aggregator {
  constructor() {
    this.youtube = new YouTubeService();
    this.manualData = new ManualDataService();
    this.rss = new RSSService();
    this._episodeCache = null;
    this._useMock = process.env.USE_MOCK_DATA !== 'false';

    // Aggregator-level cache: stores last successful results
    this._cache = {
      overview: { data: null, time: 0 },
      episodes: { data: null, time: 0 },
      trends: { data: null, time: 0 },
      platforms: { data: null, time: 0 },
      insights: { data: null, time: 0 },
      youtubeEpisodes: { data: null, time: 0 }
    };
    this._cacheTTL = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Check if a cache entry is still valid
   */
  _isCacheValid(key) {
    return this._cache[key].data !== null && (Date.now() - this._cache[key].time) < this._cacheTTL;
  }

  /**
   * Get cached data or null
   */
  _getCached(key) {
    if (this._isCacheValid(key)) return this._cache[key].data;
    return null;
  }

  /**
   * Store data in cache
   */
  _setCache(key, data) {
    this._cache[key] = { data, time: Date.now() };
  }

  /**
   * Get YouTube episodes with caching and graceful fallback
   * This is the key method that prevents 500s from YouTube API failures
   */
  async _getYouTubeEpisodesSafe(episodeMetadata) {
    // Return from cache if valid
    const cached = this._getCached('youtubeEpisodes');
    if (cached) return cached;

    try {
      const data = await this.youtube.getEpisodes(episodeMetadata);
      this._setCache('youtubeEpisodes', data);
      return data;
    } catch (error) {
      console.error('YouTube API failed, using cached/empty data:', error.message);
      // Return last known good data, or empty array
      return this._cache.youtubeEpisodes.data || [];
    }
  }

  /**
   * Sort episodes array (used for cached data)
   */
  _sortEpisodes(episodes, sortBy, sortOrder) {
    const sorted = [...episodes];
    const by = sortBy || 'publishDate';
    const order = sortOrder || 'desc';
    sorted.sort((a, b) => {
      let valA, valB;
      switch (by) {
        case 'totalReach': valA = a.metrics.totalReach; valB = b.metrics.totalReach; break;
        case 'totalListeners': valA = a.metrics.totalListeners; valB = b.metrics.totalListeners; break;
        case 'completionRate': valA = a.metrics.avgCompletionRate; valB = b.metrics.avgCompletionRate; break;
        case 'episodeNumber': valA = a.episodeNumber; valB = b.episodeNumber; break;
        default: valA = a.publishDate; valB = b.publishDate; break;
      }
      if (order === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
    return sorted;
  }

  /**
   * Get episode metadata from RSS feed (with fallback to static file)
   */
  async _getEpisodeMetadata() {
    if (this._episodeCache) return this._episodeCache;
    try {
      const rssData = await this.rss.getEpisodes();
      this._episodeCache = rssData.episodes;
      return this._episodeCache;
    } catch (error) {
      console.warn('RSS feed unavailable, falling back to static episodes.json');
      return require(path.join(__dirname, '../mock/episodes.json'));
    }
  }

  /**
   * Get Spotify episode data (manual entry or mock fallback)
   */
  _getSpotifyEpisodes() {
    // Try manual data first
    const manualEps = this.manualData.getSpotifyEpisodes();
    if (manualEps.length > 0) return manualEps;

    // Fall back to mock data if available
    if (this._useMock) {
      try {
        const SpotifyService = require('./spotify-service');
        const spotify = new SpotifyService();
        // SpotifyService always uses mock in current implementation
        const mockData = require(path.join(__dirname, '../mock/spotify-data.json'));
        return mockData.episodes.map(ep => ({
          episodeId: ep.episodeId,
          platform: 'spotify',
          dataSource: 'mock',
          metrics: ep.metrics
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  /**
   * Get Apple episode data (manual entry or mock fallback)
   */
  _getAppleEpisodes() {
    // Try manual data first
    const manualEps = this.manualData.getAppleEpisodes();
    if (manualEps.length > 0) return manualEps;

    // Fall back to mock data if available
    if (this._useMock) {
      try {
        const mockData = require(path.join(__dirname, '../mock/apple-data.json'));
        return mockData.episodes.map(ep => ({
          episodeId: ep.episodeId,
          platform: 'apple',
          dataSource: 'mock',
          metrics: ep.metrics
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  /**
   * Get Amazon Music episode data (manual entry only)
   */
  _getAmazonEpisodes() {
    return this.manualData.getAmazonEpisodes();
  }

  /**
   * Get dashboard overview with aggregate KPIs
   */
  async getOverview() {
    // Return cached overview if valid
    const cached = this._getCached('overview');
    if (cached) return cached;

    const episodeMetadata = await this._getEpisodeMetadata();
    const youtubeEps = await this._getYouTubeEpisodesSafe(episodeMetadata);
    const spotifyEps = this._getSpotifyEpisodes();
    const appleEps = this._getAppleEpisodes();
    const amazonEps = this._getAmazonEpisodes();

    const totalStreams = spotifyEps.reduce((sum, ep) => sum + (ep.metrics.totalStreams || 0), 0);
    const totalDownloads = appleEps.reduce((sum, ep) => sum + (ep.metrics.totalDownloads || 0), 0);
    const totalViews = youtubeEps.reduce((sum, ep) => sum + (ep.metrics.totalViews || 0), 0);
    const totalAmazonStreams = amazonEps.reduce((sum, ep) => sum + (ep.metrics.totalStreams || 0), 0);

    const totalListeners = 
      spotifyEps.reduce((sum, ep) => sum + (ep.metrics.totalListeners || 0), 0)
      + appleEps.reduce((sum, ep) => sum + (ep.metrics.uniqueListeners || 0), 0)
      + youtubeEps.reduce((sum, ep) => sum + (ep.metrics.uniqueViewers || 0), 0)
      + amazonEps.reduce((sum, ep) => sum + (ep.metrics.totalListeners || 0), 0);

    // Completion rates (only average platforms that have data)
    const completionRates = [];
    if (spotifyEps.length > 0) {
      const avg = spotifyEps.reduce((s, ep) => s + (ep.metrics.completionRate || 0), 0) / spotifyEps.length;
      if (avg > 0) completionRates.push(avg);
    }
    if (appleEps.length > 0) {
      const avg = appleEps.reduce((s, ep) => s + (ep.metrics.avgConsumption || 0), 0) / appleEps.length;
      if (avg > 0) completionRates.push(avg);
    }
    if (youtubeEps.length > 0) {
      const avg = youtubeEps.reduce((s, ep) => s + (ep.metrics.avgViewDuration || 0), 0) / youtubeEps.length;
      if (avg > 0) completionRates.push(avg);
    }
    if (amazonEps.length > 0) {
      const avg = amazonEps.reduce((s, ep) => s + (ep.metrics.completionRate || 0), 0) / amazonEps.length;
      if (avg > 0) completionRates.push(avg);
    }
    const avgCompletion = completionRates.length > 0
      ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
      : 0;

    const totalReach = totalStreams + totalDownloads + totalViews + totalAmazonStreams;

    // Data source indicators
    const dataSources = {
      youtube: youtubeEps.length > 0 ? (youtubeEps[0]?.dataSource || 'live') : 'none',
      spotify: spotifyEps.length > 0 ? (spotifyEps[0]?.dataSource || 'mock') : 'none',
      apple: appleEps.length > 0 ? (appleEps[0]?.dataSource || 'mock') : 'none',
      amazon: amazonEps.length > 0 ? (amazonEps[0]?.dataSource || 'manual') : 'none'
    };

    const result = {
      totalReach,
      totalStreams,
      totalDownloads,
      totalViews,
      totalAmazonStreams,
      totalListeners,
      avgCompletionRate: parseFloat(avgCompletion.toFixed(3)),
      totalEpisodes: episodeMetadata.length,
      dataSources,
      platformBreakdown: {
        spotify: { 
          streams: totalStreams, 
          percentage: totalReach > 0 ? parseFloat((totalStreams / totalReach * 100).toFixed(1)) : 0 
        },
        apple: { 
          downloads: totalDownloads, 
          percentage: totalReach > 0 ? parseFloat((totalDownloads / totalReach * 100).toFixed(1)) : 0 
        },
        youtube: { 
          views: totalViews, 
          percentage: totalReach > 0 ? parseFloat((totalViews / totalReach * 100).toFixed(1)) : 0 
        },
        amazon: { 
          streams: totalAmazonStreams, 
          percentage: totalReach > 0 ? parseFloat((totalAmazonStreams / totalReach * 100).toFixed(1)) : 0 
        }
      }
    };

    this._setCache('overview', result);
    return result;
  }

  /**
   * Get all episodes with normalized cross-platform metrics
   */
  async getEpisodes(filters = {}) {
    // Return cached episodes if valid and no filters applied
    const hasFilters = filters.startDate || filters.endDate || filters.tags || filters.hasGuest !== undefined;
    if (!hasFilters) {
      const cached = this._getCached('episodes');
      if (cached) {
        // Still apply sort to cached data
        return this._sortEpisodes(cached, filters.sortBy, filters.sortOrder);
      }
    }

    const episodeMetadata = await this._getEpisodeMetadata();
    const youtubeEps = await this._getYouTubeEpisodesSafe(episodeMetadata);
    const spotifyEps = this._getSpotifyEpisodes();
    const appleEps = this._getAppleEpisodes();
    const amazonEps = this._getAmazonEpisodes();

    let episodes = episodeMetadata.map(meta => {
      const spotifyEp = spotifyEps.find(e => e.episodeId === meta.id);
      const appleEp = appleEps.find(e => e.episodeId === meta.id);
      const youtubeEp = youtubeEps.find(e => e.episodeId === meta.id);
      const amazonEp = amazonEps.find(e => e.episodeId === meta.id);

      const spotifyStreams = spotifyEp?.metrics?.totalStreams || 0;
      const appleDownloads = appleEp?.metrics?.totalDownloads || 0;
      const youtubeViews = youtubeEp?.metrics?.totalViews || 0;
      const amazonStreams = amazonEp?.metrics?.totalStreams || 0;
      const totalReach = spotifyStreams + appleDownloads + youtubeViews + amazonStreams;

      const spotifyListeners = spotifyEp?.metrics?.totalListeners || 0;
      const appleListeners = appleEp?.metrics?.uniqueListeners || 0;
      const youtubeViewers = youtubeEp?.metrics?.uniqueViewers || 0;
      const amazonListeners = amazonEp?.metrics?.totalListeners || 0;
      const totalListeners = spotifyListeners + appleListeners + youtubeViewers + amazonListeners;

      const completionRates = [];
      if (spotifyEp?.metrics?.completionRate) completionRates.push(spotifyEp.metrics.completionRate);
      if (appleEp?.metrics?.avgConsumption) completionRates.push(appleEp.metrics.avgConsumption);
      if (youtubeEp?.metrics?.avgViewDuration) completionRates.push(youtubeEp.metrics.avgViewDuration);
      if (amazonEp?.metrics?.completionRate) completionRates.push(amazonEp.metrics.completionRate);
      const avgCompletion = completionRates.length > 0
        ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
        : 0;

      return {
        id: meta.id,
        episodeNumber: meta.episodeNumber,
        title: meta.title,
        publishDate: meta.publishDate,
        duration: meta.duration,
        tags: meta.tags,
        guest: meta.guest,
        season: meta.season,
        dataSources: {
          spotify: spotifyEp?.dataSource || 'none',
          apple: appleEp?.dataSource || 'none',
          youtube: youtubeEp?.dataSource || 'none',
          amazon: amazonEp?.dataSource || 'none'
        },
        metrics: {
          totalReach,
          totalListeners,
          avgCompletionRate: parseFloat(avgCompletion.toFixed(3)),
          platforms: {
            spotify: {
              streams: spotifyStreams,
              listeners: spotifyListeners,
              completionRate: spotifyEp?.metrics?.completionRate || 0,
              starts: spotifyEp?.metrics?.starts || 0,
              saves: spotifyEp?.metrics?.saves || 0,
              shares: spotifyEp?.metrics?.shares || 0
            },
            apple: {
              downloads: appleDownloads,
              plays: appleEp?.metrics?.totalPlays || 0,
              listeners: appleListeners,
              avgConsumption: appleEp?.metrics?.avgConsumption || 0,
              engagedListeners: appleEp?.metrics?.engagedListeners || 0
            },
            youtube: {
              views: youtubeViews,
              viewers: youtubeViewers,
              avgViewDuration: youtubeEp?.metrics?.avgViewDuration || 0,
              watchTimeHours: youtubeEp?.metrics?.watchTimeHours || 0,
              likes: youtubeEp?.metrics?.likes || 0,
              comments: youtubeEp?.metrics?.comments || 0,
              shares: youtubeEp?.metrics?.shares || 0,
              videoId: youtubeEp?.videoId || null,
              thumbnailUrl: youtubeEp?.thumbnailUrl || null
            },
            amazon: {
              streams: amazonStreams,
              listeners: amazonListeners,
              completionRate: amazonEp?.metrics?.completionRate || 0,
              starts: amazonEp?.metrics?.starts || 0,
              followers: amazonEp?.metrics?.followers || 0
            }
          }
        }
      };
    });

    // Apply filters
    if (filters.startDate) {
      episodes = episodes.filter(ep => ep.publishDate >= filters.startDate);
    }
    if (filters.endDate) {
      episodes = episodes.filter(ep => ep.publishDate <= filters.endDate);
    }
    if (filters.tags && filters.tags.length > 0) {
      episodes = episodes.filter(ep => 
        filters.tags.some(tag => ep.tags.includes(tag))
      );
    }
    if (filters.hasGuest !== undefined) {
      episodes = episodes.filter(ep => 
        filters.hasGuest ? ep.guest !== null : ep.guest === null
      );
    }

    // Cache the unfiltered episode list before sorting
    if (!hasFilters) {
      this._setCache('episodes', episodes);
    }

    // Sort
    const sortBy = filters.sortBy || 'publishDate';
    const sortOrder = filters.sortOrder || 'desc';
    episodes.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'totalReach':
          valA = a.metrics.totalReach;
          valB = b.metrics.totalReach;
          break;
        case 'totalListeners':
          valA = a.metrics.totalListeners;
          valB = b.metrics.totalListeners;
          break;
        case 'completionRate':
          valA = a.metrics.avgCompletionRate;
          valB = b.metrics.avgCompletionRate;
          break;
        case 'episodeNumber':
          valA = a.episodeNumber;
          valB = b.episodeNumber;
          break;
        case 'publishDate':
        default:
          valA = a.publishDate;
          valB = b.publishDate;
          break;
      }
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    return episodes;
  }

  /**
   * Get single episode with full cross-platform detail
   */
  async getEpisodeDetail(episodeId) {
    const episodeMetadata = await this._getEpisodeMetadata();
    const meta = episodeMetadata.find(e => e.id === episodeId);
    if (!meta) return null;

    const youtubeEp = await this.youtube.getEpisode(episodeId);
    const spotifyData = this.manualData.getEpisodeMetrics(episodeId, 'spotify');
    const appleData = this.manualData.getEpisodeMetrics(episodeId, 'apple');
    const amazonData = this.manualData.getEpisodeMetrics(episodeId, 'amazon');

    return {
      ...meta,
      dataSources: {
        youtube: youtubeEp ? 'live' : 'none',
        spotify: spotifyData.recordedDate ? 'manual' : (this._useMock ? 'mock' : 'none'),
        apple: appleData.recordedDate ? 'manual' : (this._useMock ? 'mock' : 'none'),
        amazon: amazonData.recordedDate ? 'manual' : 'none'
      },
      platforms: {
        spotify: spotifyData.recordedDate ? spotifyData : null,
        apple: appleData.recordedDate ? appleData : null,
        youtube: youtubeEp,
        amazon: amazonData.recordedDate ? amazonData : null
      }
    };
  }

  /**
   * Get aggregate daily trends across all platforms
   */
  async getTrends(filters = {}) {
// YouTube daily views (real or estimated)
    let youtubeDaily = [];
    try {
      youtubeDaily = await this.youtube.getAggregateDailyViews();
    } catch (e) {
      console.warn('Aggregate daily views unavailable:', e.message);
    }

    // For Spotify/Apple, use mock daily data if available
    let spotifyDaily = [];
    let appleDaily = [];
    if (this._useMock) {
      try {
        const SpotifyService = require('./spotify-service');
        const AppleService = require('./apple-service');
        const spotify = new SpotifyService();
        const apple = new AppleService();
        spotifyDaily = await spotify.getAggregateDailyStreams();
        appleDaily = await apple.getAggregateDailyDownloads();
      } catch (e) {
        // No mock data available
      }
    }

    // Merge all dates
    const allDates = new Set();
    spotifyDaily.forEach(d => allDates.add(d.date));
    appleDaily.forEach(d => allDates.add(d.date));
    youtubeDaily.forEach(d => allDates.add(d.date));

    const spotifyMap = Object.fromEntries(spotifyDaily.map(d => [d.date, d.count]));
    const appleMap = Object.fromEntries(appleDaily.map(d => [d.date, d.count]));
    const youtubeMap = Object.fromEntries(youtubeDaily.map(d => [d.date, d.count]));

    let trends = Array.from(allDates).sort().map(date => ({
      date,
      spotify: spotifyMap[date] || 0,
      apple: appleMap[date] || 0,
      youtube: youtubeMap[date] || 0,
      total: (spotifyMap[date] || 0) + (appleMap[date] || 0) + (youtubeMap[date] || 0)
    }));

    // Apply date filters
    if (filters.startDate) {
      trends = trends.filter(t => t.date >= filters.startDate);
    }
    if (filters.endDate) {
      trends = trends.filter(t => t.date <= filters.endDate);
    }

    // Optionally aggregate by week
    if (filters.groupBy === 'week') {
      const weekMap = {};
      trends.forEach(t => {
        const d = new Date(t.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weekMap[weekKey]) {
          weekMap[weekKey] = { date: weekKey, spotify: 0, apple: 0, youtube: 0, total: 0 };
        }
        weekMap[weekKey].spotify += t.spotify;
        weekMap[weekKey].apple += t.apple;
        weekMap[weekKey].youtube += t.youtube;
        weekMap[weekKey].total += t.total;
      });
      trends = Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date));
    }

    return trends;
  }

  /**
   * Get platform comparison data
   */
  async getPlatformComparison() {
    const episodes = await this.getEpisodes();

    const platforms = {
      spotify: { totalReach: 0, totalListeners: 0, avgCompletion: 0, episodeData: [] },
      apple: { totalReach: 0, totalListeners: 0, avgCompletion: 0, episodeData: [] },
      youtube: { totalReach: 0, totalListeners: 0, avgCompletion: 0, episodeData: [] },
      amazon: { totalReach: 0, totalListeners: 0, avgCompletion: 0, episodeData: [] }
    };

    episodes.forEach(ep => {
      const sp = ep.metrics.platforms.spotify;
      const ap = ep.metrics.platforms.apple;
      const yt = ep.metrics.platforms.youtube;
      const am = ep.metrics.platforms.amazon;

      platforms.spotify.totalReach += sp.streams;
      platforms.spotify.totalListeners += sp.listeners;
      platforms.spotify.episodeData.push({
        episodeId: ep.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        publishDate: ep.publishDate,
        reach: sp.streams,
        listeners: sp.listeners,
        completionRate: sp.completionRate
      });

      platforms.apple.totalReach += ap.downloads;
      platforms.apple.totalListeners += ap.listeners;
      platforms.apple.episodeData.push({
        episodeId: ep.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        publishDate: ep.publishDate,
        reach: ap.downloads,
        listeners: ap.listeners,
        completionRate: ap.avgConsumption
      });

      platforms.youtube.totalReach += yt.views;
      platforms.youtube.totalListeners += yt.viewers;
      platforms.youtube.episodeData.push({
        episodeId: ep.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        publishDate: ep.publishDate,
        reach: yt.views,
        listeners: yt.viewers,
        completionRate: yt.avgViewDuration,
        videoId: yt.videoId,
        thumbnailUrl: yt.thumbnailUrl
      });

      platforms.amazon.totalReach += am.streams;
      platforms.amazon.totalListeners += am.listeners;
      platforms.amazon.episodeData.push({
        episodeId: ep.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        publishDate: ep.publishDate,
        reach: am.streams,
        listeners: am.listeners,
        completionRate: am.completionRate,
        followers: am.followers
      });
    });

    // Calculate averages
    const epCount = episodes.length || 1;
    platforms.spotify.avgCompletion = parseFloat(
      (platforms.spotify.episodeData.reduce((s, e) => s + e.completionRate, 0) / epCount).toFixed(3)
    );
    platforms.apple.avgCompletion = parseFloat(
      (platforms.apple.episodeData.reduce((s, e) => s + e.completionRate, 0) / epCount).toFixed(3)
    );
    platforms.youtube.avgCompletion = parseFloat(
      (platforms.youtube.episodeData.reduce((s, e) => s + e.completionRate, 0) / epCount).toFixed(3)
    );
    platforms.amazon.avgCompletion = parseFloat(
      (platforms.amazon.episodeData.reduce((s, e) => s + e.completionRate, 0) / epCount).toFixed(3)
    );

    return platforms;
  }

  /**
   * Get performance insights for understanding what works
   */
  async getInsights() {
    const episodes = await this.getEpisodes({ sortBy: 'totalReach', sortOrder: 'desc' });

    if (episodes.length === 0) {
      return {
        summary: { totalEpisodes: 0, avgReach: 0, medianReach: 0 },
        topPerformers: [],
        bottomPerformers: [],
        dayOfWeekAnalysis: {},
        durationAnalysis: {},
        tagAnalysis: {},
        guestVsSolo: { guest: { count: 0, avgReach: 0, avgCompletion: 0 }, solo: { count: 0, avgReach: 0, avgCompletion: 0 } },
        durationVsEngagement: [],
        growthTrend: []
      };
    }

    // Episode rankings
    const ranked = episodes.map((ep, idx) => ({ ...ep, rank: idx + 1 }));

    // Average reach
    const avgReach = episodes.reduce((s, e) => s + e.metrics.totalReach, 0) / episodes.length;

    // Best and worst performers
    const topPerformers = ranked.slice(0, 5);
    const bottomPerformers = ranked.slice(-5).reverse();

    // Day of week analysis
    const dayOfWeekStats = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    episodes.forEach(ep => {
      const day = dayNames[new Date(ep.publishDate).getDay()];
      if (!dayOfWeekStats[day]) {
        dayOfWeekStats[day] = { count: 0, totalReach: 0, avgReach: 0 };
      }
      dayOfWeekStats[day].count++;
      dayOfWeekStats[day].totalReach += ep.metrics.totalReach;
    });
    Object.keys(dayOfWeekStats).forEach(day => {
      dayOfWeekStats[day].avgReach = Math.round(dayOfWeekStats[day].totalReach / dayOfWeekStats[day].count);
    });

    // Duration analysis
    const durationBuckets = {
      'short (< 25 min)': { count: 0, totalReach: 0, avgReach: 0, avgCompletion: 0 },
      'medium (25-40 min)': { count: 0, totalReach: 0, avgReach: 0, avgCompletion: 0 },
      'long (> 40 min)': { count: 0, totalReach: 0, avgReach: 0, avgCompletion: 0 }
    };
    episodes.forEach(ep => {
      let bucket;
      if (ep.duration < 25) bucket = 'short (< 25 min)';
      else if (ep.duration <= 40) bucket = 'medium (25-40 min)';
      else bucket = 'long (> 40 min)';
      durationBuckets[bucket].count++;
      durationBuckets[bucket].totalReach += ep.metrics.totalReach;
      durationBuckets[bucket].avgCompletion += ep.metrics.avgCompletionRate;
    });
    Object.keys(durationBuckets).forEach(bucket => {
      if (durationBuckets[bucket].count > 0) {
        durationBuckets[bucket].avgReach = Math.round(durationBuckets[bucket].totalReach / durationBuckets[bucket].count);
        durationBuckets[bucket].avgCompletion = parseFloat(
          (durationBuckets[bucket].avgCompletion / durationBuckets[bucket].count).toFixed(3)
        );
      }
    });

    // Tag/category analysis
    const tagStats = {};
    episodes.forEach(ep => {
      ep.tags.forEach(tag => {
        if (!tagStats[tag]) {
          tagStats[tag] = { count: 0, totalReach: 0, avgReach: 0, avgCompletion: 0 };
        }
        tagStats[tag].count++;
        tagStats[tag].totalReach += ep.metrics.totalReach;
        tagStats[tag].avgCompletion += ep.metrics.avgCompletionRate;
      });
    });
    Object.keys(tagStats).forEach(tag => {
      tagStats[tag].avgReach = Math.round(tagStats[tag].totalReach / tagStats[tag].count);
      tagStats[tag].avgCompletion = parseFloat(
        (tagStats[tag].avgCompletion / tagStats[tag].count).toFixed(3)
      );
    });

    // Guest vs solo analysis
    const guestEps = episodes.filter(e => e.guest !== null);
    const soloEps = episodes.filter(e => e.guest === null);
    const guestVsSolo = {
      guest: {
        count: guestEps.length,
        avgReach: guestEps.length > 0 ? Math.round(guestEps.reduce((s, e) => s + e.metrics.totalReach, 0) / guestEps.length) : 0,
        avgCompletion: guestEps.length > 0 ? parseFloat((guestEps.reduce((s, e) => s + e.metrics.avgCompletionRate, 0) / guestEps.length).toFixed(3)) : 0
      },
      solo: {
        count: soloEps.length,
        avgReach: soloEps.length > 0 ? Math.round(soloEps.reduce((s, e) => s + e.metrics.totalReach, 0) / soloEps.length) : 0,
        avgCompletion: soloEps.length > 0 ? parseFloat((soloEps.reduce((s, e) => s + e.metrics.avgCompletionRate, 0) / soloEps.length).toFixed(3)) : 0
      }
    };

    // Duration vs engagement scatter data
    const durationVsEngagement = episodes.map(ep => ({
      episodeId: ep.id,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      duration: ep.duration,
      totalReach: ep.metrics.totalReach,
      completionRate: ep.metrics.avgCompletionRate,
      tags: ep.tags,
      hasGuest: ep.guest !== null
    }));

    // Growth trend (reach per episode over time)
    const growthTrend = episodes
      .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
      .map(ep => ({
        episodeNumber: ep.episodeNumber,
        publishDate: ep.publishDate,
        totalReach: ep.metrics.totalReach,
        title: ep.title
      }));

    return {
      summary: {
        totalEpisodes: episodes.length,
        avgReach: Math.round(avgReach),
        medianReach: Math.round(episodes[Math.floor(episodes.length / 2)]?.metrics.totalReach || 0)
      },
      topPerformers,
      bottomPerformers,
      dayOfWeekAnalysis: dayOfWeekStats,
      durationAnalysis: durationBuckets,
      tagAnalysis: tagStats,
      guestVsSolo,
      durationVsEngagement,
      growthTrend
    };
  }
}

module.exports = Aggregator;
