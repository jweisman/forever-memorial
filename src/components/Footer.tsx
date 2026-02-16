export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted">
            <span className="font-heading font-medium text-warm-700">
              Forever
            </span>{" "}
            <span className="text-gold-500">(לעולם)</span>
            {" "}&mdash; Preserving memories that matter
          </p>
          <p className="text-sm text-warm-400">
            &copy; {new Date().getFullYear()} Forever Memorial
          </p>
        </div>
      </div>
    </footer>
  );
}
