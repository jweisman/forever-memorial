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
        {imageUrl && (
          <div
            className="aspect-[4/3] h-16 shrink-0 overflow-hidden rounded-lg bg-warm-200"
            role="img"
            aria-label={`Memorial photo of ${name}`}
          >
            <img
              src={imageUrl}
              alt={`Memorial photo of ${name}`}
              className="size-full object-cover"
            />
          </div>
        )}
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
