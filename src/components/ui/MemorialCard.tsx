import { Link } from "@/i18n/navigation";
import Card from "./Card";

type MemorialCardProps = {
  name: string;
  dates: string;
  placeOfDeath?: string;
  imageUrl?: string;
  href?: string;
};

export default function MemorialCard({
  name,
  dates,
  placeOfDeath,
  imageUrl,
  href,
}: MemorialCardProps) {
  const Wrapper = href
    ? ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <Link href={href} className={`block ${className ?? ""}`}>{children}</Link>
      )
    : ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      );

  return (
    <Wrapper>
      <Card padding="sm" className="group overflow-hidden transition-shadow hover:shadow-md">
        <div className="flex items-center gap-4">
        <div
          className="aspect-[4/3] h-16 shrink-0 overflow-hidden rounded-lg bg-warm-200"
          role="img"
          aria-label={`Memorial photo of ${name}`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Memorial photo of ${name}`}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-warm-400">
              <svg
                className="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-semibold text-warm-800 group-hover:text-accent">
            {name}
          </h3>
          <p className="text-sm text-muted">{dates}</p>
          {placeOfDeath && (
            <p className="text-sm text-warm-400">{placeOfDeath}</p>
          )}
        </div>
      </div>
    </Card>
    </Wrapper>
  );
}
