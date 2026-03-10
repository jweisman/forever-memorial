type Props = {
  html: string;
  className?: string;
};

/**
 * Renders sanitized rich text HTML from the Life Story field.
 * Content is sanitized on the server at save time (via the PATCH route),
 * so it is safe to render with dangerouslySetInnerHTML here.
 */
export default function RichTextContent({ html, className = "" }: Props) {
  // Detect legacy plain text (no HTML tags) — render as preformatted text
  if (!html.includes("<")) {
    return (
      <p className={`whitespace-pre-wrap text-sm leading-relaxed text-warm-700 ${className}`}>
        {html}
      </p>
    );
  }

  return (
    <div
      className={`rich-text text-sm leading-relaxed text-warm-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
