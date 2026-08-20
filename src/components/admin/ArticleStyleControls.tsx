"use client";

import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useTranslations } from "next-intl";

/**
 * Heading levels writers can pick from the "Style" dropdown, as real levels
 * in the Tiptap schema. Configure `StarterKit.configure({ heading: { levels:
 * HEADING_LEVELS } })` wherever ArticleEditor/ArticleBodyEditor is used.
 *
 * These render as <h2>/<h3>, not <h1>/<h2>: every spot/event/article page
 * already renders its own page <h1> for the title (see SpotDetailView,
 * EventDetailView, ArticleDetailView), so letting writers create a second
 * <h1> inside the body would break the page's heading outline. "Title 1" in
 * the editor maps to <h2> — the same level the rest of each page already
 * uses for its own sections (schedule, amenities, gallery…) — and "Title 2"
 * to <h3> beneath it.
 */
export const HEADING_LEVELS: (2 | 3)[] = [2, 3];

export type BlockStyle = "paragraph" | "title1" | "title2";

const LEVEL_BY_STYLE: Record<"title1" | "title2", 2 | 3> = {
  title1: 2,
  title2: 3,
};

export function currentBlockStyle(editor: Editor): BlockStyle {
  if (editor.isActive("heading", { level: 2 })) return "title1";
  if (editor.isActive("heading", { level: 3 })) return "title2";
  return "paragraph";
}

/**
 * Sets the paragraph/heading style of the current selection.
 *
 * Tiptap's built-in setNode/toggleHeading commands retype the *whole*
 * block(s) the selection touches — so selecting a few words in the middle of
 * a long paragraph and picking "Title 1" would turn the entire paragraph
 * into a heading, not just those words. To make the style picker behave
 * like the bold/link buttons (only the selected text is affected), when the
 * selection sits inside a single block without spanning it entirely, that
 * block is first split at the selection's edges — isolating the chosen text
 * into its own block — and only that new block is retyped.
 */
export function setBlockStyle(editor: Editor, style: BlockStyle) {
  const { heading, paragraph } = editor.schema.nodes;
  const targetType = style === "paragraph" ? paragraph : heading;
  const targetAttrs = style === "paragraph" ? undefined : { level: LEVEL_BY_STYLE[style] };

  const { $from, $to, empty, from, to } = editor.state.selection;

  // Collapsed cursor, or a selection crossing multiple blocks: fall back to
  // the normal whole-block behavior (e.g. placing the cursor on a line and
  // picking a style from the dropdown, with nothing highlighted).
  if (empty || $from.parent !== $to.parent) {
    editor.chain().focus().setNode(targetType, targetAttrs).run();
    return;
  }

  const blockStart = $from.start();
  const blockEnd = $from.end();

  editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;
      if (to < blockEnd) tr.split(to);
      if (from > blockStart) tr.split(from);

      const start = tr.mapping.map(from);
      const end = tr.mapping.map(to);
      tr.setBlockType(start, end, targetType, targetAttrs);
      tr.setSelection(TextSelection.create(tr.doc, start, end));
      dispatch(tr);
      return true;
    })
    .run();
}

/** The "Paragraph / Title 1 / Title 2" style picker shared by both article editors. */
export function StyleSelect({ editor }: { editor: Editor }) {
  const t = useTranslations("admin.articleEditor");

  return (
    <select
      aria-label={t("styleLabel")}
      value={currentBlockStyle(editor)}
      onChange={(e) => setBlockStyle(editor, e.target.value as BlockStyle)}
      className="h-8 rounded-lg border border-border bg-transparent px-2 text-xs font-medium text-foreground/80 outline-none hover:bg-black/5 dark:hover:bg-white/10"
    >
      <option value="paragraph">{t("paragraph")}</option>
      <option value="title1">{t("title1")}</option>
      <option value="title2">{t("title2")}</option>
    </select>
  );
}
