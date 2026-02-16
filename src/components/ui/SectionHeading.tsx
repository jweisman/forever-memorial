import { HTMLAttributes } from "react";

type SectionHeadingProps = HTMLAttributes<HTMLElement> & {
  title: string;
  subtitle?: string;
  as?: "h1" | "h2" | "h3";
  align?: "start" | "center";
};

export default function SectionHeading({
  title,
  subtitle,
  as: Tag = "h2",
  align = "center",
  className = "",
  ...props
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "text-center" : "text-start";

  return (
    <header className={`${alignClass} ${className}`} {...props}>
      <Tag className="font-heading text-2xl font-semibold text-warm-800 sm:text-3xl">
        {title}
      </Tag>
      {subtitle && (
        <p className="mt-2 text-base text-muted">{subtitle}</p>
      )}
    </header>
  );
}
