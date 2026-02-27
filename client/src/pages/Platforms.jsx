import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getPlatformComparison } from '../services/api';
import { formatNumber, formatPercent, PLATFORM_COLORS } from '../utils/formatters';
import KpiCard from '../components/common/KpiCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

export default function Platforms() {
  const { data: platforms, loading, error } = useApi(getPlatformComparison);

  if (loading) return <LoadingSpinner message="Loading platform data..." />;
  if (error) return <ErrorMessage message={error} />;

  const sp = platforms.spotify;
  const ap = platforms.apple;
  const yt = platforms.youtube;

  // Per-episode comparison (reach over time by platform)
  const episodeTrend = sp.episodeData.map((spEp, idx) => ({
    episode: `Ep ${spEp.episodeNumber}`,
    episodeNumber: spEp.episodeNumber,
    Spotify: spEp.reach,
    Apple: ap.episodeData[idx]?.reach || 0,
    YouTube: yt.episodeData[idx]?.reach || 0,
  }));

  // Radar chart data (normalized to max for each metric, safe division)
  const maxReach = Math.max(sp.totalReach, ap.totalReach, yt.totalReach) || 1;
  const maxListeners = Math.max(sp.totalListeners, ap.totalListeners, yt.totalListeners) || 1;
  const maxCompletion = Math.max(sp.avgCompletion, ap.avgCompletion, yt.avgCompletion) || 1;

  const radarData = [
    {
      metric: 'Reach',
      Spotify: (sp.totalReach / maxReach * 100).toFixed(0),
      Apple: (ap.totalReach / maxReach * 100).toFixed(0),
      YouTube: (yt.totalReach / maxReach * 100).toFixed(0),
    },
    {
      metric: 'Listeners',
      Spotify: (sp.totalListeners / maxListeners * 100).toFixed(0),
      Apple: (ap.totalListeners / maxListeners * 100).toFixed(0),
      YouTube: (yt.totalListeners / maxListeners * 100).toFixed(0),
    },
    {
      metric: 'Completion',
      Spotify: (sp.avgCompletion / maxCompletion * 100).toFixed(0),
      Apple: (ap.avgCompletion / maxCompletion * 100).toFixed(0),
      YouTube: (yt.avgCompletion / maxCompletion * 100).toFixed(0),
    },
    {
      metric: 'Consistency',
      Spotify: calculateConsistency(sp.episodeData),
      Apple: calculateConsistency(ap.episodeData),
      YouTube: calculateConsistency(yt.episodeData),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Platform Comparison</h2>
        <p className="text-gray-500 mt-1">Compare performance across Spotify, Apple Podcasts, and YouTube</p>
      </div>

      {/* Platform KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border-2 p-6" style={{ borderColor: PLATFORM_COLORS.spotify }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: PLATFORM_COLORS.spotify }}></div>
            <h3 className="font-bold text-lg">Spotify</h3>
          </div>
          <div className="space-y-2">
            <div><span className="text-gray-500 text-sm">Total Streams</span><p className="text-2xl font-bold">{formatNumber(sp.totalReach)}</p></div>
            <div><span className="text-gray-500 text-sm">Total Listeners</span><p className="text-lg font-semibold">{formatNumber(sp.totalListeners)}</p></div>
            <div><span className="text-gray-500 text-sm">Avg Completion</span><p className="text-lg font-semibold">{formatPercent(sp.avgCompletion)}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 p-6" style={{ borderColor: PLATFORM_COLORS.apple }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: PLATFORM_COLORS.apple }}></div>
            <h3 className="font-bold text-lg">Apple Podcasts</h3>
          </div>
          <div className="space-y-2">
            <div><span className="text-gray-500 text-sm">Total Downloads</span><p className="text-2xl font-bold">{formatNumber(ap.totalReach)}</p></div>
            <div><span className="text-gray-500 text-sm">Total Listeners</span><p className="text-lg font-semibold">{formatNumber(ap.totalListeners)}</p></div>
            <div><span className="text-gray-500 text-sm">Avg Consumption</span><p className="text-lg font-semibold">{formatPercent(ap.avgCompletion)}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 p-6" style={{ borderColor: PLATFORM_COLORS.youtube }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: PLATFORM_COLORS.youtube }}></div>
            <h3 className="font-bold text-lg">YouTube</h3>
          </div>
          <div className="space-y-2">
            <div><span className="text-gray-500 text-sm">Total Views</span><p className="text-2xl font-bold">{formatNumber(yt.totalReach)}</p></div>
            <div><span className="text-gray-500 text-sm">Total Viewers</span><p className="text-lg font-semibold">{formatNumber(yt.totalListeners)}</p></div>
            <div><span className="text-gray-500 text-sm">Avg View Duration</span><p className="text-lg font-semibold">{formatPercent(yt.avgCompletion)}</p></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Episode-by-episode comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Reach per Episode by Platform</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={episodeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="episode" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Legend />
              <Bar dataKey="Spotify" fill={PLATFORM_COLORS.spotify} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Apple" fill={PLATFORM_COLORS.apple} radius={[2, 2, 0, 0]} />
              <Bar dataKey="YouTube" fill={PLATFORM_COLORS.youtube} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Platform Strengths</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Radar name="Spotify" dataKey="Spotify" stroke={PLATFORM_COLORS.spotify} fill={PLATFORM_COLORS.spotify} fillOpacity={0.2} />
              <Radar name="Apple" dataKey="Apple" stroke={PLATFORM_COLORS.apple} fill={PLATFORM_COLORS.apple} fillOpacity={0.2} />
              <Radar name="YouTube" dataKey="YouTube" stroke={PLATFORM_COLORS.youtube} fill={PLATFORM_COLORS.youtube} fillOpacity={0.2} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Growth trend per platform */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Platform Growth Over Time</h3>
        <p className="text-gray-500 text-sm mb-4">Reach per episode showing growth trajectory for each platform</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={episodeTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => formatNumber(value)} />
            <Legend />
            <Line type="monotone" dataKey="Spotify" stroke={PLATFORM_COLORS.spotify} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Apple" stroke={PLATFORM_COLORS.apple} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="YouTube" stroke={PLATFORM_COLORS.youtube} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function calculateConsistency(episodeData) {
  if (!episodeData || episodeData.length < 2) return 50;
  const reaches = episodeData.map(e => e.reach);
  const mean = reaches.reduce((a, b) => a + b, 0) / reaches.length;
  if (mean === 0) return 0; // No data = no consistency score
  const variance = reaches.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / reaches.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  // Lower CV = more consistent = higher score
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}
