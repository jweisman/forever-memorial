export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Forever{" "}
          <span className="text-zinc-400 dark:text-zinc-500">(לעולם)</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A place to honor and remember loved ones. Create memorial pages, share
          stories, and preserve memories that matter — forever.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="#"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create a Memorial
          </a>
          <a
            href="#"
            className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-50"
          >
            Sign In &rarr;
          </a>
        </div>
      </div>

      {/* Recent memorials placeholder */}
      <div className="mt-20">
        <h2 className="text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Recent Memorials
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          No memorials yet. Be the first to create one.
        </p>
      </div>
    </div>
  );
}
