"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Mail, MessageCircle, Send, Share2, X as XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type ShareChannel = "native" | "whatsapp" | "facebook" | "twitter" | "telegram" | "email" | "copy_link";

/** Share sheet: native share on mobile when available, plus direct links for
 * WhatsApp, Facebook, X and Telegram, email, and copy-link — all of which
 * work without any app installed since they open each network's own share
 * URL in a new tab/window. `variant`/`size`/`showLabel` let a caller promote
 * the trigger from its default small icon button to a full, labelled CTA.
 * `entity`, when given, tags every share action with what was being shared
 * (`share_click` — see track.ts) so the admin's per-spot interaction table
 * can attribute shares back to a specific spot/event/article, not just a
 * site-wide total. Omit it for callers that don't need that attribution
 * (there currently are none, but the prop stays optional rather than
 * required so a future caller isn't forced to invent one). */
export function ShareMenu({
  title,
  text,
  url,
  align = "right",
  direction = "down",
  variant = "outline",
  size = "icon",
  showLabel = false,
  className,
  entity,
}: {
  title: string;
  text?: string;
  url?: string;
  align?: "left" | "right";
  direction?: "up" | "down";
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  showLabel?: boolean;
  className?: string;
  entity?: { type: "spot" | "event" | "article"; id: string; slug: string };
}) {
  const t = useTranslations("share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Lazy init: only read on the client, and gated behind `open` (always false
  // on first paint) so a server/client mismatch here never reaches the DOM.
  const [canNativeShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const shareText = text ?? title;

  const links = [
    {
      key: "whatsapp",
      label: t("whatsapp"),
      icon: MessageCircle,
      iconClass: "bg-[#25D366] text-white",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      key: "facebook",
      label: t("facebook"),
      icon: null,
      iconClass: "bg-[#1877F2] text-white",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      key: "twitter",
      label: t("twitter"),
      icon: XIcon,
      iconClass: "bg-black text-white dark:bg-white dark:text-black",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      key: "telegram",
      label: t("telegram"),
      icon: Send,
      iconClass: "bg-[#26A5E4] text-white",
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      key: "email",
      label: t("email"),
      icon: Mail,
      iconClass: "bg-foreground/10 text-foreground",
      href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`,
    },
  ] as const;

  const trackShare = (channel: ShareChannel) => {
    if (!entity) return;
    track("share_click", {
      entity: entity.type,
      entity_id: entity.id,
      entity_slug: entity.slug,
      channel,
    });
  };

  const openLink = (href: string, channel: ShareChannel) => {
    trackShare(channel);
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=640");
    setOpen(false);
  };

  const copyLink = async () => {
    trackShare("copy_link");
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t("linkCopied"));
    window.setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url: shareUrl });
      // Only counted on a resolved share — a dismissed native sheet throws
      // and is caught below, so it never reaches this line.
      trackShare("native");
    } catch {
      // user dismissed the native sheet — nothing to do
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={showLabel ? "w-full" : undefined}
        onClick={() => setOpen((current) => !current)}
        aria-label={t("cta")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 size={16} />
        {showLabel && t("cta")}
      </Button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-[70] w-56 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl",
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {canNativeShare && (
            <button
              type="button"
              role="menuitem"
              onClick={nativeShare}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                <Share2 size={15} />
              </span>
              {t("more")}
            </button>
          )}
          {links.map(({ key, label, icon: Icon, iconClass, href }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => openLink(href, key)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none",
                  iconClass,
                )}
              >
                {Icon ? <Icon size={15} /> : "f"}
              </span>
              {label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
              {copied ? <Check size={15} /> : <Link2 size={15} />}
            </span>
            {t("copyLink")}
          </button>
        </div>
      )}
    </div>
  );
}
