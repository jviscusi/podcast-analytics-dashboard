import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import KpiCard from '../components/common/KpiCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import {
  getOverview, getLinkedInSummary, getLinkedInDemographics,
  getLinkedInPosts, getLinkedInEngagement, getEpisodes,
  importLinkedInCSV, mapLinkedInEpisodes
} from '../services/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function MediaKit() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [liSummary, setLiSummary] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [liPosts, setLiPosts] = useState([]);
  const [liEngagement, setLiEngagement] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [importStatus, setImportStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [ov, lis, demo, posts, eng, eps] = await Promise.all([
        getOverview(),
        getLinkedInSummary().catch(() => null),
        getLinkedInDemographics().catch(() => null),
        getLinkedInPosts().catch(() => []),
        getLinkedInEngagement().catch(() => []),
        getEpisodes({ sortBy: 'totalReach', sortOrder: 'desc' })
      ]);
      setOverview(ov);
      setLiSummary(lis);
      setDemographics(demo);
      setLiPosts(posts);
      setLiEngagement(eng);
      setEpisodes(eps);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileImport(e) {
    const files = Array.from(e.target.files);
    setImportStatus({ importing: true, results: [] });

    const results = [];
    for (const file of files) {
      try {
        const content = await file.text();
        const result = await importLinkedInCSV(content, file.name);
        results.push({ file: file.name, ...result });
      } catch (err) {
        results.push({ file: file.name, success: false, error: err.message });
      }
    }

    // Auto-map episodes after import
    try {
      await mapLinkedInEpisodes();
    } catch (e) { /* ignore */ }

    setImportStatus({ importing: false, results });
    loadData(); // Refresh
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const hasLinkedInData = liSummary?.dataAvailable?.demographics;
  const totalCrossPlatformReach = (overview?.totalReach || 0) + (liSummary?.totalImpressions || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📋 Advertiser Media Kit</h1>
          <p className="text-gray-500 mt-1">Audience insights & sponsorship value for Impact Over Optics</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            📤 Import LinkedIn CSVs
            <input type="file" multiple accept=".csv" onChange={handleFileImport} className="hidden" />
          </label>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            🖨️ Print / PDF
          </button>
        </div>
      </div>

      {/* Import Status */}
      {importStatus && !importStatus.importing && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-800 mb-2">Import Complete</h3>
          {importStatus.results.map((r, i) => (
            <p key={i} className="text-sm text-green-700">
              {r.success ? '✅' : '❌'} {r.file}: {r.success ? `${r.type} — ${r.inserted} new, ${r.updated} updated` : r.error}
            </p>
          ))}
        </div>
      )}

      {/* Section 1: Audience Overview KPIs */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4">🎯 Audience Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Cross-Platform Reach"
            value={totalCrossPlatformReach.toLocaleString()}
            subtitle="Podcast + LinkedIn combined"
            icon="🌐"
            color="blue"
          />
          <KpiCard
            title="LinkedIn Followers"
            value={liSummary?.totalFollowers?.toLocaleString() || '—'}
            subtitle={`${liSummary?.decisionMakerPct || 0}% decision-makers`}
            icon="💼"
            color="purple"
          />
          <KpiCard
            title="Avg Engagement Rate"
            value={`${liSummary?.avgEngagementRate || 0}%`}
            subtitle="Industry avg: 2-5%"
            icon="📈"
            color="green"
          />
          <KpiCard
            title="Episodes Published"
            value={overview?.totalEpisodes || 0}
            subtitle={`${overview?.totalViews || 0} YouTube views`}
            icon="🎙️"
            color="amber"
          />
        </div>
      </section>

      {/* Section 2: Audience Demographics */}
      {hasLinkedInData && demographics && (
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4">👥 Audience Demographics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Seniority */}
            {demographics.seniority?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Seniority Level</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={demographics.seniority}
                      dataKey="value"
                      nameKey="label"
                      cx="50%" cy="50%"
                      outerRadius={90}
                      label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                    >
                      {demographics.seniority.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 p-3 bg-purple-50 rounded-lg text-center">
                  <span className="text-2xl font-bold text-purple-700">{liSummary?.decisionMakerPct}%</span>
                  <span className="text-purple-600 text-sm ml-2">are Director, VP, CXO, or Owner</span>
                </div>
              </div>
            )}

            {/* Industry */}
            {demographics.industry?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Top Industries</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demographics.industry.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Job Function */}
            {demographics.job_function?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Job Functions</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demographics.job_function.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Location */}
            {demographics.location?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Top Locations</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demographics.location.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Company Size */}
            {demographics.company_size?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Company Size</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={demographics.company_size}
                      dataKey="value"
                      nameKey="label"
                      cx="50%" cy="50%"
                      outerRadius={90}
                      label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {demographics.company_size.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 3: Cross-Platform Performance */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Cross-Platform Performance</h2>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Reach by Episode (All Platforms)</h3>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={episodes.slice(0, 15).reverse()} margin={{ top: 5, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="episodeNumber" 
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `Ep ${v}`}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={55}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border rounded-lg p-3 shadow-lg text-sm">
                      <p className="font-bold">Ep {d?.episodeNumber}: {d?.title?.substring(0, 40)}...</p>
                      {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="metrics.platforms.youtube.views" name="YouTube" fill="#EF4444" stackId="a" />
              <Bar dataKey="metrics.platforms.spotify.streams" name="Spotify" fill="#10B981" stackId="a" />
              <Bar dataKey="metrics.platforms.apple.downloads" name="Apple" fill="#8B5CF6" stackId="a" />
              <Bar dataKey="metrics.platforms.amazon.streams" name="Amazon" fill="#3B82F6" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Section 4: LinkedIn Engagement */}
      {liPosts.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4">🔗 LinkedIn Amplification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Post Performance Table */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-700 mb-4">Post Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Impressions</th>
                      <th className="pb-2">Clicks</th>
                      <th className="pb-2">Engagement</th>
                      <th className="pb-2">Reactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liPosts.map((post, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2">{post.created_date?.substring(0, 10)}</td>
                        <td className="py-2 font-medium">{post.impressions}</td>
                        <td className="py-2">{post.clicks}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            post.engagement_rate > 0.1 ? 'bg-green-100 text-green-700' :
                            post.engagement_rate > 0.05 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {(post.engagement_rate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2">
                          {post.likes > 0 && <span title="Likes">👍{post.likes} </span>}
                          {post.comments > 0 && <span title="Comments">💬{post.comments} </span>}
                          {post.reposts > 0 && <span title="Reposts">🔄{post.reposts}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Engagement Trend */}
            {liEngagement.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Daily LinkedIn Impressions</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={liEngagement}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="impressions_total" name="Impressions" stroke="#0A66C2" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicks_total" name="Clicks" stroke="#10B981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 5: Sponsorship Value */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4">💰 Sponsorship Value</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white">
            <h3 className="text-sm font-medium opacity-80 mb-2">Total Cross-Platform Reach</h3>
            <p className="text-4xl font-bold">{totalCrossPlatformReach.toLocaleString()}</p>
            <p className="text-sm mt-2 opacity-70">
              Podcast streams/views + LinkedIn impressions
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 text-white">
            <h3 className="text-sm font-medium opacity-80 mb-2">Audience Quality Score</h3>
            <p className="text-4xl font-bold">
              {liSummary?.decisionMakerPct ? 'A+' : '—'}
            </p>
            <p className="text-sm mt-2 opacity-70">
              {liSummary?.decisionMakerPct || 0}% Director+ level audience
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 text-white">
            <h3 className="text-sm font-medium opacity-80 mb-2">Engagement Premium</h3>
            <p className="text-4xl font-bold">
              {liSummary?.avgEngagementRate ? `${(liSummary.avgEngagementRate / 3.5).toFixed(1)}x` : '—'}
            </p>
            <p className="text-sm mt-2 opacity-70">
              vs. LinkedIn industry average (3.5%)
            </p>
          </div>
        </div>

        {/* Sponsorship Packages */}
        <div className="mt-6 bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Available Sponsorship Formats</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
              <h4 className="font-bold text-gray-800">🎤 Pre-Roll</h4>
              <p className="text-sm text-gray-500 mt-1">30-60 second mention at episode start</p>
              <p className="text-xs text-gray-400 mt-2">Reaches all listeners/viewers</p>
            </div>
            <div className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
              <h4 className="font-bold text-gray-800">📍 Mid-Roll</h4>
              <p className="text-sm text-gray-500 mt-1">60-90 second integrated segment</p>
              <p className="text-xs text-gray-400 mt-2">Highest engagement point</p>
            </div>
            <div className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
              <h4 className="font-bold text-gray-800">🔗 LinkedIn Bundle</h4>
              <p className="text-sm text-gray-500 mt-1">Podcast mention + LinkedIn post feature</p>
              <p className="text-xs text-gray-400 mt-2">Cross-platform amplification</p>
            </div>
          </div>
        </div>
      </section>

      {/* No LinkedIn Data Prompt */}
      {!hasLinkedInData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold text-blue-800 mb-2">Import LinkedIn Data</h3>
          <p className="text-blue-600 mb-4">
            Upload your LinkedIn CSV exports to unlock audience demographics, engagement analytics, and cross-platform correlation.
          </p>
          <label className="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            📤 Select LinkedIn CSV Files
            <input type="file" multiple accept=".csv" onChange={handleFileImport} className="hidden" />
          </label>
          <p className="text-xs text-blue-400 mt-3">
            Export from: LinkedIn Page → Analytics → Export (followers, content, visitors)
          </p>
        </div>
      )}
    </div>
  );
}
