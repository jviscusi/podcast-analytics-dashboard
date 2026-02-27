/**
 * Mock Data Generator for Podcast Analytics Dashboard
 * 
 * Generates realistic podcast analytics data for 26 episodes
 * across Spotify, Apple Podcasts, and YouTube over 6 months.
 * 
 * Run: node generate-mock-data.js
 */

const fs = require('fs');
const path = require('path');

// Seed for reproducible "random" data
let seed = 42;
function seededRandom() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function randomInt(min, max) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((seededRandom() * (max - min) + min).toFixed(decimals));
}

// Episode metadata
const episodeTopics = [
  { title: "Welcome to the Show - What to Expect", tags: ["intro", "solo"], guest: null },
  { title: "The State of the Industry in 2025", tags: ["industry", "deep-dive"], guest: null },
  { title: "Interview with Sarah Chen - Building Startups", tags: ["interview", "startups"], guest: "Sarah Chen" },
  { title: "5 Lessons from Our First Month", tags: ["reflection", "solo"], guest: null },
  { title: "Deep Dive: Market Trends That Matter", tags: ["deep-dive", "market"], guest: null },
  { title: "Interview with Marcus Johnson - Scaling Teams", tags: ["interview", "leadership"], guest: "Marcus Johnson" },
  { title: "Listener Q&A - Your Questions Answered", tags: ["q-and-a", "community"], guest: null },
  { title: "The Future of Remote Work", tags: ["deep-dive", "remote-work"], guest: null },
  { title: "Interview with Dr. Lisa Park - AI and Ethics", tags: ["interview", "ai", "technology"], guest: "Dr. Lisa Park" },
  { title: "Behind the Scenes - How We Make This Show", tags: ["behind-the-scenes", "solo"], guest: null },
  { title: "Top 10 Tools for Productivity", tags: ["tutorial", "tools"], guest: null },
  { title: "Interview with James Wright - Venture Capital", tags: ["interview", "finance", "vc"], guest: "James Wright" },
  { title: "The Psychology of Decision Making", tags: ["deep-dive", "psychology"], guest: null },
  { title: "Special: Live Recording at TechConf 2025", tags: ["special", "live", "conference"], guest: null },
  { title: "Interview with Aisha Patel - Product Design", tags: ["interview", "design"], guest: "Aisha Patel" },
  { title: "Midseason Recap - Highlights So Far", tags: ["recap", "solo"], guest: null },
  { title: "The Creator Economy Explained", tags: ["deep-dive", "creator-economy"], guest: null },
  { title: "Interview with Tom Rivera - Content Strategy", tags: ["interview", "content", "strategy"], guest: "Tom Rivera" },
  { title: "Listener Stories - How You're Making an Impact", tags: ["community", "stories"], guest: null },
  { title: "Deep Dive: Data-Driven Decision Making", tags: ["deep-dive", "data", "analytics"], guest: null },
  { title: "Interview with Nina Kowalski - Growth Marketing", tags: ["interview", "marketing", "growth"], guest: "Nina Kowalski" },
  { title: "The Art of Storytelling in Business", tags: ["deep-dive", "storytelling"], guest: null },
  { title: "Interview with David Kim - Building Communities", tags: ["interview", "community-building"], guest: "David Kim" },
  { title: "Predictions for 2026 - What's Coming Next", tags: ["predictions", "future"], guest: null },
  { title: "Interview with Rachel Torres - Sustainability", tags: ["interview", "sustainability"], guest: "Rachel Torres" },
  { title: "Season Finale - Lessons Learned & What's Next", tags: ["finale", "reflection", "solo"], guest: null }
];

// Generate episode dates (weekly, starting 6 months ago from a fixed reference)
const startDate = new Date('2025-09-03'); // Wednesday releases
const episodes = [];

