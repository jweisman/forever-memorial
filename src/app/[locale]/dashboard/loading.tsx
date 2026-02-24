export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="animate-pulse">
        {/* Title */}
        <div className="h-8 w-40 rounded bg-warm-200" />
        <div className="mt-2 h-5 w-56 rounded bg-warm-100" />

        {/* Profile card */}
        <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
          <div className="h-5 w-20 rounded bg-warm-200" />
          <div className="mt-4 space-y-3">
            <div className="h-10 w-full rounded bg-warm-100" />
            <div className="h-10 w-full rounded bg-warm-100" />
          </div>
        </div>

        {/* Memorials section */}
        <div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
          <div className="h-5 w-32 rounded bg-warm-200" />
          <div className="mt-4 space-y-3">
            <div className="h-16 w-full rounded bg-warm-100" />
            <div className="h-16 w-full rounded bg-warm-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
