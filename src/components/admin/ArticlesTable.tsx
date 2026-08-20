"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Pencil, Trash2, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Field";
import { deleteArticle } from "@/lib/actions/articles";
import { cn } from "@/lib/utils";
import type { Article } from "@/lib/types/database";

export function ArticlesTable({ articles: initialArticles }: { articles: Article[] }) {
  const t = useTranslations("admin.articles");
  const [articles, setArticles] = useState(initialArticles);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => !q || a.title.toLowerCase().includes(q));
  }, [articles, query]);

  const handleDelete = (article: Article) => {
    if (!confirm(t("deleteConfirm", { name: article.title }))) return;
    startTransition(async () => {
      const res = await deleteArticle(article.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        setArticles((prev) => prev.filter((a) => a.id !== article.id));
        toast.success(t("deleted"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="pl-10" />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-3">{t("columns.title")}</th>
              <th className="px-4 py-3">{t("columns.layout")}</th>
              <th className="px-4 py-3">{t("columns.status")}</th>
              <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((article) => (
              <tr key={article.id} className="border-b border-border last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold">{article.title}</td>
                <td className="px-4 py-3 text-foreground/60">{t(`layout.${article.layout}`)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      article.is_published ? "bg-lime/15 text-lime-dark dark:text-lime" : "bg-coral/15 text-coral",
                    )}
                  >
                    {article.is_published ? t("published") : t("draft")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {article.is_published && (
                      <Link
                        href={{ pathname: "/articles/[slug]", params: { slug: article.slug } }}
                        target="_blank"
                        className="rounded-lg p-2 text-foreground/50 hover:bg-black/5 dark:hover:bg-white/5"
                        title={t("view")}
                      >
                        <Eye size={15} />
                      </Link>
                    )}
                    <Link
                      href={{ pathname: "/admin/articles/[id]", params: { id: article.id } }}
                      className="rounded-lg p-2 text-aqua-dark hover:bg-aqua/10"
                      title={t("edit")}
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => handleDelete(article)}
                      disabled={pending}
                      className="rounded-lg p-2 text-coral hover:bg-coral/10 disabled:opacity-40"
                      title={t("delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-foreground/50">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
