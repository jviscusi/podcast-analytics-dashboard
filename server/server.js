/**
 * Podcast Analytics Dashboard - Express Server
 * 
 * Hybrid data architecture:
 * - YouTube: Real data via YouTube Data API + Analytics API
 * - Spotify/Apple: Manual data entry via SQLite
 * - Episodes: Live RSS feed from Riverside.fm
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const Aggregator = require('./services/aggregator');
const ManualDataService = require('./services/manual-data-service');
const YouTubeService = require('./services/youtube-service');
const LinkedInService = require('./services/linkedin-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize services
const aggregator = new Aggregator();
const manualData = new ManualDataService();
const youtube = new YouTubeService();
const linkedin = new LinkedInService();

// ============================================
// Analytics API Routes
// ============================================

/**
 * GET /api/analytics/overview
 * Dashboard overview with aggregate KPIs
 */
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const overview = await aggregator.getOverview();
    res.json(overview);
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview data', details: error.message });
  }
});

/**
 * GET /api/analytics/episodes
 * All episodes with normalized cross-platform metrics
 */
app.get('/api/analytics/episodes', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      hasGuest: req.query.hasGuest !== undefined ? req.query.hasGuest === 'true' : undefined,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const episodes = await aggregator.getEpisodes(filters);
    res.json(episodes);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes data', details: error.message });
  }
});

/**
 * GET /api/analytics/episodes/:id
 * Single episode with full cross-platform detail
 */
app.get('/api/analytics/episodes/:id', async (req, res) => {
  try {
    const episode = await aggregator.getEpisodeDetail(req.params.id);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    res.json(episode);
  } catch (error) {
    console.error('Error fetching episode detail:', error);
    res.status(500).json({ error: 'Failed to fetch episode detail', details: error.message });
  }
});

/**
 * GET /api/analytics/trends
 * Aggregate daily trends across all platforms
 */
app.get('/api/analytics/trends', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      groupBy: req.query.groupBy
    };
    const trends = await aggregator.getTrends(filters);
    res.json(trends);
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends data', details: error.message });
  }
});

/**
 * GET /api/analytics/platforms
 * Platform comparison data
 */
app.get('/api/analytics/platforms', async (req, res) => {
  try {
    const comparison = await aggregator.getPlatformComparison();
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching platform comparison:', error);
    res.status(500).json({ error: 'Failed to fetch platform comparison data', details: error.message });
  }
});

/**
 * GET /api/analytics/insights
 * Performance insights and analysis
 */
app.get('/api/analytics/insights', async (req, res) => {
  try {
    const insights = await aggregator.getInsights();
    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights data', details: error.message });
  }
});

/**
 * GET /api/analytics/export
 * Export data as CSV
 */
