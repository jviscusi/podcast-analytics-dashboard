import { useState, useEffect, useRef } from 'react';
import {
  getEpisodes, getDataStatus, importPlatformCSV, submitBulkMetrics,
  importLinkedInCSV, mapLinkedInEpisodes,
  getYouTubeAuthStatus, getYouTubeAuthUrl
} from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

// ============================================
// Platform Configurations
// ============================================

const PODCAST_PLATFORMS = {
  spotify: {
    name: 'Spotify',
    icon: '🟢',
    color: '#1DB954',
    type: 'podcast',
    metrics: ['streams', 'listeners', 'starts', 'saves', 'shares'],
    csvTemplate: '"name","plays","streams","audience_size","releaseDate"',
    nativeFormat: true,
    helpText: 'Upload directly from Spotify for Podcasters → Analytics → Export CSV'
  },
  apple: {
    name: 'Apple Podcasts',
    icon: '🟣',
    color: '#9B59B6',
    type: 'podcast',
    metrics: ['downloads', 'plays', 'listeners', 'avgConsumption', 'engagedListeners'],
    csvTemplate: 'episode_id,downloads,plays,listeners,avgConsumption,engagedListeners',
    helpText: 'Export from Apple Podcasts Connect → Analytics'
  },
  amazon: {
    name: 'Amazon Music',
    icon: '🔵',
    color: '#00A8E1',
    type: 'podcast',
    metrics: ['streams', 'listeners', 'completionRate', 'starts', 'followers'],
    csvTemplate: 'episode_id,streams,listeners,completionRate,starts,followers',
    helpText: 'Export from Amazon Music for Podcasters → Analytics'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    type: 'social',
    csvTypes: [
      'Follower Demographics (seniority, industry, company size, location, job function)',
      'Content/Post Engagement',
      'Daily Aggregate Engagement',
      'Follower Growth',
      'Page Visitors'
    ],
    helpText: 'Export from LinkedIn Company Page → Analytics → Export'
  }
};

