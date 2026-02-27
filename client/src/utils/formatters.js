/**
 * Utility formatters for the dashboard
 */

export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toLocaleString() || '0';
}

export function formatPercent(decimal) {
  return (decimal * 100).toFixed(1) + '%';
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export const PLATFORM_COLORS = {
  spotify: '#1DB954',
  apple: '#9B59B6',
  youtube: '#FF0000',
  total: '#3B82F6'
};

export const PLATFORM_NAMES = {
  spotify: 'Spotify',
  apple: 'Apple Podcasts',
  youtube: 'YouTube'
};
