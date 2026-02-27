/**
 * LinkedIn Data Import Service
 * 
 * Parses LinkedIn CSV exports and stores them in SQLite.
 * Handles 5 types of LinkedIn data:
 * 1. Follower Demographics (seniority, industry, company size, location, job function)
 * 2. Content/Post Engagement (per-post metrics)
 * 3. Daily Aggregate Engagement (daily impressions, clicks, reactions)
 * 4. Follower Growth (daily organic/sponsored follower counts)
 * 5. Page Visitors (daily page views and unique visitors)
 * 
 * All imports use UPSERT logic to prevent duplicates:
 * - Date-based data: overwrites existing date rows
 * - Post data: overwrites existing post URL rows
 * - Demographics: stored as snapshots with import_date
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/linkedin-data.db');

class LinkedInService {
  constructor() {
    this._db = null;
  }

  _getDb() {
    if (this._db) return this._db;

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

  _initSchema() {
    this._db.exec(`
      -- Follower demographics snapshots
      CREATE TABLE IF NOT EXISTS linkedin_demographics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK(category IN ('seniority', 'industry', 'company_size', 'location', 'job_function')),
        label TEXT NOT NULL,
        value INTEGER NOT NULL,
        import_date TEXT NOT NULL DEFAULT (date('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(category, label, import_date)
      );

      CREATE INDEX IF NOT EXISTS idx_demo_category_date
        ON linkedin_demographics(category, import_date);

      -- Individual post engagement
      CREATE TABLE IF NOT EXISTS linkedin_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_url TEXT NOT NULL,
        post_title TEXT,
        post_type TEXT,
        posted_by TEXT,
        created_date TEXT,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        ctr REAL DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        reposts INTEGER DEFAULT 0,
        follows INTEGER DEFAULT 0,
        engagement_rate REAL DEFAULT 0,
        content_type TEXT,
        episode_id TEXT,
        import_date TEXT NOT NULL DEFAULT (date('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(post_url)
      );

      CREATE INDEX IF NOT EXISTS idx_posts_date
        ON linkedin_posts(created_date);

      CREATE INDEX IF NOT EXISTS idx_posts_episode
        ON linkedin_posts(episode_id);

      -- Daily aggregate engagement
      CREATE TABLE IF NOT EXISTS linkedin_daily_engagement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        impressions_organic INTEGER DEFAULT 0,
        impressions_sponsored INTEGER DEFAULT 0,
        impressions_total INTEGER DEFAULT 0,
        unique_impressions_organic INTEGER DEFAULT 0,
        clicks_organic INTEGER DEFAULT 0,
        clicks_sponsored INTEGER DEFAULT 0,
        clicks_total INTEGER DEFAULT 0,
        reactions_organic INTEGER DEFAULT 0,
        reactions_sponsored INTEGER DEFAULT 0,
        reactions_total INTEGER DEFAULT 0,
        comments_organic INTEGER DEFAULT 0,
        comments_sponsored INTEGER DEFAULT 0,
        comments_total INTEGER DEFAULT 0,
        reposts_organic INTEGER DEFAULT 0,
        reposts_sponsored INTEGER DEFAULT 0,
        reposts_total INTEGER DEFAULT 0,
        engagement_rate_organic REAL DEFAULT 0,
        engagement_rate_sponsored REAL DEFAULT 0,
        engagement_rate_total REAL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(date)
      );

      -- Daily follower growth
      CREATE TABLE IF NOT EXISTS linkedin_follower_growth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        sponsored_followers INTEGER DEFAULT 0,
        organic_followers INTEGER DEFAULT 0,
        auto_invited_followers INTEGER DEFAULT 0,
        total_followers INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(date)
      );

      -- Daily page visitors
      CREATE TABLE IF NOT EXISTS linkedin_visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        overview_views_desktop INTEGER DEFAULT 0,
        overview_views_mobile INTEGER DEFAULT 0,
        overview_views_total INTEGER DEFAULT 0,
        overview_unique_desktop INTEGER DEFAULT 0,
        overview_unique_mobile INTEGER DEFAULT 0,
        overview_unique_total INTEGER DEFAULT 0,
        total_views_desktop INTEGER DEFAULT 0,
        total_views_mobile INTEGER DEFAULT 0,
        total_views_total INTEGER DEFAULT 0,
        total_unique_desktop INTEGER DEFAULT 0,
        total_unique_mobile INTEGER DEFAULT 0,
        total_unique_total INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(date)
      );

      -- Import log for tracking
      CREATE TABLE IF NOT EXISTS linkedin_import_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_type TEXT NOT NULL,
        file_name TEXT,
        rows_inserted INTEGER DEFAULT 0,
        rows_updated INTEGER DEFAULT 0,
        rows_skipped INTEGER DEFAULT 0,
        import_date TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // ============================================
  // CSV Parsing Utilities
  // ============================================

  /**
   * Parse CSV content, handling quoted fields with commas AND newlines
   */
  _parseCSV(content) {
    // Skip description rows (LinkedIn adds a description line before headers)
    let text = content.trim();
    const firstLine = text.split('\n')[0];
    if (firstLine.includes('Engagement metrics') || firstLine.includes('Aggregated engagement')) {
      // Remove the first line (description)
      const idx = text.indexOf('\n');
      text = text.substring(idx + 1).trim();
    }

    // Parse all logical rows (handling multi-line quoted fields)
    const logicalRows = this._splitCSVRows(text);
    if (logicalRows.length < 2) return { headers: [], rows: [] };

    const headers = this._parseCSVLine(logicalRows[0]);
    const rows = [];

    for (let i = 1; i < logicalRows.length; i++) {
      const line = logicalRows[i].trim();
      if (!line) continue;
      const values = this._parseCSVLine(line);
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((h, idx) => {
          row[h.trim()] = (values[idx] || '').trim();
        });
        rows.push(row);
      }
    }

    return { headers, rows };
  }

  /**
   * Split CSV text into logical rows, handling multi-line quoted fields
   */
  _splitCSVRows(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === '\n' && !inQuotes) {
        if (current.trim()) rows.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) rows.push(current);
    return rows;
  }

  /**
   * Parse a single CSV line, respecting quoted fields
   */
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Normalize date from MM/DD/YYYY to YYYY-MM-DD
   */
  _normalizeDate(dateStr) {
    if (!dateStr) return null;
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    return dateStr;
  }

  // ============================================
  // Auto-detect CSV Type
  // ============================================

  /**
   * Auto-detect the type of LinkedIn CSV based on headers/content
   */
  detectCSVType(content) {
    const firstLine = content.split('\n')[0].toLowerCase();
    const secondLine = content.split('\n')[1]?.toLowerCase() || '';

    // Check for description line (content files have these)
    if (firstLine.includes('engagement metrics for individual posts')) return 'posts';
    if (firstLine.includes('aggregated engagement metrics')) return 'daily_engagement';

    // Check headers
    const headerLine = firstLine.includes('engagement') ? secondLine : firstLine;

    if (headerLine.includes('seniority')) return 'demographics_seniority';
    if (headerLine.includes('industry')) return 'demographics_industry';
    if (headerLine.includes('company size')) return 'demographics_company_size';
    if (headerLine.includes('job function')) return 'demographics_job_function';
    if (headerLine.includes('location') && headerLine.includes('total followers')) return 'demographics_location';
    if (headerLine.includes('sponsored followers') || headerLine.includes('organic followers')) return 'follower_growth';
    if (headerLine.includes('overview page views') || headerLine.includes('total page views')) return 'visitors';
    if (headerLine.includes('post title') || headerLine.includes('post link')) return 'posts';
    if (headerLine.includes('impressions (organic)')) return 'daily_engagement';

    return 'unknown';
  }

  // ============================================
  // Import Methods
  // ============================================

  /**
   * Import any LinkedIn CSV — auto-detects type
   */
  importCSV(content, fileName = null) {
    const type = this.detectCSVType(content);

    switch (type) {
      case 'demographics_seniority':
        return this.importDemographics(content, 'seniority', fileName);
      case 'demographics_industry':
        return this.importDemographics(content, 'industry', fileName);
      case 'demographics_company_size':
        return this.importDemographics(content, 'company_size', fileName);
      case 'demographics_location':
        return this.importDemographics(content, 'location', fileName);
      case 'demographics_job_function':
        return this.importDemographics(content, 'job_function', fileName);
      case 'posts':
        return this.importPosts(content, fileName);
      case 'daily_engagement':
        return this.importDailyEngagement(content, fileName);
      case 'follower_growth':
        return this.importFollowerGrowth(content, fileName);
      case 'visitors':
        return this.importVisitors(content, fileName);
      default:
        return { success: false, error: `Could not detect CSV type. First line: "${content.split('\n')[0].substring(0, 100)}"` };
    }
  }

  /**
   * Import follower demographics (seniority, industry, company_size, location, job_function)
   */
  importDemographics(content, category, fileName = null) {
    const { rows } = this._parseCSV(content);
    const db = this._getDb();
    const today = new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO linkedin_demographics (category, label, value, import_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(category, label, import_date)
      DO UPDATE SET value = excluded.value
    `);

    let inserted = 0, updated = 0;

    const importAll = db.transaction(() => {
      for (const row of rows) {
        // First column is the label, second is the value
        const keys = Object.keys(row);
        const label = row[keys[0]];
        const value = parseInt(row[keys[1]]) || 0;

        if (!label || value === 0) continue;

        // Check if exists
        const existing = db.prepare(
          'SELECT value FROM linkedin_demographics WHERE category = ? AND label = ? AND import_date = ?'
        ).get(category, label, today);

        stmt.run(category, label, value, today);

        if (existing) {
          if (existing.value !== value) updated++;
        } else {
          inserted++;
        }
      }
    });

    importAll();

    this._logImport(`demographics_${category}`, fileName, inserted, updated, 0);

    return {
      success: true,
      type: `demographics_${category}`,
      inserted,
      updated,
      skipped: 0,
      total: rows.length
    };
  }

  /**
   * Import individual post engagement data
   */
  importPosts(content, fileName = null) {
    const { rows } = this._parseCSV(content);
    const db = this._getDb();

    const stmt = db.prepare(`
      INSERT INTO linkedin_posts (
        post_url, post_title, post_type, posted_by, created_date,
        impressions, clicks, ctr, likes, comments, reposts, follows,
        engagement_rate, content_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(post_url)
      DO UPDATE SET
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        ctr = excluded.ctr,
        likes = excluded.likes,
        comments = excluded.comments,
        reposts = excluded.reposts,
        follows = excluded.follows,
        engagement_rate = excluded.engagement_rate,
        updated_at = datetime('now')
    `);

    let inserted = 0, updated = 0, skipped = 0;

    const importAll = db.transaction(() => {
      for (const row of rows) {
        const postUrl = row['Post link'];
        if (!postUrl) { skipped++; continue; }

        const createdDate = this._normalizeDate(row['Created date']);

        const existing = db.prepare('SELECT id FROM linkedin_posts WHERE post_url = ?').get(postUrl);

        stmt.run(
          postUrl,
          (row['Post title'] || '').substring(0, 500),
          row['Post type'] || null,
          row['Posted by'] || null,
          createdDate,
          parseInt(row['Impressions']) || 0,
          parseInt(row['Clicks']) || 0,
          parseFloat(row['Click through rate (CTR)']) || 0,
          parseInt(row['Likes']) || 0,
          parseInt(row['Comments']) || 0,
          parseInt(row['Reposts']) || 0,
          parseInt(row['Follows']) || 0,
          parseFloat(row['Engagement rate']) || 0,
          row['Content Type'] || null
        );

        if (existing) updated++;
        else inserted++;
      }
    });

    importAll();

    this._logImport('posts', fileName, inserted, updated, skipped);

    return { success: true, type: 'posts', inserted, updated, skipped, total: rows.length };
  }

  /**
   * Import daily aggregate engagement data
   */
  importDailyEngagement(content, fileName = null) {
    const { rows } = this._parseCSV(content);
    const db = this._getDb();

    const stmt = db.prepare(`
      INSERT INTO linkedin_daily_engagement (
        date, impressions_organic, impressions_sponsored, impressions_total,
        unique_impressions_organic, clicks_organic, clicks_sponsored, clicks_total,
        reactions_organic, reactions_sponsored, reactions_total,
        comments_organic, comments_sponsored, comments_total,
        reposts_organic, reposts_sponsored, reposts_total,
        engagement_rate_organic, engagement_rate_sponsored, engagement_rate_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date)
      DO UPDATE SET
        impressions_organic = excluded.impressions_organic,
        impressions_sponsored = excluded.impressions_sponsored,
        impressions_total = excluded.impressions_total,
        unique_impressions_organic = excluded.unique_impressions_organic,
        clicks_organic = excluded.clicks_organic,
        clicks_sponsored = excluded.clicks_sponsored,
        clicks_total = excluded.clicks_total,
        reactions_organic = excluded.reactions_organic,
        reactions_sponsored = excluded.reactions_sponsored,
        reactions_total = excluded.reactions_total,
        comments_organic = excluded.comments_organic,
        comments_sponsored = excluded.comments_sponsored,
        comments_total = excluded.comments_total,
        reposts_organic = excluded.reposts_organic,
        reposts_sponsored = excluded.reposts_sponsored,
        reposts_total = excluded.reposts_total,
        engagement_rate_organic = excluded.engagement_rate_organic,
        engagement_rate_sponsored = excluded.engagement_rate_sponsored,
        engagement_rate_total = excluded.engagement_rate_total,
        updated_at = datetime('now')
    `);

    let inserted = 0, updated = 0;

    const importAll = db.transaction(() => {
      for (const row of rows) {
        const date = this._normalizeDate(row['Date']);
        if (!date) continue;

        const existing = db.prepare('SELECT id FROM linkedin_daily_engagement WHERE date = ?').get(date);

        stmt.run(
          date,
          parseInt(row['Impressions (organic)']) || 0,
          parseInt(row['Impressions (sponsored)']) || 0,
          parseInt(row['Impressions (total)']) || 0,
          parseInt(row['Unique impressions (organic)']) || 0,
          parseInt(row['Clicks (organic)']) || 0,
          parseInt(row['Clicks (sponsored)']) || 0,
          parseInt(row['Clicks (total)']) || 0,
          parseInt(row['Reactions (organic)']) || 0,
          parseInt(row['Reactions (sponsored)']) || 0,
          parseInt(row['Reactions (total)']) || 0,
          parseInt(row['Comments (organic)']) || 0,
          parseInt(row['Comments (sponsored)']) || 0,
          parseInt(row['Comments (total)']) || 0,
          parseInt(row['Reposts (organic)']) || 0,
          parseInt(row['Reposts (sponsored)']) || 0,
          parseInt(row['Reposts (total)']) || 0,
          parseFloat(row['Engagement rate (organic)']) || 0,
          parseFloat(row['Engagement rate (sponsored)']) || 0,
          parseFloat(row['Engagement rate (total)']) || 0
        );

        if (existing) updated++;
        else inserted++;
      }
    });

    importAll();

    this._logImport('daily_engagement', fileName, inserted, updated, 0);

    return { success: true, type: 'daily_engagement', inserted, updated, skipped: 0, total: rows.length };
  }

  /**
   * Import follower growth data
   */
  importFollowerGrowth(content, fileName = null) {
    const { rows } = this._parseCSV(content);
    const db = this._getDb();

    const stmt = db.prepare(`
      INSERT INTO linkedin_follower_growth (date, sponsored_followers, organic_followers, auto_invited_followers, total_followers)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date)
      DO UPDATE SET
        sponsored_followers = excluded.sponsored_followers,
        organic_followers = excluded.organic_followers,
        auto_invited_followers = excluded.auto_invited_followers,
        total_followers = excluded.total_followers,
        updated_at = datetime('now')
    `);

    let inserted = 0, updated = 0;

    const importAll = db.transaction(() => {
      for (const row of rows) {
        const date = this._normalizeDate(row['Date']);
        if (!date) continue;

        const existing = db.prepare('SELECT id FROM linkedin_follower_growth WHERE date = ?').get(date);

        stmt.run(
          date,
          parseInt(row['Sponsored followers']) || 0,
          parseInt(row['Organic followers']) || 0,
          parseInt(row['Auto-invited followers']) || 0,
          parseInt(row['Total followers']) || 0
        );

        if (existing) updated++;
        else inserted++;
      }
    });

    importAll();

    this._logImport('follower_growth', fileName, inserted, updated, 0);

    return { success: true, type: 'follower_growth', inserted, updated, skipped: 0, total: rows.length };
  }

  /**
   * Import page visitor data
   */
  importVisitors(content, fileName = null) {
    const { rows } = this._parseCSV(content);
    const db = this._getDb();

    const stmt = db.prepare(`
      INSERT INTO linkedin_visitors (
        date, overview_views_desktop, overview_views_mobile, overview_views_total,
        overview_unique_desktop, overview_unique_mobile, overview_unique_total,
        total_views_desktop, total_views_mobile, total_views_total,
        total_unique_desktop, total_unique_mobile, total_unique_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date)
      DO UPDATE SET
        overview_views_desktop = excluded.overview_views_desktop,
        overview_views_mobile = excluded.overview_views_mobile,
        overview_views_total = excluded.overview_views_total,
        overview_unique_desktop = excluded.overview_unique_desktop,
        overview_unique_mobile = excluded.overview_unique_mobile,
        overview_unique_total = excluded.overview_unique_total,
        total_views_desktop = excluded.total_views_desktop,
        total_views_mobile = excluded.total_views_mobile,
        total_views_total = excluded.total_views_total,
        total_unique_desktop = excluded.total_unique_desktop,
        total_unique_mobile = excluded.total_unique_mobile,
        total_unique_total = excluded.total_unique_total,
        updated_at = datetime('now')
    `);

    let inserted = 0, updated = 0;

    const importAll = db.transaction(() => {
      for (const row of rows) {
        const date = this._normalizeDate(row['Date']);
        if (!date) continue;

        const existing = db.prepare('SELECT id FROM linkedin_visitors WHERE date = ?').get(date);

        stmt.run(
          date,
          parseInt(row['Overview page views (desktop)']) || 0,
          parseInt(row['Overview page views (mobile)']) || 0,
          parseInt(row['Overview page views (total)']) || 0,
          parseInt(row['Overview unique visitors (desktop)']) || 0,
          parseInt(row['Overview unique visitors (mobile)']) || 0,
          parseInt(row['Overview unique visitors (total)']) || 0,
          parseInt(row['Total page views (desktop)']) || 0,
          parseInt(row['Total page views (mobile)']) || 0,
          parseInt(row['Total page views (total)']) || 0,
          parseInt(row['Total unique visitors (desktop)']) || 0,
          parseInt(row['Total unique visitors (mobile)']) || 0,
          parseInt(row['Total unique visitors (total)']) || 0
        );

        if (existing) updated++;
        else inserted++;
      }
    });

    importAll();

    this._logImport('visitors', fileName, inserted, updated, 0);

    return { success: true, type: 'visitors', inserted, updated, skipped: 0, total: rows.length };
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get follower demographics (latest snapshot for each category)
   */
  getDemographics(category = null) {
    const db = this._getDb();

    if (category) {
      const latestDate = db.prepare(
        'SELECT MAX(import_date) as d FROM linkedin_demographics WHERE category = ?'
      ).get(category);

      if (!latestDate?.d) return [];

      return db.prepare(
        'SELECT label, value FROM linkedin_demographics WHERE category = ? AND import_date = ? ORDER BY value DESC'
      ).all(category, latestDate.d);
    }

    // All categories
    const categories = ['seniority', 'industry', 'company_size', 'location', 'job_function'];
    const result = {};

    for (const cat of categories) {
      const latestDate = db.prepare(
        'SELECT MAX(import_date) as d FROM linkedin_demographics WHERE category = ?'
      ).get(cat);

      if (latestDate?.d) {
        result[cat] = db.prepare(
          'SELECT label, value FROM linkedin_demographics WHERE category = ? AND import_date = ? ORDER BY value DESC'
        ).all(cat, latestDate.d);
      } else {
        result[cat] = [];
      }
    }

    return result;
  }

  /**
   * Get all posts with engagement metrics
   */
  getPosts() {
    const db = this._getDb();
    return db.prepare(
      'SELECT * FROM linkedin_posts ORDER BY created_date DESC'
    ).all();
  }

  /**
   * Get daily engagement trends
   */
  getDailyEngagement(startDate = null, endDate = null) {
    const db = this._getDb();
    let query = 'SELECT * FROM linkedin_daily_engagement';
    const params = [];

    if (startDate || endDate) {
      const conditions = [];
      if (startDate) { conditions.push('date >= ?'); params.push(startDate); }
      if (endDate) { conditions.push('date <= ?'); params.push(endDate); }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date ASC';
    return db.prepare(query).all(...params);
  }

  /**
   * Get follower growth trends
   */
  getFollowerGrowth(startDate = null, endDate = null) {
    const db = this._getDb();
    let query = 'SELECT * FROM linkedin_follower_growth';
    const params = [];

    if (startDate || endDate) {
      const conditions = [];
      if (startDate) { conditions.push('date >= ?'); params.push(startDate); }
      if (endDate) { conditions.push('date <= ?'); params.push(endDate); }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date ASC';
    return db.prepare(query).all(...params);
  }

  /**
   * Get page visitor trends
   */
  getVisitors(startDate = null, endDate = null) {
    const db = this._getDb();
    let query = 'SELECT * FROM linkedin_visitors';
    const params = [];

    if (startDate || endDate) {
      const conditions = [];
      if (startDate) { conditions.push('date >= ?'); params.push(startDate); }
      if (endDate) { conditions.push('date <= ?'); params.push(endDate); }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date ASC';
    return db.prepare(query).all(...params);
  }

  /**
   * Get LinkedIn overview summary
   */
  getSummary() {
    const db = this._getDb();

    // Total followers from demographics
    const seniority = this.getDemographics('seniority');
    const totalFollowers = seniority.reduce((sum, s) => sum + s.value, 0);

    // Decision-maker percentage (Director + VP + CXO + Owner + Partner)
    const decisionMakerTitles = ['Director', 'VP', 'CXO', 'Owner', 'Partner'];
    const decisionMakers = seniority
      .filter(s => decisionMakerTitles.includes(s.label))
      .reduce((sum, s) => sum + s.value, 0);
    const decisionMakerPct = totalFollowers > 0
      ? parseFloat((decisionMakers / totalFollowers * 100).toFixed(1))
      : 0;

    // Post engagement
    const posts = this.getPosts();
    const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
    const totalClicks = posts.reduce((sum, p) => sum + p.clicks, 0);
    const avgEngagementRate = posts.length > 0
      ? parseFloat((posts.reduce((sum, p) => sum + p.engagement_rate, 0) / posts.length * 100).toFixed(1))
      : 0;

    // Daily engagement totals
    const dailyData = this.getDailyEngagement();
    const totalDailyImpressions = dailyData.reduce((sum, d) => sum + d.impressions_total, 0);

    // Follower growth
    const growth = this.getFollowerGrowth();
    const totalNewFollowers = growth.reduce((sum, d) => sum + d.total_followers, 0);

    return {
      totalFollowers,
      decisionMakers,
      decisionMakerPct,
      totalPosts: posts.length,
      totalImpressions: Math.max(totalImpressions, totalDailyImpressions),
      totalClicks,
      avgEngagementRate,
      totalNewFollowers,
      dataAvailable: {
        demographics: seniority.length > 0,
        posts: posts.length > 0,
        dailyEngagement: dailyData.length > 0,
        followerGrowth: growth.length > 0,
        visitors: this.getVisitors().length > 0
      }
    };
  }

  /**
   * Map LinkedIn posts to podcast episodes by matching content/dates
   */
  mapPostsToEpisodes(episodes) {
    const db = this._getDb();
    const posts = this.getPosts();

    const mappings = [];

    for (const post of posts) {
      const title = (post.post_title || '').toLowerCase();

      // Try to match by episode guest name or title keywords
      let matchedEpisode = null;
      let matchScore = 0;

      for (const ep of episodes) {
        let score = 0;

        // Match by guest name
        if (ep.guest) {
          const guestParts = ep.guest.toLowerCase().split(' ');
          for (const part of guestParts) {
            if (part.length > 2 && title.includes(part)) score += 3;
          }
        }

        // Match by episode title keywords
        if (ep.title) {
          const titleWords = ep.title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
          for (const word of titleWords) {
            if (title.includes(word)) score += 1;
          }
        }

        // Match by topic/tags
        if (ep.tags) {
          for (const tag of ep.tags) {
            if (title.includes(tag.toLowerCase())) score += 2;
          }
        }

        if (score > matchScore) {
          matchScore = score;
          matchedEpisode = ep;
        }
      }

      if (matchedEpisode && matchScore >= 3) {
        // Update the post with the episode mapping
        db.prepare('UPDATE linkedin_posts SET episode_id = ? WHERE id = ?')
          .run(matchedEpisode.id, post.id);

        mappings.push({
          postId: post.id,
          postUrl: post.post_url,
          episodeId: matchedEpisode.id,
          episodeTitle: matchedEpisode.title,
          matchScore
        });
      }
    }

    return mappings;
  }

  /**
   * Get episode-to-LinkedIn correlation data
   */
  getEpisodeCorrelation() {
    const db = this._getDb();

    return db.prepare(`
      SELECT 
        p.episode_id,
        p.post_title,
        p.post_url,
        p.created_date,
        p.impressions,
        p.clicks,
        p.likes,
        p.comments,
        p.reposts,
        p.engagement_rate
      FROM linkedin_posts p
      WHERE p.episode_id IS NOT NULL
      ORDER BY p.created_date DESC
    `).all();
  }

  /**
   * Get import history
   */
  getImportHistory() {
    const db = this._getDb();
    return db.prepare(
      'SELECT * FROM linkedin_import_log ORDER BY import_date DESC LIMIT 50'
    ).all();
  }

  /**
   * Log an import operation
   */
  _logImport(fileType, fileName, inserted, updated, skipped) {
    const db = this._getDb();
    db.prepare(`
      INSERT INTO linkedin_import_log (file_type, file_name, rows_inserted, rows_updated, rows_skipped)
      VALUES (?, ?, ?, ?, ?)
    `).run(fileType, fileName, inserted, updated, skipped);
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

module.exports = LinkedInService;