app.get('/api/analytics/export', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      sortBy: req.query.sortBy || 'episodeNumber',
      sortOrder: req.query.sortOrder || 'asc'
    };
    const episodes = await aggregator.getEpisodes(filters);

    const headers = [
      'Episode #', 'Title', 'Publish Date', 'Duration (min)', 'Tags', 'Guest',
      'Total Reach', 'Total Listeners', 'Avg Completion Rate',
      'Spotify Streams', 'Spotify Listeners', 'Spotify Completion',
      'Apple Downloads', 'Apple Plays', 'Apple Listeners', 'Apple Consumption',
      'YouTube Views', 'YouTube Viewers', 'YouTube Avg Duration',
      'YouTube Likes', 'YouTube Comments',
      'Amazon Streams', 'Amazon Listeners', 'Amazon Completion', 'Amazon Followers',
      'Data Sources (Spotify)', 'Data Sources (Apple)', 'Data Sources (YouTube)', 'Data Sources (Amazon)'
    ];

    const rows = episodes.map(ep => [
      ep.episodeNumber,
      `"${ep.title}"`,
      ep.publishDate,
      ep.duration,
      `"${ep.tags.join(', ')}"`,
      ep.guest || '',
      ep.metrics.totalReach,
      ep.metrics.totalListeners,
      ep.metrics.avgCompletionRate,
      ep.metrics.platforms.spotify.streams,
      ep.metrics.platforms.spotify.listeners,
      ep.metrics.platforms.spotify.completionRate,
      ep.metrics.platforms.apple.downloads,
      ep.metrics.platforms.apple.plays,
      ep.metrics.platforms.apple.listeners,
      ep.metrics.platforms.apple.avgConsumption,
      ep.metrics.platforms.youtube.views,
      ep.metrics.platforms.youtube.viewers,
      ep.metrics.platforms.youtube.avgViewDuration,
      ep.metrics.platforms.youtube.likes,
      ep.metrics.platforms.youtube.comments,
      ep.metrics.platforms.amazon.streams,
      ep.metrics.platforms.amazon.listeners,
      ep.metrics.platforms.amazon.completionRate,
      ep.metrics.platforms.amazon.followers,
      ep.dataSources?.spotify || 'unknown',
      ep.dataSources?.apple || 'unknown',
      ep.dataSources?.youtube || 'unknown',
      ep.dataSources?.amazon || 'unknown'
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=podcast-analytics.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ============================================
// Manual Data Entry Routes
// ============================================

/**
 * GET /api/data/status
 * Get data source status for all platforms including date ranges and LinkedIn per-stream tracking
 */
app.get('/api/data/status', (req, res) => {
  try {
    const status = manualData.getDataSourceStatus();
    
    // Add data date ranges for podcast platforms
    for (const platform of ['spotify', 'apple', 'amazon']) {
      if (status[platform].episodeCount > 0) {
        status[platform].dataRange = manualData.getDataDateRange(platform);
      }
    }

    status.youtube = {
      dataSource: youtube.hasValidTokens() ? 'live' : 'not_authorized',
      lastUpdated: new Date().toISOString()
    };

    // Add LinkedIn upload tracking per data stream
    try {
      const liImportHistory = linkedin.getImportHistory();
      const liStreams = {};
      // Group by file_type, get latest for each
      liImportHistory.forEach(entry => {
        if (!liStreams[entry.file_type]) {
          liStreams[entry.file_type] = {
            lastUploaded: entry.import_date,
            fileName: entry.file_name,
            rowsInserted: entry.rows_inserted,
            rowsUpdated: entry.rows_updated
          };
        }
      });
      
      // Get date ranges for each LinkedIn data stream
      const liDateRanges = linkedin.getDataDateRanges ? linkedin.getDataDateRanges() : {};
      
      status.linkedin = {
        dataSource: Object.keys(liStreams).length > 0 ? 'csv_import' : 'none',
        streams: liStreams,
        dateRanges: liDateRanges,
        importHistory: liImportHistory.slice(0, 10) // Last 10 imports
      };
    } catch (e) {
      status.linkedin = { dataSource: 'none', streams: {}, dateRanges: {}, importHistory: [] };
    }

    res.json(status);
  } catch (error) {
    console.error('Error fetching data status:', error);
    res.status(500).json({ error: 'Failed to fetch data status' });
  }
});

/**
 * POST /api/data/metrics
 * Submit manual metrics for an episode
 * Body: { episodeId, platform, metrics: { streams: 100, listeners: 80, ... }, date?, notes? }
 */
app.post('/api/data/metrics', (req, res) => {
  try {
    const { episodeId, platform, metrics, date, notes } = req.body;

    if (!episodeId || !platform || !metrics) {
      return res.status(400).json({ error: 'episodeId, platform, and metrics are required' });
    }

    if (!['spotify', 'apple', 'amazon', 'riverside'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be spotify, apple, amazon, or riverside' });
    }

    const result = manualData.upsertMetrics(episodeId, platform, metrics, date, notes);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error saving metrics:', error);
    res.status(500).json({ error: 'Failed to save metrics', details: error.message });
  }
});

/**
 * POST /api/data/metrics/bulk
 * Submit metrics for multiple episodes at once
 * Body: { platform, episodes: [{ episodeId, metrics: {...} }, ...], date?, notes? }
 */
app.post('/api/data/metrics/bulk', (req, res) => {
  try {
    const { platform, episodes, date, notes } = req.body;

    if (!platform || !episodes || !Array.isArray(episodes)) {
      return res.status(400).json({ error: 'platform and episodes array are required' });
    }

    const results = [];
    for (const ep of episodes) {
      if (!ep.episodeId || !ep.metrics) continue;
      const result = manualData.upsertMetrics(ep.episodeId, platform, ep.metrics, date, notes);
      results.push(result);
    }

    res.json({ success: true, imported: results.length });
  } catch (error) {
    console.error('Error saving bulk metrics:', error);
    res.status(500).json({ error: 'Failed to save bulk metrics', details: error.message });
  }
});

/**
 * GET /api/data/metrics/:episodeId/:platform
 * Get manual metrics for a specific episode and platform
 */
app.get('/api/data/metrics/:episodeId/:platform', (req, res) => {
  try {
    const data = manualData.getEpisodeMetrics(req.params.episodeId, req.params.platform);
    res.json(data);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/data/metrics/:episodeId/:platform/history
 * Get historical metrics for an episode
 */
app.get('/api/data/metrics/:episodeId/:platform/history', (req, res) => {
  try {
    const history = manualData.getEpisodeHistory(req.params.episodeId, req.params.platform);
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * DELETE /api/data/metrics/:episodeId/:platform
 * Delete all manual metrics for an episode on a platform
 */
app.delete('/api/data/metrics/:episodeId/:platform', (req, res) => {
  try {
    const result = manualData.deleteEpisodeMetrics(req.params.episodeId, req.params.platform);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error deleting metrics:', error);
    res.status(500).json({ error: 'Failed to delete metrics' });
  }
});

/**
 * POST /api/data/import/csv
 * Import metrics from CSV
 * Body: { platform, csvContent }
 */
app.post('/api/data/import/csv', (req, res) => {
  try {
    const { platform, csvContent } = req.body;

    if (!platform || !csvContent) {
      return res.status(400).json({ error: 'platform and csvContent are required' });
    }

    const result = manualData.importCSV(csvContent, platform);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({ error: 'Failed to import CSV', details: error.message });
  }
});

// ============================================
// YouTube OAuth Routes
// ============================================

/**
 * GET /api/auth/youtube/status
 * Check if YouTube is authorized
 */
app.get('/api/auth/youtube/status', (req, res) => {
  res.json({
    authorized: youtube.hasValidTokens(),
    useMock: process.env.USE_MOCK_DATA !== 'false'
  });
});

/**
 * GET /api/auth/youtube/url
 * Get YouTube OAuth authorization URL
 */
app.get('/api/auth/youtube/url', (req, res) => {
  try {
    const url = youtube.getAuthUrl();
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate auth URL', details: error.message });
  }
});

/**
 * POST /api/auth/youtube/callback
 * Exchange authorization code for tokens
 * Body: { code }
 */
app.post('/api/auth/youtube/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    await youtube.exchangeCode(code);
    res.json({ success: true, message: 'YouTube authorized successfully' });
  } catch (error) {
    console.error('YouTube auth error:', error);
    res.status(500).json({ error: 'Failed to authorize YouTube', details: error.message });
  }
});

// ============================================
// LinkedIn Data Routes
// ============================================

/**
 * POST /api/linkedin/import
 * Import LinkedIn CSV data (auto-detects type)
 * Body: { csvContent, fileName? }
 */
app.post('/api/linkedin/import', (req, res) => {
  try {
    const { csvContent, fileName } = req.body;
    if (!csvContent) {
      return res.status(400).json({ error: 'csvContent is required' });
    }
    const result = linkedin.importCSV(csvContent, fileName);
    res.json(result);
  } catch (error) {
    console.error('Error importing LinkedIn CSV:', error);
    res.status(500).json({ error: 'Failed to import LinkedIn CSV', details: error.message });
  }
});

/**
 * POST /api/linkedin/import/batch
 * Import multiple LinkedIn CSV files at once
 * Body: { files: [{ csvContent, fileName }, ...] }
 */
app.post('/api/linkedin/import/batch', (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array is required' });
    }
    const results = files.map(f => linkedin.importCSV(f.csvContent, f.fileName));
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error batch importing LinkedIn CSVs:', error);
    res.status(500).json({ error: 'Failed to batch import', details: error.message });
  }
});

/**
 * GET /api/linkedin/summary
 * Get LinkedIn overview summary (followers, engagement, decision-maker %)
 */
app.get('/api/linkedin/summary', (req, res) => {
  try {
    const summary = linkedin.getSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching LinkedIn summary:', error);
    res.status(500).json({ error: 'Failed to fetch LinkedIn summary' });
  }
});

/**
 * GET /api/linkedin/demographics
 * Get follower demographics (all categories or specific)
 * Query: ?category=seniority|industry|company_size|location|job_function
 */
app.get('/api/linkedin/demographics', (req, res) => {
  try {
    const data = linkedin.getDemographics(req.query.category || null);
    res.json(data);
  } catch (error) {
    console.error('Error fetching LinkedIn demographics:', error);
    res.status(500).json({ error: 'Failed to fetch demographics' });
  }
});

/**
 * GET /api/linkedin/posts
 * Get all LinkedIn posts with engagement metrics
 */
app.get('/api/linkedin/posts', (req, res) => {
  try {
    const posts = linkedin.getPosts();
    res.json(posts);
  } catch (error) {
    console.error('Error fetching LinkedIn posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/**
 * GET /api/linkedin/engagement
 * Get daily engagement trends
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/linkedin/engagement', (req, res) => {
  try {
    const data = linkedin.getDailyEngagement(req.query.startDate, req.query.endDate);
    res.json(data);
  } catch (error) {
    console.error('Error fetching LinkedIn engagement:', error);
    res.status(500).json({ error: 'Failed to fetch engagement data' });
  }
});

/**
 * GET /api/linkedin/followers
 * Get follower growth trends
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/linkedin/followers', (req, res) => {
  try {
    const data = linkedin.getFollowerGrowth(req.query.startDate, req.query.endDate);
    res.json(data);
  } catch (error) {
    console.error('Error fetching LinkedIn followers:', error);
    res.status(500).json({ error: 'Failed to fetch follower data' });
  }
});

/**
 * GET /api/linkedin/visitors
 * Get page visitor trends
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/linkedin/visitors', (req, res) => {
  try {
    const data = linkedin.getVisitors(req.query.startDate, req.query.endDate);
    res.json(data);
  } catch (error) {
    console.error('Error fetching LinkedIn visitors:', error);
    res.status(500).json({ error: 'Failed to fetch visitor data' });
  }
});

/**
 * POST /api/linkedin/map-episodes
 * Auto-map LinkedIn posts to podcast episodes
 */
app.post('/api/linkedin/map-episodes', async (req, res) => {
  try {
    const episodes = await aggregator.getEpisodes();
    const mappings = linkedin.mapPostsToEpisodes(episodes);
    res.json({ success: true, mappings });
  } catch (error) {
    console.error('Error mapping episodes:', error);
    res.status(500).json({ error: 'Failed to map episodes', details: error.message });
  }
});

/**
 * GET /api/linkedin/correlation
 * Get episode-to-LinkedIn correlation data
 */
app.get('/api/linkedin/correlation', (req, res) => {
  try {
    const data = linkedin.getEpisodeCorrelation();
    res.json(data);
  } catch (error) {
    console.error('Error fetching correlation:', error);
    res.status(500).json({ error: 'Failed to fetch correlation data' });
  }
});

/**
 * GET /api/linkedin/import-history
 * Get import history log
 */
app.get('/api/linkedin/import-history', (req, res) => {
  try {
    const history = linkedin.getImportHistory();
    res.json(history);
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// ============================================
// Static Files & Server Start
// ============================================

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  const useMock = process.env.USE_MOCK_DATA !== 'false';
  const hasYouTubeTokens = youtube.hasValidTokens();

  console.log(`🎙️  Podcast Analytics API running on http://localhost:${PORT}`);
  console.log(`   Mode: ${useMock ? 'Mock Data' : 'Live APIs'}`);
  console.log(`   YouTube: ${useMock ? 'Mock' : (hasYouTubeTokens ? '✅ Authorized' : '⚠️  Not authorized (run: node services/youtube-auth.js)')}`);
  console.log(`   Spotify: Manual data entry (SQLite)`);
  console.log(`   Apple:   Manual data entry (SQLite)`);
  console.log(`   Amazon:  Manual data entry (SQLite)`);
  console.log(`   RSS:     ${process.env.RSS_FEED_URL || 'Not configured'}`);
  console.log('');
  console.log('   Analytics Endpoints:');
  console.log('     GET  /api/analytics/overview');
  console.log('     GET  /api/analytics/episodes');
  console.log('     GET  /api/analytics/episodes/:id');
  console.log('     GET  /api/analytics/trends');
  console.log('     GET  /api/analytics/platforms');
  console.log('     GET  /api/analytics/insights');
  console.log('     GET  /api/analytics/export');
  console.log('');
  console.log('   Data Management Endpoints:');
  console.log('     GET  /api/data/status');
  console.log('     POST /api/data/metrics');
  console.log('     POST /api/data/metrics/bulk');
  console.log('     POST /api/data/import/csv');
  console.log('     GET  /api/data/metrics/:episodeId/:platform');
  console.log('');
  console.log('   YouTube Auth:');
  console.log('     GET  /api/auth/youtube/status');
  console.log('     GET  /api/auth/youtube/url');
  console.log('     POST /api/auth/youtube/callback');
  console.log('');
  console.log('   LinkedIn Data:');
  console.log('     POST /api/linkedin/import');
  console.log('     POST /api/linkedin/import/batch');
  console.log('     GET  /api/linkedin/summary');
  console.log('     GET  /api/linkedin/demographics');
  console.log('     GET  /api/linkedin/posts');
  console.log('     GET  /api/linkedin/engagement');
  console.log('     GET  /api/linkedin/followers');
  console.log('     GET  /api/linkedin/visitors');
  console.log('     POST /api/linkedin/map-episodes');
  console.log('     GET  /api/linkedin/correlation');
});

module.exports = app;
