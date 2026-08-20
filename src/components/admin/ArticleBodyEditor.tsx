"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo,
  Redo,
  Link2,
  Unlink,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/components/admin/PhotoUploader";
import { PlaceLinkPicker, type LinkablePlace, type PlaceLinkLabels } from "@/components/admin/PlaceLinkPicker";
import { HEADING_LEVELS, StyleSelect } from "@/components/admin/ArticleStyleControls";
import type { Locale } from "@/i18n/routing";

// Carries the referenced spot/event id+type through to the stored HTML, so
// src/lib/actions/articles.ts can recompute Article.spot_refs/event_refs on
// save, and ArticleDetailView can render the "places mentioned" map.
const ReferenceLink = TiptapLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-ref-type": { default: null },
      "data-ref-id": { default: null },
    };
  },
});

export function ArticleBodyEditor({
  value,
  onChange,
  locale,
  places,
  linkLabels,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Which locale's route this editor's links should point at ("/es/spots/…" vs "/en/spots/…"). */
  locale: Locale;
  places: LinkablePlace[];
  linkLabels: PlaceLinkLabels;
  placeholder?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: HEADING_LEVELS } }),
      TiptapImage.configure({ HTMLAttributes: { class: "rounded-[var(--radius-button)]" } }),
      ReferenceLink.configure({ openOnClick: false, autolink: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[220px] px-3.5 py-3 outline-none dark:prose-invert prose-a:text-aqua prose-a:no-underline prose-a:font-semibold",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    cn(
      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
      active ? "bg-aqua text-white" : "text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10",
    );

  const handlePlaceSelect = (place: LinkablePlace) => {
    const href = `/${locale}/${place.type}s/${place.slug}`;
    const attrs = { href, "data-ref-type": place.type, "data-ref-id": place.id };
    const { from, to } = editor.state.selection;

    if (from === to) {
      // Nothing selected — insert the place's name as new linked text.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: place.label,
          marks: [{ type: "link", attrs }],
        })
        .run();
    } else {
      // Turn the current selection into a link, keeping its own text.
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    }
    setPickerOpen(false);
  };

  const handlePhotoPick = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-button)] border border-border bg-surface">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-surface p-1.5">
        <StyleSelect editor={editor} />
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic"))}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
        >
          <ListOrdered size={15} />
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={btn(editor.isActive("link"))}
          title={linkLabels.title}
        >
          <Link2 size={15} />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={btn(false)}
          >
            <Unlink size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={btn(false)}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoPick(file);
            e.target.value = "";
          }}
        />
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}>
          <Undo size={15} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}>
          <Redo size={15} />
        </button>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />

      {pickerOpen && (
        <PlaceLinkPicker places={places} labels={linkLabels} onSelect={handlePlaceSelect} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
