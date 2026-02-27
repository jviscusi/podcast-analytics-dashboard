import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend, LineChart, Line, Cell
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getInsights } from '../services/api';
import { formatNumber, formatPercent, PLATFORM_COLORS } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { Link } from 'react-router-dom';

export default function Insights() {
  const { data: insights, loading, error } = useApi(getInsights);

  if (loading) return <LoadingSpinner message="Loading insights..." />;
  if (error) return <ErrorMessage message={error} />;

  const { summary, topPerformers, bottomPerformers, dayOfWeekAnalysis, durationAnalysis, tagAnalysis, guestVsSolo, durationVsEngagement, growthTrend } = insights;

  // Tag analysis bar data
  const tagData = Object.entries(tagAnalysis)
    .map(([tag, stats]) => ({ tag, avgReach: stats.avgReach, count: stats.count, avgCompletion: stats.avgCompletion }))
    .sort((a, b) => b.avgReach - a.avgReach)
    .slice(0, 12);

  // Day of week bar data
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayData = dayOrder
    .filter(day => dayOfWeekAnalysis[day])
    .map(day => ({ day: day.slice(0, 3), avgReach: dayOfWeekAnalysis[day].avgReach, count: dayOfWeekAnalysis[day].count }));

  // Duration analysis bar data
  const durationData = Object.entries(durationAnalysis)
    .filter(([, stats]) => stats.count > 0)
    .map(([bucket, stats]) => ({ bucket, avgReach: stats.avgReach, avgCompletion: stats.avgCompletion, count: stats.count }));

  // Guest vs Solo
  const guestSoloData = [
    { type: 'Guest Episodes', avgReach: guestVsSolo.guest.avgReach, count: guestVsSolo.guest.count, avgCompletion: guestVsSolo.guest.avgCompletion },
    { type: 'Solo Episodes', avgReach: guestVsSolo.solo.avgReach, count: guestVsSolo.solo.count, avgCompletion: guestVsSolo.solo.avgCompletion },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Performance Insights</h2>
        <p className="text-gray-500 mt-1">Understand what works and why — data to help increase podcast penetration</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-gray-500 text-sm">Average Reach per Episode</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{formatNumber(summary.avgReach)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-gray-500 text-sm">Median Reach</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">{formatNumber(summary.medianReach)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-gray-500 text-sm">Total Episodes Analyzed</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalEpisodes}</p>
        </div>
      </div>

      {/* Top & Bottom Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">🏆 Top Performers</h3>
          <div className="space-y-3">
            {topPerformers.map((ep, idx) => (
              <div key={ep.id} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <Link to={`/episodes/${ep.id}`} className="text-blue-600 hover:text-blue-700 font-medium text-sm truncate block">
                    Ep {ep.episodeNumber}: {ep.title}
                  </Link>
                  <div className="flex gap-1 mt-0.5">
                    {ep.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs text-gray-400">{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="font-semibold text-sm whitespace-nowrap">{formatNumber(ep.metrics.totalReach)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📉 Needs Attention</h3>
          <div className="space-y-3">
            {bottomPerformers.map((ep, idx) => (
              <div key={ep.id} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">
                  {summary.totalEpisodes - 4 + idx}
                </span>
                <div className="flex-1 min-w-0">
                  <Link to={`/episodes/${ep.id}`} className="text-blue-600 hover:text-blue-700 font-medium text-sm truncate block">
                    Ep {ep.episodeNumber}: {ep.title}
                  </Link>
                  <div className="flex gap-1 mt-0.5">
                    {ep.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs text-gray-400">{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="font-semibold text-sm whitespace-nowrap text-red-600">{formatNumber(ep.metrics.totalReach)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growth Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-2">📈 Growth Trajectory</h3>
        <p className="text-gray-500 text-sm mb-4">Total reach per episode over time — are you growing?</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={growthTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="episodeNumber" tick={{ fontSize: 11 }} label={{ value: 'Episode #', position: 'insideBottom', offset: -5, fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => formatNumber(value)}
              labelFormatter={(label) => {
                const ep = growthTrend.find(e => e.episodeNumber === label);
                return ep ? `Ep ${label}: ${ep.title}` : `Ep ${label}`;
              }}
            />
            <Line type="monotone" dataKey="totalReach" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} name="Total Reach" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Tag/Topic Analysis */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">🏷️ Topic Performance</h3>
          <p className="text-gray-500 text-sm mb-4">Average reach by episode tag/topic</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tagData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="tag" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'avgReach') return [formatNumber(value), 'Avg Reach'];
                  return [value, name];
                }}
              />
              <Bar dataKey="avgReach" fill="#3B82F6" radius={[0, 4, 4, 0]} name="avgReach" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Guest vs Solo */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">🎤 Guest vs Solo Episodes</h3>
          <p className="text-gray-500 text-sm mb-4">Do guest episodes perform better?</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {guestSoloData.map(item => (
              <div key={item.type} className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">{item.type}</p>
                <p className="text-2xl font-bold mt-1">{formatNumber(item.avgReach)}</p>
                <p className="text-xs text-gray-400 mt-1">avg reach • {item.count} episodes</p>
                <p className="text-xs text-gray-400">completion: {formatPercent(item.avgCompletion)}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={guestSoloData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Bar dataKey="avgReach" radius={[4, 4, 0, 0]} name="Avg Reach">
                <Cell fill="#3B82F6" />
                <Cell fill="#8B5CF6" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day of Week */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">📅 Publish Day Analysis</h3>
          <p className="text-gray-500 text-sm mb-4">Does the day you publish matter?</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'avgReach') return [formatNumber(value), 'Avg Reach'];
                  return [value, name];
                }}
              />
              <Bar dataKey="avgReach" fill="#10B981" radius={[4, 4, 0, 0]} name="avgReach" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {dayData.map(d => `${d.day}: ${d.count} ep${d.count > 1 ? 's' : ''}`).join(' • ')}
          </p>
        </div>

        {/* Duration Analysis */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">⏱️ Duration vs Performance</h3>
          <p className="text-gray-500 text-sm mb-4">How does episode length affect reach and completion?</p>
          <div className="space-y-4 mb-4">
            {durationData.map(item => (
              <div key={item.bucket} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{item.bucket}</span>
                  <span className="text-xs text-gray-400">{item.count} episodes</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-sm">Avg Reach: <strong>{formatNumber(item.avgReach)}</strong></span>
                  <span className="text-sm">Completion: <strong>{formatPercent(item.avgCompletion)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Duration vs Engagement Scatter */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-2">🔍 Duration vs Reach (per episode)</h3>
        <p className="text-gray-500 text-sm mb-4">Each dot is an episode. Size = completion rate. Color = guest (blue) vs solo (purple).</p>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" dataKey="duration" name="Duration (min)" tick={{ fontSize: 11 }} label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5, fontSize: 12 }} />
            <YAxis type="number" dataKey="totalReach" name="Total Reach" tick={{ fontSize: 11 }} />
            <ZAxis type="number" dataKey="completionRate" range={[50, 400]} name="Completion Rate" />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'Completion Rate') return [formatPercent(value), name];
                if (name === 'Total Reach') return [formatNumber(value), name];
                return [value, name];
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
                    <p className="font-semibold">Ep {data.episodeNumber}: {data.title}</p>
                    <p>Duration: {data.duration}m</p>
                    <p>Reach: {formatNumber(data.totalReach)}</p>
                    <p>Completion: {formatPercent(data.completionRate)}</p>
                    <p>{data.hasGuest ? '🎤 Guest' : '🎙️ Solo'}</p>
                  </div>
                );
              }}
            />
            <Scatter data={durationVsEngagement} fill="#3B82F6">
              {durationVsEngagement.map((entry, index) => (
                <Cell key={index} fill={entry.hasGuest ? '#3B82F6' : '#8B5CF6'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
