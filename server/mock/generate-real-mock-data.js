/**
 * Generate realistic mock platform analytics data for the real
 * Impact Over Optics Podcast episodes (sourced from RSS feed).
 * 
 * This creates simulated Spotify, Apple, and YouTube data that
 * mirrors what real platform APIs would return, keyed to the
 * actual episode IDs from the RSS feed.
 */

const fs = require('fs');
const path = require('path');

// Real episode data from RSS feed
const episodes = [
  { id: 'ep-001', num: 1, date: '2025-11-22', duration: 24, guest: null, series: 'Purpose Driven Leadership', type: 'introduction' },
  { id: 'ep-002', num: 2, date: '2025-11-22', duration: 23, guest: 'Emily Pinto', series: 'Purpose Driven Leadership', type: 'interview' },
  { id: 'ep-003', num: 3, date: '2025-11-22', duration: 20, guest: 'Adriana Zupa-Fernandez', series: 'Purpose Driven Leadership', type: 'interview' },
  { id: 'ep-004', num: 4, date: '2025-11-25', duration: 25, guest: 'Eric Lacombe', series: 'Purpose Driven Leadership', type: 'interview' },
  { id: 'ep-005', num: 5, date: '2025-12-02', duration: 29, guest: null, series: 'Communicating with Clarity', type: 'introduction' },
  { id: 'ep-006', num: 6, date: '2025-12-09', duration: 18, guest: 'Rhonda Babb', series: 'Communicating with Clarity', type: 'interview' },
  { id: 'ep-007', num: 7, date: '2025-12-16', duration: 22, guest: 'Tony Madsen', series: 'Communicating with Clarity', type: 'interview' },
  { id: 'ep-008', num: 8, date: '2025-12-23', duration: 22, guest: 'Dr. Agostino Scicchitano', series: 'Communicating with Clarity', type: 'interview' },
  { id: 'ep-009', num: 9, date: '2025-12-30', duration: 25, guest: null, series: null, type: 'special' },
  { id: 'ep-010', num: 10, date: '2026-01-06', duration: 23, guest: null, series: 'Bulletproof Decision-Making', type: 'introduction' },
  { id: 'ep-011', num: 11, date: '2026-01-13', duration: 22, guest: 'Fotine Sotiropoulos', series: 'Bulletproof Decision Making', type: 'interview' },
  { id: 'ep-012', num: 12, date: '2026-01-20', duration: 21, guest: 'Shane Wheeler', series: 'Bulletproof Decision-Making', type: 'interview' },
  { id: 'ep-013', num: 13, date: '2026-01-27', duration: 25, guest: 'Ramin Mohajer', series: 'Bulletproof Decision-Making', type: 'interview' },
  { id: 'ep-014', num: 14, date: '2026-02-04', duration: 21, guest: null, series: 'Daily Rituals for Success', type: 'introduction' },
  { id: 'ep-015', num: 15, date: '2026-02-09', duration: 19, guest: 'Dr. Orlando Rivera', series: 'Daily Rituals for Success', type: 'interview' },
  { id: 'ep-016', num: 16, date: '2026-02-16', duration: 24, guest: 'Ryan Derstine', series: 'Daily Rituals for Success', type: 'interview' },
  { id: 'ep-017', num: 17, date: '2026-02-23', duration: 21, guest: 'Kristin Wuhrman', series: 'Daily Rituals for Success', type: 'interview' },
];

// Helpers
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(3)); }

function generateDailyData(pubDate, days, baseCount, variance) {
  const daily = [];
  const start = new Date(pubDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    // Decay curve: most listens in first few days
    const decay = Math.exp(-i * 0.15);
    const dayOfWeek = d.getDay();
    const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;
    const count = Math.max(1, Math.round(baseCount * decay * weekendBoost * (1 + (Math.random() - 0.5) * variance)));
    daily.push({
      date: d.toISOString().split('T')[0],
      count
    });
  }
  return daily;
}

