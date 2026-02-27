/**
 * Podcast Analytics Dashboard - Express Server
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const Aggregator = require('./services/aggregator');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize aggregator
const aggregator = new Aggregator();

// ============================================
// API Routes
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
    res.status(500).json({ error: 'Failed to fetch overview data' });
  }
});

/**
 * GET /api/analytics/episodes
 * All episodes with normalized cross-platform metrics
 * Query params: startDate, endDate, tags, hasGuest, sortBy, sortOrder
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
    res.status(500).json({ error: 'Failed to fetch episodes data' });
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
    res.status(500).json({ error: 'Failed to fetch episode detail' });
  }
});

/**
 * GET /api/analytics/trends
 * Aggregate daily trends across all platforms
 * Query params: startDate, endDate, groupBy (day|week)
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
    res.status(500).json({ error: 'Failed to fetch trends data' });
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
    res.status(500).json({ error: 'Failed to fetch platform comparison data' });
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
    res.status(500).json({ error: 'Failed to fetch insights data' });
  }
});

/**
 * GET /api/analytics/export
 * Export data as CSV
 * Query params: same as /episodes
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

    // Build CSV
    const headers = [
      'Episode #', 'Title', 'Publish Date', 'Duration (min)', 'Tags', 'Guest',
      'Total Reach', 'Total Listeners', 'Avg Completion Rate',
      'Spotify Streams', 'Spotify Listeners', 'Spotify Completion',
      'Apple Downloads', 'Apple Plays', 'Apple Listeners', 'Apple Consumption',
      'YouTube Views', 'YouTube Viewers', 'YouTube Avg Duration',
      'YouTube Likes', 'YouTube Comments'
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
      ep.metrics.platforms.youtube.comments
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🎙️  Podcast Analytics API running on http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.USE_MOCK_DATA !== 'false' ? 'Mock Data' : 'Live APIs'}`);
  console.log(`   Endpoints:`);
  console.log(`     GET /api/analytics/overview`);
  console.log(`     GET /api/analytics/episodes`);
  console.log(`     GET /api/analytics/episodes/:id`);
  console.log(`     GET /api/analytics/trends`);
  console.log(`     GET /api/analytics/platforms`);
  console.log(`     GET /api/analytics/insights`);
  console.log(`     GET /api/analytics/export`);
});

module.exports = app;
