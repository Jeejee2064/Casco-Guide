"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const t = useTranslations("admin.spotForm");

  const addTag = () => {
    const clean = draft.trim().toLowerCase().replace(/\s+/g, "-");
    if (clean && !value.includes(clean)) {
      onChange([...value, clean]);
    }
    setDraft("");
  };

  return (
    <div className="rounded-[var(--radius-button)] border border-border bg-surface p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-magenta/10 px-2.5 py-1 text-xs font-semibold text-magenta-dark dark:text-magenta"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="hover:text-coral"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={addTag}
          placeholder={placeholder ?? t("tagsHint")}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}