for (let i = 0; i < 26; i++) {
  const publishDate = new Date(startDate);
  publishDate.setDate(publishDate.getDate() + (i * 7));
  
  const topic = episodeTopics[i];
  const duration = topic.tags.includes('interview') 
    ? randomInt(35, 58) 
    : topic.tags.includes('deep-dive') 
      ? randomInt(28, 45)
      : topic.tags.includes('q-and-a') || topic.tags.includes('special')
        ? randomInt(40, 65)
        : randomInt(20, 35);

  episodes.push({
    id: `ep-${String(i + 1).padStart(3, '0')}`,
    episodeNumber: i + 1,
    title: topic.title,
    description: `Episode ${i + 1} of the podcast.`,
    publishDate: publishDate.toISOString().split('T')[0],
    duration: duration, // minutes
    tags: topic.tags,
    guest: topic.guest,
    season: 1
  });
}

// Breakout episodes (indices): episode 9 (AI/Ethics interview), episode 14 (Live at TechConf), episode 21 (Growth Marketing)
const breakoutEpisodes = [8, 13, 20];
// Underperformers: episode 4 (reflection), episode 16 (midseason recap)
const underperformers = [3, 15];

function generateDailyDownloads(episodeIndex, publishDate, platform) {
  const days = [];
  const pubDate = new Date(publishDate);
  const today = new Date('2026-02-25');
  const daysSincePublish = Math.floor((today - pubDate) / (1000 * 60 * 60 * 24));
  const daysToGenerate = Math.min(daysSincePublish, 90); // max 90 days of daily data

  // Base multipliers per platform
  const platformMultiplier = {
    spotify: 1.0,
    apple: 0.75,
    youtube: 0.45
  };

  // Growth trend: later episodes have slightly larger audience
  const growthFactor = 1 + (episodeIndex * 0.03);

  // Breakout/underperformer multiplier
  let performanceMultiplier = 1.0;
  if (breakoutEpisodes.includes(episodeIndex)) {
    performanceMultiplier = randomFloat(1.8, 2.5);
  } else if (underperformers.includes(episodeIndex)) {
    performanceMultiplier = randomFloat(0.5, 0.7);
  }

  const baseFirstDay = platform === 'youtube' ? randomInt(80, 150) : randomInt(150, 300);

  for (let d = 0; d < daysToGenerate; d++) {
    const date = new Date(pubDate);
    date.setDate(date.getDate() + d);

    // Download curve: exponential decay with day-of-week effects
    let base;
    if (d === 0) {
      base = baseFirstDay;
    } else if (d === 1) {
      base = baseFirstDay * 0.7;
    } else if (d === 2) {
      base = baseFirstDay * 0.45;
    } else if (d < 7) {
      base = baseFirstDay * (0.3 / (d * 0.8));
    } else if (d < 14) {
      base = baseFirstDay * (0.1 / (d * 0.3));
    } else if (d < 30) {
      base = randomInt(3, 15);
    } else {
      base = randomInt(1, 8);
    }

    // Day of week effect (weekdays slightly higher)
    const dayOfWeek = date.getDay();
    const dowMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.1;

    const value = Math.max(1, Math.round(
      base * platformMultiplier[platform] * growthFactor * performanceMultiplier * dowMultiplier * randomFloat(0.8, 1.2)
    ));

    days.push({
      date: date.toISOString().split('T')[0],
      count: value
    });
  }

  return days;
}

