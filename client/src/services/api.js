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
