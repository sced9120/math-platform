// 페이지 전환 중 즉시 표시되는 로딩 UI (loading.tsx 공용)
export default function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
        <p className="text-sm text-zinc-400">불러오는 중...</p>
      </div>
    </div>
  );
}