function generateSpotifyData() {
  const spotifyEpisodes = episodes.map((ep, idx) => {
    const dailyStreams = generateDailyDownloads(idx, ep.publishDate, 'spotify');
    const totalStreams = dailyStreams.reduce((sum, d) => sum + d.count, 0);
    const totalListeners = Math.round(totalStreams * randomFloat(0.65, 0.80));
    const completionRate = ep.tags.includes('interview') 
      ? randomFloat(0.55, 0.78)
      : ep.tags.includes('deep-dive')
        ? randomFloat(0.50, 0.72)
        : randomFloat(0.60, 0.85);

    return {
      episodeId: ep.id,
      spotifyEpisodeUri: `spotify:episode:${ep.id.replace('ep-', '')}mock`,
      title: ep.title,
      publishDate: ep.publishDate,
      metrics: {
        totalStreams,
        totalListeners,
        averageListenDuration: Math.round(ep.duration * completionRate),
        completionRate: parseFloat(completionRate.toFixed(3)),
        starts: Math.round(totalStreams * randomFloat(1.1, 1.3)),
        saves: randomInt(Math.round(totalStreams * 0.02), Math.round(totalStreams * 0.08)),
        shares: randomInt(Math.round(totalStreams * 0.005), Math.round(totalStreams * 0.03)),
        followers: {
          gained: randomInt(5, 45),
          lost: randomInt(0, 8)
        }
      },
      dailyStreams,
      demographics: {
        ageGroups: {
          "18-22": randomFloat(0.05, 0.12),
          "23-27": randomFloat(0.18, 0.28),
          "28-34": randomFloat(0.25, 0.35),
          "35-44": randomFloat(0.15, 0.25),
          "45-59": randomFloat(0.08, 0.15),
          "60+": randomFloat(0.02, 0.06)
        },
        gender: {
          male: randomFloat(0.45, 0.60),
          female: randomFloat(0.35, 0.48),
          nonBinary: randomFloat(0.02, 0.06),
          notSpecified: randomFloat(0.01, 0.05)
        },
        topCountries: [
          { country: "US", percentage: randomFloat(0.55, 0.70) },
          { country: "UK", percentage: randomFloat(0.08, 0.15) },
          { country: "CA", percentage: randomFloat(0.05, 0.10) },
          { country: "AU", percentage: randomFloat(0.03, 0.07) },
          { country: "DE", percentage: randomFloat(0.02, 0.05) }
        ]
      }
    };
  });

  return {
    platform: "spotify",
    podcastId: "mock-spotify-podcast-id",
    podcastName: "The Insight Hour",
    lastUpdated: new Date().toISOString(),
    totalFollowers: 2847,
    episodes: spotifyEpisodes
  };
}

function generateAppleData() {
  const appleEpisodes = episodes.map((ep, idx) => {
    const dailyDownloads = generateDailyDownloads(idx, ep.publishDate, 'apple');
    const totalDownloads = dailyDownloads.reduce((sum, d) => sum + d.count, 0);
    const totalPlays = Math.round(totalDownloads * randomFloat(0.80, 0.95));
    const uniqueListeners = Math.round(totalPlays * randomFloat(0.60, 0.78));
    const avgConsumption = ep.tags.includes('interview')
      ? randomFloat(0.50, 0.75)
      : ep.tags.includes('deep-dive')
        ? randomFloat(0.48, 0.70)
        : randomFloat(0.55, 0.82);

    return {
      episodeId: ep.id,
      appleEpisodeId: `apple-${ep.id.replace('ep-', '')}mock`,
      title: ep.title,
      publishDate: ep.publishDate,
      metrics: {
        totalDownloads,
        totalPlays,
        uniqueListeners,
        engagedListeners: Math.round(uniqueListeners * randomFloat(0.70, 0.90)),
        avgConsumption: parseFloat(avgConsumption.toFixed(3)),
        avgListenDuration: Math.round(ep.duration * avgConsumption)
      },
      dailyDownloads,
      dailyPlays: dailyDownloads.map(d => ({
        date: d.date,
        count: Math.round(d.count * randomFloat(0.80, 0.95))
      })),
      devices: {
        iPhone: randomFloat(0.55, 0.68),
        iPad: randomFloat(0.05, 0.12),
        Mac: randomFloat(0.08, 0.15),
        CarPlay: randomFloat(0.05, 0.10),
        HomePod: randomFloat(0.02, 0.05),
        other: randomFloat(0.02, 0.08)
      },
      topCountries: [
        { country: "US", downloads: Math.round(totalDownloads * randomFloat(0.58, 0.72)) },
        { country: "UK", downloads: Math.round(totalDownloads * randomFloat(0.08, 0.14)) },
        { country: "CA", downloads: Math.round(totalDownloads * randomFloat(0.05, 0.10)) },
        { country: "AU", downloads: Math.round(totalDownloads * randomFloat(0.03, 0.07)) },
        { country: "IN", downloads: Math.round(totalDownloads * randomFloat(0.02, 0.05)) }
      ]
    };
  });

  return {
    platform: "apple",
    podcastId: "mock-apple-podcast-id",
    podcastName: "The Insight Hour",
    lastUpdated: new Date().toISOString(),
    totalSubscribers: 2134,
    episodes: appleEpisodes
  };
}

