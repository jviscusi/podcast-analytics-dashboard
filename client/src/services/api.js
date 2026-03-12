/**
 * API Service - Communicates with the backend
 */

const API_BASE = '/api/analytics';

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getOverview() {
  return fetchJSON(`${API_BASE}/overview`);
}

export async function getEpisodes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.tags) params.set('tags', filters.tags.join(','));
  if (filters.hasGuest !== undefined) params.set('hasGuest', filters.hasGuest);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  const qs = params.toString();
  return fetchJSON(`${API_BASE}/episodes${qs ? '?' + qs : ''}`);
}

export async function getEpisodeDetail(id) {
  return fetchJSON(`${API_BASE}/episodes/${id}`);
}

export async function getTrends(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.groupBy) params.set('groupBy', filters.groupBy);
  const qs = params.toString();
  return fetchJSON(`${API_BASE}/trends${qs ? '?' + qs : ''}`);
}

export async function getPlatformComparison() {
  return fetchJSON(`${API_BASE}/platforms`);
}

export async function getInsights() {
  return fetchJSON(`${API_BASE}/insights`);
}

export function getExportUrl(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  const qs = params.toString();
  return `${API_BASE}/export${qs ? '?' + qs : ''}`;
}

// ============================================
// LinkedIn API
// ============================================

const LI_BASE = '/api/linkedin';

export async function getLinkedInSummary() {
  return fetchJSON(`${LI_BASE}/summary`);
}

export async function getLinkedInDemographics(category = null) {
  const qs = category ? `?category=${category}` : '';
  return fetchJSON(`${LI_BASE}/demographics${qs}`);
}

export async function getLinkedInPosts() {
  return fetchJSON(`${LI_BASE}/posts`);
}

export async function getLinkedInEngagement(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  return fetchJSON(`${LI_BASE}/engagement${qs ? '?' + qs : ''}`);
}

export async function getLinkedInFollowers(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  return fetchJSON(`${LI_BASE}/followers${qs ? '?' + qs : ''}`);
}

export async function getLinkedInCorrelation() {
  return fetchJSON(`${LI_BASE}/correlation`);
}

export async function importLinkedInCSV(csvContent, fileName) {
  const response = await fetch(`${LI_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent, fileName })
  });
  if (!response.ok) throw new Error(`Import failed: ${response.statusText}`);
  return response.json();
}

export async function mapLinkedInEpisodes() {
  const response = await fetch(`${LI_BASE}/map-episodes`, { method: 'POST' });
  if (!response.ok) throw new Error(`Mapping failed: ${response.statusText}`);
  return response.json();
}

// ============================================
// Data Management API
// ============================================

const DATA_BASE = '/api/data';

export async function getDataStatus() {
  return fetchJSON(`${DATA_BASE}/status`);
}

export async function importPlatformCSV(platform, csvContent) {
  const response = await fetch(`${DATA_BASE}/import/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, csvContent })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Import failed: ${response.statusText}`);
  }
  return response.json();
}

export async function submitMetrics(episodeId, platform, metrics, date, notes) {
  const response = await fetch(`${DATA_BASE}/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episodeId, platform, metrics, date, notes })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Submit failed: ${response.statusText}`);
  }
  return response.json();
}

export async function submitBulkMetrics(platform, episodes, date, notes) {
  const response = await fetch(`${DATA_BASE}/metrics/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, episodes, date, notes })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Bulk submit failed: ${response.statusText}`);
  }
  return response.json();
}
