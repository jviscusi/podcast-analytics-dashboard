import { useState, useEffect, useRef } from 'react';
import { getEpisodes, getDataStatus, importPlatformCSV, submitBulkMetrics } from '../services/api';
import { formatDate, PLATFORM_COLORS } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const PLATFORMS = {
  spotify: {
    name: 'Spotify',
    icon: '🟢',
    color: '#1DB954',
    metrics: ['streams', 'listeners', 'completionRate', 'starts', 'saves', 'shares'],
    csvTemplate: 'episode_id,streams,listeners,completionRate,starts,saves,shares',
    helpText: 'Export from Spotify for Podcasters → Analytics'
  },
  apple: {
    name: 'Apple Podcasts',
    icon: '🟣',
    color: '#9B59B6',
    metrics: ['downloads', 'plays', 'listeners', 'avgConsumption', 'engagedListeners'],
    csvTemplate: 'episode_id,downloads,plays,listeners,avgConsumption,engagedListeners',
    helpText: 'Export from Apple Podcasts Connect → Analytics'
  },
  amazon: {
    name: 'Amazon Music',
    icon: '🔵',
    color: '#00A8E1',
    metrics: ['streams', 'listeners', 'completionRate', 'starts', 'followers'],
    csvTemplate: 'episode_id,streams,listeners,completionRate,starts,followers',
    helpText: 'Export from Amazon Music for Podcasters → Analytics'
  }
};

export default function DataUpload() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [dataStatus, setDataStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('csv'); // 'csv' or 'manual'
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
      const [eps, status] = await Promise.all([
        getEpisodes({ sortBy: 'episodeNumber', sortOrder: 'asc' }),
        getDataStatus().catch(() => null)
      ]);
      setEpisodes(eps);
      setDataStatus(status);

      // Initialize manual data structure
      const initial = {};
      eps.forEach(ep => {
        initial[ep.id] = {};
        Object.keys(PLATFORMS).forEach(platform => {
          initial[ep.id][platform] = {};
          PLATFORMS[platform].metrics.forEach(m => {
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
      const result = await importPlatformCSV(platform, content);
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
    e.target.value = ''; // Reset input
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

      // Refresh data status
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
    const config = PLATFORMS[platform];
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

  if (loading) return <LoadingSpinner message="Loading episodes..." />;
  if (error) return <ErrorMessage message={error} />;

  const platformConfig = PLATFORMS[selectedPlatform];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📤 Data Upload</h1>
        <p className="text-gray-500 mt-1">
          Upload podcast analytics from Spotify, Apple Podcasts, and Amazon Music
        </p>
      </div>

      {/* Data Source Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(PLATFORMS).map(([key, config]) => {
          const status = dataStatus?.[key];
          return (
            <div
              key={key}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                selectedPlatform === key ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedPlatform(key)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{config.icon}</span>
                <span className="font-semibold text-sm">{config.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                {status?.episodeCount > 0 ? (
                  <>
                    <span className="text-green-600 font-medium">✅ {status.episodeCount} episodes</span>
                    <br />
                    <span>Updated: {status.lastUpdated ? new Date(status.lastUpdated).toLocaleDateString() : '—'}</span>
                  </>
                ) : (
                  <span className="text-amber-600 font-medium">⚠️ No data yet</span>
                )}
              </div>
            </div>
          );
        })}

        {/* YouTube status (auto) */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4 opacity-75">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🔴</span>
            <span className="font-semibold text-sm">YouTube</span>
          </div>
          <div className="text-xs text-gray-500">
            <span className="text-green-600 font-medium">✅ Live API</span>
            <br />
            <span>Auto-refreshes every 10 min</span>
          </div>
        </div>
      </div>

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
        </div>

        <div className="p-6">
          {/* CSV Upload Tab */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Upload {platformConfig.name} CSV
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{platformConfig.helpText}</p>
                </div>
                <button
                  onClick={() => downloadTemplate(selectedPlatform)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                >
                  📥 Download Template
                </button>
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
                <div className="text-4xl mb-3">📁</div>
                <p className="text-lg font-medium text-gray-700">
                  Drop your {platformConfig.name} CSV here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click to browse files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* CSV Format Guide */}
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
            </div>
          )}

          {/* Manual Entry Tab */}
          {activeTab === 'manual' && (
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
                  {PLATFORMS[result.platform]?.name || result.platform}
                </span>
                {result.fileName && (
                  <span className="text-xs text-gray-500">({result.fileName})</span>
                )}
              </div>
              <p className="text-sm mt-1">
                {result.success ? (
                  result.type === 'manual_entry' ? (
                    `Saved metrics for ${result.episodes} episode${result.episodes > 1 ? 's' : ''}`
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

      {/* Episode ID Reference */}
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
