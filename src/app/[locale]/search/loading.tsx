export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded bg-warm-200" />
        <div className="mt-2 h-5 w-32 rounded bg-warm-100" />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface p-6 shadow-sm">
              <div className="mx-auto size-16 rounded-full bg-warm-200" />
              <div className="mx-auto mt-4 h-5 w-32 rounded bg-warm-100" />
              <div className="mx-auto mt-2 h-4 w-24 rounded bg-warm-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