// Growth factor: newer episodes get slightly more traction as the podcast grows
function growthFactor(epNum) {
  return 1 + (epNum - 1) * 0.04; // 4% growth per episode
}

// Some episodes are "breakout" performers
function isBreakout(epNum) {
  return [3, 9, 13].includes(epNum); // Adriana (BMS exec), Special Edition, Ramin (Decision Ed)
}

function isUnderperformer(epNum) {
  return [6, 8].includes(epNum); // Holiday timing episodes
}

// ============================================
// Generate Spotify Data
// ============================================
function generateSpotifyData() {
  return {
    episodes: episodes.map(ep => {
      const gf = growthFactor(ep.num);
      const breakout = isBreakout(ep.num) ? 1.8 : 1.0;
      const under = isUnderperformer(ep.num) ? 0.6 : 1.0;
      const baseStreams = Math.round(rand(80, 140) * gf * breakout * under);
      const daysOut = Math.max(7, Math.floor((Date.now() - new Date(ep.date).getTime()) / (1000 * 60 * 60 * 24)));
      const dailyDays = Math.min(daysOut, 30);

      const totalStreams = baseStreams + rand(20, 60);
      const totalListeners = Math.round(totalStreams * randFloat(0.65, 0.85));
      const starts = totalStreams + rand(10, 30);
      const completionRate = randFloat(0.45, 0.75);

      return {
        episodeId: ep.id,
        metrics: {
          totalStreams,
          totalListeners,
          starts,
          completionRate,
          saves: rand(2, 15),
          shares: rand(1, 8),
          followers: { gained: rand(0, 5), lost: rand(0, 2) }
        },
        dailyStreams: generateDailyData(ep.date, dailyDays, Math.round(totalStreams * 0.3), 0.4),
        demographics: {
          age: { '18-24': rand(5, 15), '25-34': rand(25, 40), '35-44': rand(20, 35), '45-59': rand(10, 20), '60+': rand(3, 10) },
          gender: { male: rand(45, 65), female: rand(30, 50), other: rand(2, 8) },
          topCountries: [
            { country: 'US', percentage: rand(65, 80) },
            { country: 'CA', percentage: rand(5, 12) },
            { country: 'GB', percentage: rand(3, 8) },
            { country: 'AU', percentage: rand(2, 5) }
          ]
        }
      };
    })
  };
}

// ============================================
// Generate Apple Podcasts Data
// ============================================
function generateAppleData() {
  return {
    episodes: episodes.map(ep => {
      const gf = growthFactor(ep.num);
      const breakout = isBreakout(ep.num) ? 1.6 : 1.0;
      const under = isUnderperformer(ep.num) ? 0.65 : 1.0;
      const baseDownloads = Math.round(rand(50, 100) * gf * breakout * under);
      const daysOut = Math.max(7, Math.floor((Date.now() - new Date(ep.date).getTime()) / (1000 * 60 * 60 * 24)));
      const dailyDays = Math.min(daysOut, 30);

      const totalDownloads = baseDownloads + rand(15, 45);
      const totalPlays = Math.round(totalDownloads * randFloat(0.7, 0.9));
      const uniqueListeners = Math.round(totalDownloads * randFloat(0.6, 0.8));
      const engagedListeners = Math.round(uniqueListeners * randFloat(0.5, 0.75));
      const avgConsumption = randFloat(0.5, 0.8);
      const avgListenDuration = Math.round(ep.duration * avgConsumption);

      return {
        episodeId: ep.id,
        metrics: {
          totalDownloads,
          totalPlays,
          uniqueListeners,
          engagedListeners,
          avgConsumption,
          avgListenDuration
        },
        dailyDownloads: generateDailyData(ep.date, dailyDays, Math.round(totalDownloads * 0.25), 0.5),
        devices: {
          iPhone: rand(40, 55),
          Mac: rand(15, 25),
          iPad: rand(5, 12),
          CarPlay: rand(3, 8),
          HomePod: rand(1, 4),
          other: rand(2, 6)
        },
        topCountries: [
          { country: 'US', downloads: Math.round(totalDownloads * randFloat(0.6, 0.75)) },
          { country: 'CA', downloads: Math.round(totalDownloads * randFloat(0.05, 0.12)) },
          { country: 'GB', downloads: Math.round(totalDownloads * randFloat(0.03, 0.08)) }
        ]
      };
    })
  };
}

