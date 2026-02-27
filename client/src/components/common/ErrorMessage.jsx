export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p className="text-red-600 font-medium mb-2">⚠️ Error</p>
      <p className="text-red-500 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Retry
        </button>
      )}
    </div>
  );
}
