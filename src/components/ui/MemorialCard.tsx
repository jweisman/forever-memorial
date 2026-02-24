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
      <Card padding="sm" className="group transition-shadow hover:shadow-md">
        <div className="flex items-center gap-4">
        <div
          className="size-16 shrink-0 rounded-lg bg-warm-200 bg-cover bg-center"
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
          role="img"
          aria-label={`Memorial photo of ${name}`}
        >
          {!imageUrl && (
            <div className="flex size-full items-center justify-center rounded-lg text-2xl text-warm-400">
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
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
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
