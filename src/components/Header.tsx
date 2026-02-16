import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Forever
          </span>
          <span className="text-xl font-semibold text-zinc-400 dark:text-zinc-500">
            לעולם
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Search bar placeholder */}
          <div className="hidden sm:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search memorials..."
                className="h-9 w-64 rounded-lg border border-zinc-300 bg-zinc-50 px-3 pr-8 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
                disabled
              />
            </div>
          </div>

          {/* Auth placeholder */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Sign in</span>
          </div>

          {/* Language picker placeholder */}
          <button className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