function generateYouTubeData() {
  const ytEpisodes = episodes.map((ep, idx) => {
    const dailyViews = generateDailyDownloads(idx, ep.publishDate, 'youtube');
    const totalViews = dailyViews.reduce((sum, d) => sum + d.count, 0);
    const uniqueViewers = Math.round(totalViews * randomFloat(0.70, 0.85));
    const avgViewDuration = ep.tags.includes('interview')
      ? randomFloat(0.35, 0.60)
      : ep.tags.includes('deep-dive')
        ? randomFloat(0.30, 0.55)
        : randomFloat(0.40, 0.65);

    return {
      episodeId: ep.id,
      youtubeVideoId: `yt-${ep.id.replace('ep-', '')}mock`,
      title: ep.title,
      publishDate: ep.publishDate,
      metrics: {
        totalViews,
        uniqueViewers,
        avgViewDuration: parseFloat(avgViewDuration.toFixed(3)),
        avgViewDurationMinutes: Math.round(ep.duration * avgViewDuration),
        watchTimeHours: parseFloat((totalViews * ep.duration * avgViewDuration / 60).toFixed(1)),
        likes: randomInt(Math.round(totalViews * 0.03), Math.round(totalViews * 0.08)),
        comments: randomInt(Math.round(totalViews * 0.005), Math.round(totalViews * 0.02)),
        shares: randomInt(Math.round(totalViews * 0.003), Math.round(totalViews * 0.015)),
        subscribersGained: randomInt(3, 30),
        subscribersLost: randomInt(0, 5),
        impressions: Math.round(totalViews * randomFloat(3.0, 6.0)),
        clickThroughRate: randomFloat(0.04, 0.12)
      },
      dailyViews,
      trafficSources: {
        search: randomFloat(0.15, 0.30),
        suggested: randomFloat(0.20, 0.35),
        browse: randomFloat(0.10, 0.20),
        external: randomFloat(0.08, 0.18),
        direct: randomFloat(0.05, 0.12),
        notifications: randomFloat(0.05, 0.10),
        other: randomFloat(0.02, 0.08)
      },
      demographics: {
        ageGroups: {
          "18-24": randomFloat(0.10, 0.18),
          "25-34": randomFloat(0.28, 0.38),
          "35-44": randomFloat(0.20, 0.28),
          "45-54": randomFloat(0.10, 0.18),
          "55-64": randomFloat(0.05, 0.10),
          "65+": randomFloat(0.02, 0.05)
        },
        topCountries: [
          { country: "US", percentage: randomFloat(0.50, 0.65) },
          { country: "IN", percentage: randomFloat(0.08, 0.15) },
          { country: "UK", percentage: randomFloat(0.06, 0.12) },
          { country: "CA", percentage: randomFloat(0.04, 0.08) },
          { country: "BR", percentage: randomFloat(0.02, 0.06) }
        ]
      }
    };
  });

  return {
    platform: "youtube",
    channelId: "mock-youtube-channel-id",
    podcastName: "The Insight Hour",
    lastUpdated: new Date().toISOString(),
    totalSubscribers: 1563,
    episodes: ytEpisodes
  };
}

// Generate all data
const spotifyData = generateSpotifyData();
const appleData = generateAppleData();
const youtubeData = generateYouTubeData();

// Episode metadata (shared across platforms)
const episodeMetadata = episodes;

// Write files
fs.writeFileSync(
  path.join(__dirname, 'spotify-data.json'),
  JSON.stringify(spotifyData, null, 2)
);

fs.writeFileSync(
  path.join(__dirname, 'apple-data.json'),
  JSON.stringify(appleData, null, 2)
);

fs.writeFileSync(
  path.join(__dirname, 'youtube-data.json'),
  JSON.stringify(youtubeData, null, 2)
);

fs.writeFileSync(
  path.join(__dirname, 'episodes.json'),
  JSON.stringify(episodeMetadata, null, 2)
);

console.log('✅ Mock data generated successfully!');
console.log(`   - ${spotifyData.episodes.length} Spotify episodes`);
console.log(`   - ${appleData.episodes.length} Apple Podcasts episodes`);
console.log(`   - ${youtubeData.episodes.length} YouTube episodes`);
console.log(`   - ${episodeMetadata.length} episode metadata records`);
