import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/episodes', label: 'Episodes', icon: '🎙️' },
  { path: '/platforms', label: 'Platforms', icon: '📡' },
  { path: '/insights', label: 'Insights', icon: '💡' },
  { path: '/media-kit', label: 'Media Kit', icon: '📋' },
  { path: '/data-upload', label: 'Data Upload', icon: '📤' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Logo / Title */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🎙️</span>
          <span>Podcast<br/>Analytics</span>
        </h1>
        <p className="text-gray-400 text-xs mt-1">The Insight Hour</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Export button */}
      <div className="p-4 border-t border-gray-700">
        <a
          href="/api/analytics/export"
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors text-sm"
          download
        >
          <span>📥</span>
          <span>Export CSV</span>
        </a>
      </div>

      {/* Footer */}
      <div className="p-4 text-gray-500 text-xs">
        <p>Using mock data</p>
        <p className="mt-1">v1.0.0</p>
      </div>
    </aside>
  );
}
