import Card from "@/components/ui/Card";
import CollapsibleText from "@/components/ui/CollapsibleText";

type MemoryCardProps = {
  memory: {
    id: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    createdAt: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null }[];
  };
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MemoryCard({ memory }: MemoryCardProps) {
  const displayName = memory.withholdName ? "Anonymous" : memory.name;

  return (
    <Card>
      <blockquote className="border-l-4 border-gold-400 pl-4">
        <CollapsibleText text={memory.text} maxLines={6} />

        {memory.images.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {memory.images.map((img) => (
              <div
                key={img.id}
                className="size-20 shrink-0 overflow-hidden rounded-lg bg-warm-100"
              >
                <img
                  src={img.thumbUrl}
                  alt={img.caption || "Memory photo"}
                  className="size-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        <footer className="mt-4 text-sm">
          <span className="font-medium text-warm-800">{displayName}</span>
          {memory.relation && (
            <span className="text-warm-400"> — {memory.relation}</span>
          )}
          <span className="ml-2 text-warm-300">
            {formatDate(memory.createdAt)}
          </span>
        </footer>
      </blockquote>
    </Card>
  );
}
