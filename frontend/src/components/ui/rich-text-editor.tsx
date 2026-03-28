"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  variant?: "default" | "highlight";
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Text eingeben...",
  className,
  minHeight = "80px",
  variant = "default",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2",
          `min-h-[${minHeight}]`
        ),
      },
    },
  });

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border",
        variant === "highlight"
          ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-600"
          : "border-input bg-background",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", editor.isActive("bold") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", editor.isActive("italic") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", editor.isActive("bulletList") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", editor.isActive("orderedList") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
      </div>
      {/* Editor */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
        {!content && (
          <div className="pointer-events-none absolute px-3 py-2 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline rich-text editor for table cells.
 */
interface CellEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function CellRichTextEditor({
  content,
  onChange,
  placeholder = "Aktivität...",
}: CellEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-xs dark:prose-invert max-w-none focus:outline-none p-1.5 min-h-[50px] text-xs",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded border border-input bg-background">
      <div className="flex items-center gap-0.5 border-b px-1 py-0.5">
        <button
          type="button"
          className={cn(
            "rounded p-0.5 text-muted-foreground hover:bg-muted",
            editor.isActive("bold") && "bg-muted text-foreground"
          )}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3 w-3" />
        </button>
        <button
          type="button"
          className={cn(
            "rounded p-0.5 text-muted-foreground hover:bg-muted",
            editor.isActive("italic") && "bg-muted text-foreground"
          )}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3 w-3" />
        </button>
        <button
          type="button"
          className={cn(
            "rounded p-0.5 text-muted-foreground hover:bg-muted",
            editor.isActive("bulletList") && "bg-muted text-foreground"
          )}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3 w-3" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
