export default function MemorialLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="animate-pulse text-center">
        {/* Avatar */}
        <div className="mx-auto mb-6 size-28 rounded-full bg-warm-200" />
        {/* Name */}
        <div className="mx-auto h-8 w-48 rounded bg-warm-200" />
        {/* Dates */}
        <div className="mx-auto mt-3 h-5 w-32 rounded bg-warm-100" />
      </div>

      <div className="mt-12 space-y-8 animate-pulse">
        {/* Details card */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="h-5 w-20 rounded bg-warm-200" />
          <div className="mt-4 space-y-3">
            <div className="h-4 w-40 rounded bg-warm-100" />
            <div className="h-4 w-36 rounded bg-warm-100" />
          </div>
        </div>

        {/* Life story card */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="h-5 w-24 rounded bg-warm-200" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-warm-100" />
            <div className="h-4 w-full rounded bg-warm-100" />
            <div className="h-4 w-3/4 rounded bg-warm-100" />
          </div>
        </div>

        {/* Another card */}
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="h-5 w-28 rounded bg-warm-200" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-warm-100" />
            <div className="h-4 w-2/3 rounded bg-warm-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
