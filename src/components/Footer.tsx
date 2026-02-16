export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-zinc-500">
            Forever (לעולם) &mdash; Preserving memories that matter
          </p>
          <p className="text-sm text-zinc-400">
            &copy; {new Date().getFullYear()} Forever Memorial
          </p>
        </div>
      </div>
    </footer>
  );
}