export default function DataUpload() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [dataStatus, setDataStatus] = useState(null);
  const [youtubeAuth, setYoutubeAuth] = useState(null);
  const [activeTab, setActiveTab] = useState('csv');
  const [selectedPlatform, setSelectedPlatform] = useState('spotify');
  const [importResults, setImportResults] = useState([]);
  const [manualData, setManualData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [eps, status, ytAuth] = await Promise.all([
        getEpisodes({ sortBy: 'episodeNumber', sortOrder: 'asc' }),
        getDataStatus().catch(() => null),
        getYouTubeAuthStatus().catch(() => ({ authorized: false }))
      ]);
      setEpisodes(eps);
      setDataStatus(status);
      setYoutubeAuth(ytAuth);

      // Initialize manual data structure for podcast platforms
      const initial = {};
      eps.forEach(ep => {
        initial[ep.id] = {};
        Object.entries(PODCAST_PLATFORMS).forEach(([platform, config]) => {
          if (config.type !== 'podcast') return;
          initial[ep.id][platform] = {};
          config.metrics.forEach(m => {
            initial[ep.id][platform][m] = '';
          });
        });
      });
      setManualData(initial);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // CSV Upload Handlers
  // ============================================

  async function handleCSVUpload(platform, file) {
    try {
      const content = await file.text();
      let result;

      if (platform === 'linkedin') {
        result = await importLinkedInCSV(content, file.name);
        // Auto-map episodes after LinkedIn import
        try { await mapLinkedInEpisodes(); } catch (e) { /* ignore */ }
      } else {
        result = await importPlatformCSV(platform, content);
      }

      setImportResults(prev => [...prev, {
        platform,
        fileName: file.name,
        success: true,
        ...result
      }]);
      // Refresh data status
      const status = await getDataStatus().catch(() => null);
      setDataStatus(status);
    } catch (err) {
      setImportResults(prev => [...prev, {
        platform,
        fileName: file.name,
        success: false,
        error: err.message
      }]);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => handleCSVUpload(selectedPlatform, file));
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    files.forEach(file => handleCSVUpload(selectedPlatform, file));
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  // ============================================
  // Manual Entry Handlers
  // ============================================

  function updateManualField(episodeId, metric, value) {
    setManualData(prev => ({
      ...prev,
      [episodeId]: {
        ...prev[episodeId],
        [selectedPlatform]: {
          ...prev[episodeId]?.[selectedPlatform],
          [metric]: value
        }
      }
    }));
  }

  async function handleManualSubmit() {
    setSubmitting(true);
    try {
      const platform = selectedPlatform;
      const episodesToSubmit = [];

      Object.entries(manualData).forEach(([episodeId, platforms]) => {
        const metrics = platforms[platform];
        if (!metrics) return;

        const numericMetrics = {};
        let hasData = false;
        Object.entries(metrics).forEach(([key, val]) => {
          if (val !== '' && val !== undefined && val !== null) {
            numericMetrics[key] = parseFloat(val);
            hasData = true;
          }
        });

        if (hasData) {
          episodesToSubmit.push({ episodeId, metrics: numericMetrics });
        }
      });

      if (episodesToSubmit.length === 0) {
        setImportResults(prev => [...prev, {
          platform,
          success: false,
          error: 'No data entered. Please fill in at least one metric for one episode.'
        }]);
        setSubmitting(false);
        return;
      }

      const result = await submitBulkMetrics(
        platform,
        episodesToSubmit,
        new Date().toISOString().split('T')[0],
        'Manual entry from dashboard'
      );

      setImportResults(prev => [...prev, {
        platform,
        success: true,
        type: 'manual_entry',
        imported: result.imported || episodesToSubmit.length,
        episodes: episodesToSubmit.length
      }]);

      const status = await getDataStatus().catch(() => null);
      setDataStatus(status);
    } catch (err) {
      setImportResults(prev => [...prev, {
        platform: selectedPlatform,
        success: false,
        error: err.message
      }]);
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================
  // CSV Template Download
  // ============================================

  function downloadTemplate(platform) {
    const config = PODCAST_PLATFORMS[platform];
    if (config.type !== 'podcast') return;
    const header = config.csvTemplate;
    const rows = episodes.map(ep => {
      const values = [ep.id, ...config.metrics.map(() => '')];
      return values.join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${platform}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================
  // YouTube Re-auth
  // ============================================

  async function handleYouTubeReauth() {
    try {
      const { url } = await getYouTubeAuthUrl();
      window.open(url, '_blank', 'width=600,height=700');
    } catch (err) {
      setImportResults(prev => [...prev, {
        platform: 'youtube',
        success: false,
        error: `Failed to get auth URL: ${err.message}`
      }]);
    }
  }

  if (loading) return <LoadingSpinner message="Loading episodes..." />;
  if (error) return <ErrorMessage message={error} />;

  const platformConfig = PODCAST_PLATFORMS[selectedPlatform];
  const isLinkedIn = selectedPlatform === 'linkedin';
  const isPodcast = platformConfig?.type === 'podcast';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📤 Data Upload</h1>
        <p className="text-gray-500 mt-1">
          Upload analytics from Spotify, Apple Podcasts, Amazon Music, and LinkedIn
        </p>
      </div>

      {/* Data Source Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(PODCAST_PLATFORMS).map(([key, config]) => {
          const status = dataStatus?.[key];
          return (
            <div
              key={key}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                selectedPlatform === key ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedPlatform(key);
                if (key === 'linkedin') setActiveTab('csv');
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{config.icon}</span>
                <span className="font-semibold text-xs">{config.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                {key === 'linkedin' ? (
                  status?.episodeCount > 0 || dataStatus?.linkedin ? (
                    <span className="text-green-600 font-medium">✅ Data loaded</span>
                  ) : (
                    <span className="text-amber-600 font-medium">⚠️ No data yet</span>
                  )
                ) : status?.episodeCount > 0 ? (
                  <>
                    <span className="text-green-600 font-medium">✅ {status.episodeCount} eps</span>
                    <br />
                    <span className="text-[10px]">Updated: {status.lastUpdated ? new Date(status.lastUpdated).toLocaleDateString() : '—'}</span>
                  </>
                ) : (
                  <span className="text-amber-600 font-medium">⚠️ No data yet</span>
                )}
              </div>
            </div>
          );
        })}

        {/* YouTube status card */}
        <div
          className="bg-white rounded-xl border-2 border-gray-200 p-4 cursor-pointer hover:border-gray-300 transition-all"
          onClick={!youtubeAuth?.authorized ? handleYouTubeReauth : undefined}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔴</span>
            <span className="font-semibold text-xs">YouTube</span>
          </div>
          <div className="text-xs text-gray-500">
            {youtubeAuth?.authorized ? (
              <>
                <span className="text-green-600 font-medium">✅ Live API</span>
                <br />
                <span className="text-[10px]">Auto-refreshes</span>
              </>
            ) : (
              <>
                <span className="text-red-600 font-medium">❌ Token expired</span>
                <br />
                <span className="text-blue-600 text-[10px] underline cursor-pointer">Click to re-authorize</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* YouTube Re-auth Banner */}
      {!youtubeAuth?.authorized && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-red-800">🔴 YouTube Authorization Expired</h3>
            <p className="text-sm text-red-600 mt-1">
              Your YouTube OAuth token has expired. Re-authorize to restore live YouTube data.
              Alternatively, run: <code className="bg-red-100 px-1 rounded text-xs">cd server && node services/youtube-auth.js</code>
            </p>
          </div>
          <button
            onClick={handleYouTubeReauth}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium whitespace-nowrap ml-4"
          >
            🔑 Re-authorize
          </button>
        </div>
      )}

      {/* Upload Method Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'csv'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            📄 CSV Upload
          </button>
          {isPodcast && (
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              ✏️ Manual Entry
            </button>
          )}
        </div>

        <div className="p-6">
          {/* CSV Upload Tab */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Upload {platformConfig.name} CSV{isLinkedIn ? 's' : ''}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{platformConfig.helpText}</p>
                </div>
                {isPodcast && (
                  <button
                    onClick={() => downloadTemplate(selectedPlatform)}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                  >
                    📥 Download Template
                  </button>
                )}
              </div>

              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="text-4xl mb-3">{isLinkedIn ? '💼' : '📁'}</div>
                <p className="text-lg font-medium text-gray-700">
                  Drop your {platformConfig.name} CSV{isLinkedIn ? ' files' : ''} here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click to browse files{isLinkedIn ? ' (select multiple)' : ''}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  multiple={isLinkedIn}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Duplicate Safety Notice */}
              <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                <span className="text-blue-500 mt-0.5">🔄</span>
                <p className="text-xs text-blue-700">
                  <strong>Safe to re-upload:</strong> Duplicate data is automatically handled.
                  Existing records are updated with the latest values — no duplicates will be created.
                </p>
              </div>

              {/* Platform-specific format guide */}
              {isPodcast && platformConfig.nativeFormat && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="font-medium text-green-800 text-sm mb-2">✅ Native {platformConfig.name} Export Supported</h4>
                  <p className="text-xs text-green-700 mb-3">
                    Upload the CSV file directly from {platformConfig.name} — no modifications needed!
                    Episodes are automatically matched by name (e.g., "IOO Podcast 001" → ep-001).
                  </p>
                  <code className="block text-xs bg-white rounded p-3 border text-gray-600 overflow-x-auto whitespace-pre">
{`"name","plays","streams","audience_size","releaseDate"
"IOO Podcast 001 - Introduction to Purpose Driven Leadership","13","9","8","2025-11-22"
"IOO Podcast 002 - Emily Pinto on Purpose Driven Leadership","2","2","2","2025-11-22"`}
                  </code>
                  <p className="text-xs text-green-700 mt-2">
                    <strong>Column mapping:</strong> plays → starts, streams → streams, audience_size → listeners
                  </p>
                </div>
              )}

              {isPodcast && !platformConfig.nativeFormat && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 text-sm mb-2">Expected CSV Format</h4>
                  <code className="block text-xs bg-white rounded p-3 border text-gray-600 overflow-x-auto">
                    {platformConfig.csvTemplate}
                    {'\n'}
                    {episodes.length > 0 && (
                      <>
                        {episodes[0].id},{platformConfig.metrics.map((m, i) => i === 0 ? '150' : i === 1 ? '120' : '0').join(',')}
                        {'\n'}
                        {episodes.length > 1 && `${episodes[1].id},${platformConfig.metrics.map((m, i) => i === 0 ? '200' : i === 1 ? '160' : '0').join(',')}`}
                      </>
                    )}
                  </code>
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Episode IDs:</strong> {episodes.slice(0, 5).map(e => e.id).join(', ')}{episodes.length > 5 ? '...' : ''}
                  </p>
                </div>
              )}

              {isLinkedIn && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 text-sm mb-2">Supported LinkedIn CSV Types</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    The system auto-detects the CSV type from the headers. You can upload multiple files at once.
                  </p>
                  <ul className="space-y-1.5">
                    {platformConfig.csvTypes.map((type, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-blue-500">📄</span>
                        {type}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 p-3 bg-white rounded border text-xs text-gray-500">
                    <strong>How to export:</strong> Go to your{' '}
                    <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      LinkedIn Company Page
                    </a>
                    {' → Admin → Analytics → Click the export button on each tab (Followers, Content, Visitors)'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Tab (podcast platforms only) */}
          {activeTab === 'manual' && isPodcast && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Enter {platformConfig.name} Metrics
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Type in the latest numbers for each episode
                  </p>
                </div>
                <button
                  onClick={handleManualSubmit}
                  disabled={submitting}
                  className={`px-6 py-2 rounded-lg text-white font-medium text-sm transition-colors ${
                    submitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting ? '⏳ Saving...' : '💾 Save All'}
                </button>
              </div>

              {/* Duplicate Safety Notice */}
              <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                <span className="text-blue-500 mt-0.5">🔄</span>
                <p className="text-xs text-blue-700">
                  <strong>Safe to re-enter:</strong> Submitting data for an episode that already has metrics
                  will update the existing values — no duplicates will be created.
                </p>
              </div>

              {/* Manual Entry Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-3 font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-[200px]">
                        Episode
                      </th>
                      {platformConfig.metrics.map(metric => (
                        <th key={metric} className="text-left py-3 px-2 font-medium text-gray-600 min-w-[100px]">
                          {formatMetricName(metric)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {episodes.map((ep, idx) => (
                      <tr key={ep.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-2 px-3 sticky left-0 bg-inherit">
                          <div className="font-medium text-gray-800 text-xs">
                            Ep {ep.episodeNumber}
                          </div>
                          <div className="text-gray-500 text-xs truncate max-w-[180px]" title={ep.title}>
                            {ep.title}
                          </div>
                        </td>
                        {platformConfig.metrics.map(metric => (
                          <td key={metric} className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              step={metric.includes('Rate') || metric.includes('Consumption') ? '0.01' : '1'}
                              placeholder="—"
                              value={manualData[ep.id]?.[selectedPlatform]?.[metric] || ''}
                              onChange={(e) => updateManualField(ep.id, metric, e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Metric Descriptions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 text-sm mb-2">
                  {platformConfig.name} Metric Descriptions
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
                  {platformConfig.metrics.map(metric => (
                    <div key={metric}>
                      <span className="font-medium">{formatMetricName(metric)}:</span>{' '}
                      {getMetricDescription(selectedPlatform, metric)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Results */}
      {importResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Import Results</h3>
            <button
              onClick={() => setImportResults([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          {importResults.map((result, i) => (
            <div
              key={i}
              className={`rounded-lg p-4 border ${
                result.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{result.success ? '✅' : '❌'}</span>
                <span className="font-medium text-sm">
                  {PODCAST_PLATFORMS[result.platform]?.name || result.platform}
                </span>
                {result.fileName && (
                  <span className="text-xs text-gray-500">({result.fileName})</span>
                )}
              </div>
              <p className="text-sm mt-1">
                {result.success ? (
                  result.type === 'manual_entry' ? (
                    `Saved metrics for ${result.episodes} episode${result.episodes > 1 ? 's' : ''}`
                  ) : result.platform === 'linkedin' ? (
                    <>
                      {result.type && <span className="font-medium">{result.type}: </span>}
                      {result.inserted > 0 && <span className="text-green-700">{result.inserted} new</span>}
                      {result.inserted > 0 && result.updated > 0 && ', '}
                      {result.updated > 0 && <span className="text-blue-700">{result.updated} updated</span>}
                      {result.skipped > 0 && <span className="text-gray-500">, {result.skipped} skipped</span>}
                    </>
                  ) : (
                    <>
                      Imported {result.imported} row{result.imported !== 1 ? 's' : ''}
                      {result.errors?.length > 0 && (
                        <span className="text-amber-600"> ({result.errors.length} warning{result.errors.length !== 1 ? 's' : ''})</span>
                      )}
                    </>
                  )
                ) : (
                  <span className="text-red-700">{result.error}</span>
                )}
              </p>
              {result.errors?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-amber-600 cursor-pointer">Show warnings</summary>
                  <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                    {result.errors.map((err, j) => <li key={j}>• {err}</li>)}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Episode ID Reference (only for podcast platforms) */}
      {isPodcast && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">📋 Episode ID Reference</h3>
          <p className="text-sm text-gray-500 mb-4">
            Use these IDs in your CSV files to match data to the correct episodes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {episodes.map(ep => (
              <div key={ep.id} className="flex items-center gap-2 text-sm py-1">
                <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-blue-700">
                  {ep.id}
                </code>
                <span className="text-gray-600 truncate text-xs">
                  Ep {ep.episodeNumber}: {ep.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function formatMetricName(metric) {
  const names = {
    streams: 'Streams',
    listeners: 'Listeners',
    completionRate: 'Completion %',
    starts: 'Starts',
    saves: 'Saves',
    shares: 'Shares',
    downloads: 'Downloads',
    plays: 'Plays',
    avgConsumption: 'Avg Consumption %',
    engagedListeners: 'Engaged Listeners',
    followers: 'Followers'
  };
  return names[metric] || metric;
}

function getMetricDescription(platform, metric) {
  const descriptions = {
    spotify: {
      streams: 'Total stream count',
      listeners: 'Unique listeners',
      completionRate: 'Avg % listened (0-100)',
      starts: 'Number of starts',
      saves: 'Saved to library',
      shares: 'Shared by listeners'
    },
    apple: {
      downloads: 'Total downloads',
      plays: 'Total plays',
      listeners: 'Unique listeners',
      avgConsumption: 'Avg % consumed (0-100)',
      engagedListeners: 'Listened >20 min'
    },
    amazon: {
      streams: 'Total streams',
      listeners: 'Unique listeners',
      completionRate: 'Avg % listened (0-100)',
      starts: 'Number of starts',
      followers: 'New followers gained'
    }
  };
  return descriptions[platform]?.[metric] || '';
}
