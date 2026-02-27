/**
 * Manual Data Entry Service
 * 
 * Stores manually-entered platform metrics (Spotify, Apple, Riverside)
 * in a local SQLite database. Used when platform APIs are not available.
 * 
 * Data can be entered via:
 * - API endpoints (POST/PUT)
 * - CSV import
 * - Dashboard UI data entry form
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/manual-metrics.db');

class ManualDataService {
  constructor() {
    this._db = null;
  }

  /**
   * Get or create database connection
   */
  _getDb() {
    if (this._db) return this._db;

    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this._db = new Database(DB_PATH);
    this._db.pragma('journal_mode = WAL');
    this._initSchema();
    return this._db;
  }

  /**
   * Initialize database schema
   */
  _initSchema() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS episode_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK(platform IN ('spotify', 'apple', 'riverside')),
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        recorded_date TEXT NOT NULL DEFAULT (date('now')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(episode_id, platform, metric_name, recorded_date)
      );

      CREATE INDEX IF NOT EXISTS idx_episode_platform 
        ON episode_metrics(episode_id, platform);
      
      CREATE INDEX IF NOT EXISTS idx_platform_date 
        ON episode_metrics(platform, recorded_date);

      CREATE TABLE IF NOT EXISTS data_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('manual', 'csv_import', 'api')),
        last_updated TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT
      );
    `);
  }

  /**
   * Upsert metrics for an episode on a platform
   * @param {string} episodeId - Episode identifier
   * @param {string} platform - 'spotify', 'apple', or 'riverside'
   * @param {Object} metrics - Key-value pairs of metric names and values
   * @param {string} [recordedDate] - Date the metrics were recorded (defaults to today)
   * @param {string} [notes] - Optional notes about the data
   */
  upsertMetrics(episodeId, platform, metrics, recordedDate = null, notes = null) {
    const db = this._getDb();
    const date = recordedDate || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO episode_metrics (episode_id, platform, metric_name, metric_value, recorded_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(episode_id, platform, metric_name, recorded_date)
      DO UPDATE SET 
        metric_value = excluded.metric_value,
        notes = excluded.notes,
        updated_at = datetime('now')
    `);

    const upsertMany = db.transaction((entries) => {
      for (const [name, value] of entries) {
        stmt.run(episodeId, platform, name, value, date, notes);
      }
    });

    upsertMany(Object.entries(metrics));

    // Update data source tracking
    db.prepare(`
      INSERT INTO data_sources (platform, source_type, notes)
      VALUES (?, 'manual', ?)
      ON CONFLICT DO NOTHING
    `).run(platform, `Updated ${episodeId}`);

    return { episodeId, platform, metricsCount: Object.keys(metrics).length };
  }

  /**
   * Get latest metrics for an episode on a platform
   */
  getEpisodeMetrics(episodeId, platform) {
    const db = this._getDb();

    const rows = db.prepare(`
      SELECT metric_name, metric_value, recorded_date, notes
      FROM episode_metrics
      WHERE episode_id = ? AND platform = ?
      AND recorded_date = (
        SELECT MAX(recorded_date) FROM episode_metrics 
        WHERE episode_id = ? AND platform = ?
      )
    `).all(episodeId, platform, episodeId, platform);

    const metrics = {};
    rows.forEach(row => {
      metrics[row.metric_name] = row.metric_value;
    });

    return {
      episodeId,
      platform,
      metrics,
      recordedDate: rows[0]?.recorded_date || null,
      dataSource: 'manual'
    };
  }

  /**
   * Get all episodes' metrics for a platform (latest values)
   */
  getAllEpisodeMetrics(platform) {
    const db = this._getDb();

    // Get the latest recorded_date per episode+platform+metric
    const rows = db.prepare(`
      SELECT em.episode_id, em.metric_name, em.metric_value, em.recorded_date
      FROM episode_metrics em
      INNER JOIN (
        SELECT episode_id, metric_name, MAX(recorded_date) as max_date
        FROM episode_metrics
        WHERE platform = ?
        GROUP BY episode_id, metric_name
      ) latest ON em.episode_id = latest.episode_id 
        AND em.metric_name = latest.metric_name 
        AND em.recorded_date = latest.max_date
      WHERE em.platform = ?
      ORDER BY em.episode_id
    `).all(platform, platform);

    // Group by episode
    const episodeMap = {};
    rows.forEach(row => {
      if (!episodeMap[row.episode_id]) {
        episodeMap[row.episode_id] = {
          episodeId: row.episode_id,
          platform,
          metrics: {},
          recordedDate: row.recorded_date,
          dataSource: 'manual'
        };
      }
      episodeMap[row.episode_id].metrics[row.metric_name] = row.metric_value;
    });

    return Object.values(episodeMap);
  }

  /**
   * Get Spotify metrics formatted for the aggregator
   */
  getSpotifyEpisodes() {
    const episodes = this.getAllEpisodeMetrics('spotify');
    return episodes.map(ep => ({
      episodeId: ep.episodeId,
      platform: 'spotify',
      dataSource: 'manual',
      metrics: {
        totalStreams: ep.metrics.streams || ep.metrics.totalStreams || 0,
        totalListeners: ep.metrics.listeners || ep.metrics.totalListeners || 0,
        completionRate: (ep.metrics.completionRate || ep.metrics.completion_rate || 0) / 
          ((ep.metrics.completionRate || ep.metrics.completion_rate || 0) > 1 ? 100 : 1),
        starts: ep.metrics.starts || 0,
        saves: ep.metrics.saves || 0,
        shares: ep.metrics.shares || 0
      }
    }));
  }

  /**
   * Get Apple metrics formatted for the aggregator
   */
  getAppleEpisodes() {
    const episodes = this.getAllEpisodeMetrics('apple');
    return episodes.map(ep => ({
      episodeId: ep.episodeId,
      platform: 'apple',
      dataSource: 'manual',
      metrics: {
        totalDownloads: ep.metrics.downloads || ep.metrics.totalDownloads || 0,
        totalPlays: ep.metrics.plays || ep.metrics.totalPlays || 0,
        uniqueListeners: ep.metrics.listeners || ep.metrics.uniqueListeners || 0,
        avgConsumption: (ep.metrics.avgConsumption || ep.metrics.consumption || 0) /
          ((ep.metrics.avgConsumption || ep.metrics.consumption || 0) > 1 ? 100 : 1),
        engagedListeners: ep.metrics.engagedListeners || ep.metrics.engaged || 0
      }
    }));
  }

  /**
   * Import metrics from CSV data
   * Expected CSV format: episodeId, platform, metricName, value, date
   * Or platform-specific format with headers
   */
  importCSV(csvContent, platform) {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const results = { imported: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx]; });

        // Determine episode ID
        const episodeId = row.episode_id || row.episodeid || row.id || row.episode;
        if (!episodeId) {
          results.errors.push(`Row ${i + 1}: Missing episode ID`);
          continue;
        }

        // Build metrics object from remaining columns
        const metrics = {};
        const skipCols = ['episode_id', 'episodeid', 'id', 'episode', 'platform', 'date', 'notes'];
        headers.forEach((h, idx) => {
          if (!skipCols.includes(h) && values[idx] && !isNaN(parseFloat(values[idx]))) {
            metrics[h] = parseFloat(values[idx]);
          }
        });

        if (Object.keys(metrics).length === 0) {
          results.errors.push(`Row ${i + 1}: No numeric metrics found`);
          continue;
        }

        const recordedDate = row.date || new Date().toISOString().split('T')[0];
        this.upsertMetrics(episodeId, platform, metrics, recordedDate, row.notes || `CSV import row ${i + 1}`);
        results.imported++;
      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get data source status for all platforms
   */
  getDataSourceStatus() {
    const db = this._getDb();

    const platforms = ['spotify', 'apple', 'riverside'];
    const status = {};

    for (const platform of platforms) {
      const count = db.prepare(
        'SELECT COUNT(DISTINCT episode_id) as count FROM episode_metrics WHERE platform = ?'
      ).get(platform);

      const latest = db.prepare(
        'SELECT MAX(updated_at) as latest FROM episode_metrics WHERE platform = ?'
      ).get(platform);

      status[platform] = {
        episodeCount: count?.count || 0,
        lastUpdated: latest?.latest || null,
        dataSource: count?.count > 0 ? 'manual' : 'none'
      };
    }

    return status;
  }

  /**
   * Delete all metrics for an episode on a platform
   */
  deleteEpisodeMetrics(episodeId, platform) {
    const db = this._getDb();
    const result = db.prepare(
      'DELETE FROM episode_metrics WHERE episode_id = ? AND platform = ?'
    ).run(episodeId, platform);
    return { deleted: result.changes };
  }

  /**
   * Get historical metrics for an episode (all recorded dates)
   */
  getEpisodeHistory(episodeId, platform) {
    const db = this._getDb();

    const rows = db.prepare(`
      SELECT metric_name, metric_value, recorded_date
      FROM episode_metrics
      WHERE episode_id = ? AND platform = ?
      ORDER BY recorded_date ASC, metric_name
    `).all(episodeId, platform);

    // Group by date
    const dateMap = {};
    rows.forEach(row => {
      if (!dateMap[row.recorded_date]) {
        dateMap[row.recorded_date] = {};
      }
      dateMap[row.recorded_date][row.metric_name] = row.metric_value;
    });

    return Object.entries(dateMap).map(([date, metrics]) => ({
      date,
      metrics
    }));
  }

  /**
   * Close database connection
   */
  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

module.exports = ManualDataService;