// ============================================
// Generate YouTube Data
// ============================================
function generateYouTubeData() {
  return {
    episodes: episodes.map(ep => {
      const gf = growthFactor(ep.num);
      const breakout = isBreakout(ep.num) ? 2.0 : 1.0;
      const under = isUnderperformer(ep.num) ? 0.5 : 1.0;
      const baseViews = Math.round(rand(20, 55) * gf * breakout * under);
      const daysOut = Math.max(7, Math.floor((Date.now() - new Date(ep.date).getTime()) / (1000 * 60 * 60 * 24)));
      const dailyDays = Math.min(daysOut, 30);

      const totalViews = baseViews + rand(8, 25);
      const uniqueViewers = Math.round(totalViews * randFloat(0.7, 0.9));
      const avgViewDuration = randFloat(0.3, 0.65);
      const watchTimeHours = parseFloat((totalViews * ep.duration * avgViewDuration / 60).toFixed(1));

      return {
        episodeId: ep.id,
        metrics: {
          totalViews,
          uniqueViewers,
          avgViewDuration,
          watchTimeHours,
          likes: rand(2, 20),
          comments: rand(0, 8),
          shares: rand(0, 5),
          subscribersGained: rand(0, 4),
          subscribersLost: rand(0, 1),
          impressions: totalViews + rand(50, 200),
          impressionsCTR: randFloat(0.03, 0.12)
        },
        dailyViews: generateDailyData(ep.date, dailyDays, Math.round(totalViews * 0.2), 0.6),
        trafficSources: {
          search: rand(15, 30),
          suggested: rand(10, 25),
          browse: rand(20, 40),
          external: rand(10, 25),
          other: rand(3, 10)
        },
        demographics: {
          age: { '18-24': rand(8, 18), '25-34': rand(25, 40), '35-44': rand(20, 30), '45-54': rand(10, 20), '55+': rand(5, 12) },
          topCountries: [
            { country: 'US', percentage: rand(60, 75) },
            { country: 'CA', percentage: rand(5, 12) },
            { country: 'IN', percentage: rand(3, 8) },
            { country: 'GB', percentage: rand(2, 6) }
          ]
        }
      };
    })
  };
}

// ============================================
// Write files
// ============================================
const spotifyData = generateSpotifyData();
const appleData = generateAppleData();
const youtubeData = generateYouTubeData();

fs.writeFileSync(path.join(__dirname, 'spotify-data.json'), JSON.stringify(spotifyData, null, 2));
fs.writeFileSync(path.join(__dirname, 'apple-data.json'), JSON.stringify(appleData, null, 2));
fs.writeFileSync(path.join(__dirname, 'youtube-data.json'), JSON.stringify(youtubeData, null, 2));

console.log('✅ Generated mock platform data for 17 real episodes:');
console.log(`   Spotify: ${spotifyData.episodes.length} episodes`);
console.log(`   Apple:   ${appleData.episodes.length} episodes`);
console.log(`   YouTube: ${youtubeData.episodes.length} episodes`);

// Print summary
const totalReach = spotifyData.episodes.reduce((s, e) => s + e.metrics.totalStreams, 0)
  + appleData.episodes.reduce((s, e) => s + e.metrics.totalDownloads, 0)
  + youtubeData.episodes.reduce((s, e) => s + e.metrics.totalViews, 0);
console.log(`   Total reach across all platforms: ${totalReach}`);
