import { useParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getEpisodeDetail } from '../services/api';
import { formatNumber, formatPercent, formatDate, formatDuration, formatDateShort, PLATFORM_COLORS } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

export default function EpisodeDetail() {
  const { id } = useParams();
  const { data: episode, loading, error } = useApi(() => getEpisodeDetail(id), [id]);

  if (loading) return <LoadingSpinner message="Loading episode..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!episode) return <ErrorMessage message="Episode not found" />;

  const sp = episode.platforms.spotify;
  const ap = episode.platforms.apple;
  const yt = episode.platforms.youtube;

  // Platform comparison bar data
  const comparisonData = [
    {
      metric: 'Reach',
      Spotify: sp?.metrics?.totalStreams || 0,
      Apple: ap?.metrics?.totalDownloads || 0,
      YouTube: yt?.metrics?.totalViews || 0,
    },
    {
      metric: 'Listeners',
      Spotify: sp?.metrics?.totalListeners || 0,
      Apple: ap?.metrics?.uniqueListeners || 0,
      YouTube: yt?.metrics?.uniqueViewers || 0,
    },
  ];

  // Daily trend data (merge all platforms)
  const dailyMap = {};
  sp?.dailyStreams?.forEach(d => {
    if (!dailyMap[d.date]) dailyMap[d.date] = { date: d.date };
    dailyMap[d.date].spotify = d.count;
  });
  ap?.dailyDownloads?.forEach(d => {
    if (!dailyMap[d.date]) dailyMap[d.date] = { date: d.date };
    dailyMap[d.date].apple = d.count;
  });
  yt?.dailyViews?.forEach(d => {
    if (!dailyMap[d.date]) dailyMap[d.date] = { date: d.date };
    dailyMap[d.date].youtube = d.count;
  });
  const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/episodes" className="text-blue-600 hover:text-blue-700 text-sm">← Back to Episodes</Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            Episode {episode.episodeNumber}
          </span>
          <span className="text-gray-400 text-sm">{formatDate(episode.publishDate)}</span>
          <span className="text-gray-400 text-sm">• {formatDuration(episode.duration)}</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{episode.title}</h2>
        <div className="flex gap-2 mt-2 flex-wrap">
          {episode.guest && (
            <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">🎤 {episode.guest}</span>
          )}
          {episode.tags.map(tag => (
            <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{tag}</span>
          ))}
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Spotify */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS.spotify }}></div>
            <h3 className="font-semibold">Spotify</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Streams</span><span className="font-semibold">{formatNumber(sp?.metrics?.totalStreams)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Listeners</span><span className="font-semibold">{formatNumber(sp?.metrics?.totalListeners)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Starts</span><span>{formatNumber(sp?.metrics?.starts)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Completion</span><span>{formatPercent(sp?.metrics?.completionRate || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Saves</span><span>{formatNumber(sp?.metrics?.saves)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Shares</span><span>{formatNumber(sp?.metrics?.shares)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Followers +/-</span><span className="text-green-600">+{sp?.metrics?.followers?.gained || 0}</span></div>
          </div>
        </div>

        {/* Apple */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS.apple }}></div>
            <h3 className="font-semibold">Apple Podcasts</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Downloads</span><span className="font-semibold">{formatNumber(ap?.metrics?.totalDownloads)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Plays</span><span className="font-semibold">{formatNumber(ap?.metrics?.totalPlays)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Listeners</span><span>{formatNumber(ap?.metrics?.uniqueListeners)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Engaged</span><span>{formatNumber(ap?.metrics?.engagedListeners)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Avg Consumption</span><span>{formatPercent(ap?.metrics?.avgConsumption || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Avg Duration</span><span>{ap?.metrics?.avgListenDuration || 0}m</span></div>
          </div>
        </div>

        {/* YouTube */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS.youtube }}></div>
            <h3 className="font-semibold">YouTube</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Views</span><span className="font-semibold">{formatNumber(yt?.metrics?.totalViews)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Unique Viewers</span><span>{formatNumber(yt?.metrics?.uniqueViewers)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Watch Time</span><span>{yt?.metrics?.watchTimeHours || 0}h</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Avg View Duration</span><span>{formatPercent(yt?.metrics?.avgViewDuration || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Likes</span><span>{formatNumber(yt?.metrics?.likes)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Comments</span><span>{formatNumber(yt?.metrics?.comments)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Subscribers +/-</span><span className="text-green-600">+{yt?.metrics?.subscribersGained || 0}</span></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Platform Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Platform Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Legend />
              <Bar dataKey="Spotify" fill={PLATFORM_COLORS.spotify} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Apple" fill={PLATFORM_COLORS.apple} radius={[4, 4, 0, 0]} />
              <Bar dataKey="YouTube" fill={PLATFORM_COLORS.youtube} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Daily Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDateShort} formatter={(value) => formatNumber(value)} />
              <Legend />
              <Line type="monotone" dataKey="spotify" stroke={PLATFORM_COLORS.spotify} strokeWidth={2} dot={false} name="Spotify" />
              <Line type="monotone" dataKey="apple" stroke={PLATFORM_COLORS.apple} strokeWidth={2} dot={false} name="Apple" />
              <Line type="monotone" dataKey="youtube" stroke={PLATFORM_COLORS.youtube} strokeWidth={2} dot={false} name="YouTube" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
