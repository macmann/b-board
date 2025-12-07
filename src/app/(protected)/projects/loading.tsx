export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-blue-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" aria-hidden />
        <span className="text-sm font-medium text-gray-700">Loading projects...</span>
      </div>
    </div>
  );
}
