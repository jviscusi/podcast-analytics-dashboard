export default function KpiCard({ title, value, subtitle, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    red: 'bg-red-50 border-red-200 text-red-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
  };

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-sm mt-1 opacity-70">{subtitle}</p>}
    </div>
  );
}
