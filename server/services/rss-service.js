/**
 * RSS Feed Parser Service
 * 
 * Fetches and parses the podcast RSS feed from Riverside.fm to extract
 * episode metadata as the source of truth for the episode catalog.
 * 
 * Auto-extracts: guest names, topics/series, hosts, episode types
 */

const xml2js = require('xml2js');
const path = require('path');
const fs = require('fs');

const RSS_FEED_URL = process.env.RSS_FEED_URL || 'https://api.riverside.fm/hosting/2ZZ2vMfH.rss';
const CACHE_FILE = path.join(__dirname, '../mock/rss-cache.json');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class RSSService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Fetch and parse the RSS feed, with caching
   */
  async getEpisodes() {
    // Check memory cache
    if (this.cache && (Date.now() - this.cacheTimestamp) < CACHE_TTL) {
      return this.cache;
    }

    // Check file cache
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        if (cached.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL) {
          this.cache = cached.data;
          this.cacheTimestamp = cached.timestamp;
          return this.cache;
        }
      } catch (e) {
        // Cache corrupted, fetch fresh
      }
    }

    // Fetch fresh from RSS
    try {
      const data = await this._fetchAndParse();
      this.cache = data;
      this.cacheTimestamp = Date.now();

      // Write to file cache
      fs.writeFileSync(CACHE_FILE, JSON.stringify({
        timestamp: Date.now(),
        data
      }, null, 2));

      return data;
    } catch (error) {
      console.error('Error fetching RSS feed:', error.message);
      // Fall back to file cache even if expired
      if (fs.existsSync(CACHE_FILE)) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Fetch RSS feed and parse into structured episode data
   */
  async _fetchAndParse() {
    const response = await fetch(RSS_FEED_URL);
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const result = await parser.parseStringPromise(xml);

    const channel = result.rss.channel;
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];

    // Extract podcast-level metadata
    const podcastMeta = {
      title: this._cdata(channel.title),
      description: this._stripHtml(this._cdata(channel.description)),
      author: channel['itunes:author'],
      link: channel.link,
      image: channel['itunes:image']?.href,
      categories: this._extractCategories(channel),
      language: channel.language
    };

    // Parse each episode
    const episodes = items.map(item => this._parseEpisode(item)).filter(Boolean);

    // Sort by episode number (ascending)
    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

    return {
      podcast: podcastMeta,
      episodes
    };
  }

  /**
   * Parse a single RSS item into our episode schema
   */
  _parseEpisode(item) {
    const title = this._cdata(item.title) || item['itunes:title'] || '';
    const episodeNumber = parseInt(item['itunes:episode']) || this._extractEpisodeNumber(title);
    const season = parseInt(item['itunes:season']) || 1;
    const guid = item.guid?._ || item.guid || '';
    const pubDate = item.pubDate;
    const durationStr = item['itunes:duration'] || '00:00:00';
    const duration = this._parseDuration(durationStr);
    const description = this._stripHtml(this._cdata(item.description) || item['itunes:summary'] || '');
    const audioUrl = item.enclosure?.url || '';
    const fileSize = parseInt(item.enclosure?.length) || 0;

    // Auto-extract metadata from title
    const extracted = this._extractMetadata(title, description);

    return {
      id: `ep-${String(episodeNumber).padStart(3, '0')}`,
      guid,
      episodeNumber,
      season,
      title: extracted.cleanTitle,
      fullTitle: title,
      description,
      publishDate: this._formatDate(pubDate),
      duration, // in minutes
      durationFormatted: durationStr,
      guest: extracted.guest,
      host: extracted.host,
      topic: extracted.topic,
      series: extracted.series,
      tags: extracted.tags,
      episodeType: extracted.episodeType,
      audioUrl,
      fileSize,
      fileSizeMB: parseFloat((fileSize / (1024 * 1024)).toFixed(1))
    };
  }

  /**
   * Extract guest name, topic, series, host, and tags from episode title and description
   * 
   * Title patterns observed:
   *   "IOO Podcast 017 - Kristin Wuhrman on Daily Rituals for Success"
   *   "IOO Podcast 014 - Introduction to Daily Rituals for Success"
   *   "IOO Podcast 009 - Special Edition "What Changed Us""
   */
  _extractMetadata(title, description) {
    let guest = null;
    let host = null;
    let topic = null;
    let series = null;
    let episodeType = 'interview'; // default
    const tags = [];

    // Extract from title pattern: "IOO Podcast XXX - [Guest/Intro] on [Topic]"
    const guestTopicMatch = title.match(/IOO Podcast \d+ - (.+?) on (.+)$/i);
    const introMatch = title.match(/IOO Podcast \d+ - Introduction to (.+)$/i);
    const specialMatch = title.match(/IOO Podcast \d+ - Special Edition[:\s]*["""]?(.+?)["""]?\s*$/i);

    if (introMatch) {
      // Introduction episode (hosts only, no guest)
      series = introMatch[1].trim();
      topic = series;
      episodeType = 'introduction';
      tags.push('introduction', 'hosts-only');
    } else if (guestTopicMatch) {
      // Guest interview
      guest = guestTopicMatch[1].trim();
      series = guestTopicMatch[2].trim();
      topic = series;
      episodeType = 'interview';
      tags.push('interview', 'guest');
    } else if (specialMatch) {
      // Special edition
      topic = specialMatch[1].trim();
      episodeType = 'special';
      tags.push('special-edition', 'hosts-only');
    }

    // Add series as a tag
    if (series) {
      const seriesTag = series.toLowerCase().replace(/\s+/g, '-');
      tags.push(seriesTag);
    }

    // Extract host from description
    const hostPatterns = [
      /host\s+(Dave Dieffenbach|Jon Detweiler|Jim Viscusi)/i,
      /hosts?\s+(Dave Dieffenbach|Jon Detweiler|Jim Viscusi),?\s*(Jon Detweiler|Dave Dieffenbach|Jim Viscusi)?\s*(?:and\s*)?(Jon Detweiler|Dave Dieffenbach|Jim Viscusi)?/i
    ];
    for (const pattern of hostPatterns) {
      const match = description.match(pattern);
      if (match) {
        const hosts = [match[1], match[2], match[3]].filter(Boolean);
        host = hosts.join(', ');
        break;
      }
    }

    // If no host found but it's an intro/special, it's all three hosts
    if (!host && (episodeType === 'introduction' || episodeType === 'special')) {
      host = 'Dave Dieffenbach, Jon Detweiler, Jim Viscusi';
    }

    // Clean title (remove "IOO Podcast XXX - " prefix)
    const cleanTitle = title.replace(/^IOO Podcast \d+\s*-\s*/, '').trim();

    // Add topic-based tags
    if (topic) {
      if (topic.toLowerCase().includes('leadership')) tags.push('leadership');
      if (topic.toLowerCase().includes('communication') || topic.toLowerCase().includes('clarity')) tags.push('communication');
      if (topic.toLowerCase().includes('decision')) tags.push('decision-making');
      if (topic.toLowerCase().includes('ritual') || topic.toLowerCase().includes('success')) tags.push('personal-growth');
    }

    return { guest, host, topic, series, tags: [...new Set(tags)], episodeType, cleanTitle };
  }

  /**
   * Parse duration string "HH:MM:SS" to minutes
   */
  _parseDuration(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) {
      return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
    }
    if (parts.length === 2) {
      return Math.round(parts[0] + parts[1] / 60);
    }
    return parseInt(str) || 0;
  }

  /**
   * Format date string to YYYY-MM-DD
   */
  _formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  }

  /**
   * Extract episode number from title
   */
  _extractEpisodeNumber(title) {
    const match = title.match(/(?:Podcast|Episode|Ep\.?)\s*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Handle CDATA wrapped content
   */
  _cdata(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val._) return val._;
    return String(val);
  }

  /**
   * Strip HTML tags from text
   */
  _stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract categories from channel
   */
  _extractCategories(channel) {
    const cats = [];
    const itunesCat = channel['itunes:category'];
    if (itunesCat) {
      const categories = Array.isArray(itunesCat) ? itunesCat : [itunesCat];
      categories.forEach(cat => {
        if (cat.text) cats.push(cat.text);
        if (cat['itunes:category']) {
          const sub = Array.isArray(cat['itunes:category']) ? cat['itunes:category'] : [cat['itunes:category']];
          sub.forEach(s => { if (s.text) cats.push(s.text); });
        }
      });
    }
    return cats;
  }
}

module.exports = RSSService;
