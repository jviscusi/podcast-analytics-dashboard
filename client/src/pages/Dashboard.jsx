import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getOverview, getTrends, getEpisodes } from '../services/api';
import { formatNumber, formatPercent, formatDateShort, PLATFORM_COLORS, PLATFORM_NAMES } from '../utils/formatters';
import KpiCard from '../components/common/KpiCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [trendGroupBy, setTrendGroupBy] = useState('week');
  const { data: overview, loading: loadingOverview, error: errorOverview } = useApi(getOverview);
  const { data: trends, loading: loadingTrends } = useApi(() => getTrends({ groupBy: trendGroupBy }), [trendGroupBy]);
  const { data: episodes, loading: loadingEpisodes } = useApi(() => getEpisodes({ sortBy: 'totalReach', sortOrder: 'desc' }));

  if (loadingOverview) return <LoadingSpinner message="Loading dashboard..." />;
  if (errorOverview) return <ErrorMessage message={errorOverview} />;

  const pieData = overview ? [
    { name: 'Spotify', value: overview.platformBreakdown.spotify.streams, color: PLATFORM_COLORS.spotify },
    { name: 'Apple Podcasts', value: overview.platformBreakdown.apple.downloads, color: PLATFORM_COLORS.apple },
    { name: 'YouTube', value: overview.platformBreakdown.youtube.views, color: PLATFORM_COLORS.youtube },
  ] : [];

  const topEpisodes = episodes?.slice(0, 5) || [];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500 mt-1">Cross-platform podcast analytics at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard
          title="Total Reach"
          value={formatNumber(overview.totalReach)}
          subtitle="Streams + Downloads + Views"
          icon="🎯"
          color="blue"
        />
        <KpiCard
          title="Total Listeners"
          value={formatNumber(overview.totalListeners)}
          subtitle="Unique across platforms"
          icon="👥"
          color="green"
        />
        <KpiCard
          title="Avg Completion"
          value={formatPercent(overview.avgCompletionRate)}
          subtitle="Cross-platform average"
          icon="✅"
          color="purple"
        />
        <KpiCard
          title="Episodes"
          value={overview.totalEpisodes}
          subtitle="Season 1"
          icon="🎙️"
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Reach Over Time</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setTrendGroupBy('day')}
                className={`px-3 py-1 text-xs rounded-full ${trendGroupBy === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setTrendGroupBy('week')}
                className={`px-3 py-1 text-xs rounded-full ${trendGroupBy === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Weekly
              </button>
            </div>
          </div>
          {loadingTrends ? (
            <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(label) => formatDateShort(label)}
                  formatter={(value, name) => [formatNumber(value), PLATFORM_NAMES[name] || name]}
                />
                <Area type="monotone" dataKey="spotify" stackId="1" stroke={PLATFORM_COLORS.spotify} fill={PLATFORM_COLORS.spotify} fillOpacity={0.6} />
                <Area type="monotone" dataKey="apple" stackId="1" stroke={PLATFORM_COLORS.apple} fill={PLATFORM_COLORS.apple} fillOpacity={0.6} />
                <Area type="monotone" dataKey="youtube" stackId="1" stroke={PLATFORM_COLORS.youtube} fill={PLATFORM_COLORS.youtube} fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform Breakdown Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Platform Share</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Episodes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Top 5 Episodes by Reach</h3>
          <Link to="/episodes" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View all →
          </Link>
        </div>
        {loadingEpisodes ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">#</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Episode</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium">Total Reach</th>
                  <th className="text-right py-3 px-2 font-medium" style={{ color: PLATFORM_COLORS.spotify }}>Spotify</th>
                  <th className="text-right py-3 px-2 font-medium" style={{ color: PLATFORM_COLORS.apple }}>Apple</th>
                  <th className="text-right py-3 px-2 font-medium" style={{ color: PLATFORM_COLORS.youtube }}>YouTube</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium">Completion</th>
                </tr>
              </thead>
              <tbody>
                {topEpisodes.map((ep, idx) => (
                  <tr key={ep.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-2 text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-2">
                      <Link to={`/episodes/${ep.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                        Ep {ep.episodeNumber}: {ep.title}
                      </Link>
                      <div className="flex gap-1 mt-1">
                        {ep.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">{formatNumber(ep.metrics.totalReach)}</td>
                    <td className="py-3 px-2 text-right">{formatNumber(ep.metrics.platforms.spotify.streams)}</td>
                    <td className="py-3 px-2 text-right">{formatNumber(ep.metrics.platforms.apple.downloads)}</td>
                    <td className="py-3 px-2 text-right">{formatNumber(ep.metrics.platforms.youtube.views)}</td>
                    <td className="py-3 px-2 text-right">{formatPercent(ep.metrics.avgCompletionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
