import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getEpisodes } from '../services/api';
import { formatNumber, formatPercent, formatDate, formatDuration, PLATFORM_COLORS } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

export default function Episodes() {
  const [sortBy, setSortBy] = useState('publishDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterTag, setFilterTag] = useState('');
  const [filterGuest, setFilterGuest] = useState('');

  const { data: episodes, loading, error } = useApi(
    () => getEpisodes({
      sortBy,
      sortOrder,
      tags: filterTag ? [filterTag] : undefined,
      hasGuest: filterGuest === '' ? undefined : filterGuest === 'true'
    }),
    [sortBy, sortOrder, filterTag, filterGuest]
  );

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>;
  };

  // Collect all unique tags
  const allTags = [...new Set(episodes?.flatMap(ep => ep.tags) || [])].sort();

  if (loading) return <LoadingSpinner message="Loading episodes..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Episodes</h2>
        <p className="text-gray-500 mt-1">All episodes with cross-platform metrics</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        <select
          value={filterGuest}
          onChange={(e) => setFilterGuest(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Episodes</option>
          <option value="true">Guest Episodes</option>
          <option value="false">Solo Episodes</option>
        </select>
        <span className="text-sm text-gray-400 self-center">
          {episodes?.length || 0} episodes
        </span>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900" onClick={() => handleSort('episodeNumber')}>
                  Ep <SortIcon field="episodeNumber" />
                </th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Title</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900" onClick={() => handleSort('publishDate')}>
                  Date <SortIcon field="publishDate" />
                </th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium">Duration</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900" onClick={() => handleSort('totalReach')}>
                  Total Reach <SortIcon field="totalReach" />
                </th>
                <th className="text-right py-3 px-4 font-medium" style={{ color: PLATFORM_COLORS.spotify }}>Spotify</th>
                <th className="text-right py-3 px-4 font-medium" style={{ color: PLATFORM_COLORS.apple }}>Apple</th>
                <th className="text-right py-3 px-4 font-medium" style={{ color: PLATFORM_COLORS.youtube }}>YouTube</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900" onClick={() => handleSort('totalListeners')}>
                  Listeners <SortIcon field="totalListeners" />
                </th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900" onClick={() => handleSort('completionRate')}>
                  Completion <SortIcon field="completionRate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {episodes?.map(ep => (
                <tr key={ep.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 text-gray-500 font-mono">{ep.episodeNumber}</td>
                  <td className="py-3 px-4">
                    <Link to={`/episodes/${ep.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                      {ep.title}
                    </Link>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {ep.guest && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">🎤 {ep.guest}</span>
                      )}
                      {ep.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{formatDate(ep.publishDate)}</td>
                  <td className="py-3 px-4 text-right text-gray-500">{formatDuration(ep.duration)}</td>
                  <td className="py-3 px-4 text-right font-semibold">{formatNumber(ep.metrics.totalReach)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(ep.metrics.platforms.spotify.streams)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(ep.metrics.platforms.apple.downloads)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(ep.metrics.platforms.youtube.views)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(ep.metrics.totalListeners)}</td>
                  <td className="py-3 px-4 text-right">{formatPercent(ep.metrics.avgCompletionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
