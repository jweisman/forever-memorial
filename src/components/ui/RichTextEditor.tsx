"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

/** Convert legacy plain text (no HTML tags) to a basic Tiptap-compatible HTML string. */
function plainTextToHtml(text: string): string {
  if (!text.trim()) return "";
  return text
    .split(/\n{2,}/)
    .map((para) =>
      `<p>${para.replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-warm-200 text-warm-900"
          : "text-warm-500 hover:bg-warm-100 hover:text-warm-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Limit headings to H2 and H3 only
        heading: { levels: [2, 3] },
        // Disable unused extensions to keep the bundle lean
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
    ],
    content: value.includes("<") ? value : plainTextToHtml(value),
    onUpdate({ editor }) {
      // Emit empty string when the doc is just an empty paragraph
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[10rem] rounded-b-lg border border-t-0 border-border bg-surface px-4 py-3 text-sm text-warm-800 focus:outline-none",
      },
    },
  });

  // Sync external value changes (e.g. initial data load)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value.includes("<") ? value : plainTextToHtml(value);
    if (current !== incoming) {
      editor.commands.setContent(incoming);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="mt-1">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 rounded-t-lg border border-border bg-warm-50 px-2 py-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <div className="mx-1 w-px self-stretch bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Section heading"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Sub-heading"
        >
          H3
        </ToolbarButton>
        <div className="mx-1 w-px self-stretch bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Paragraph"
        >
          ¶
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}
