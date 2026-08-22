"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { EASE_OUT, TAP_SPRING } from "./motion";

const DISMISSED_KEY = "casco-pwa-install-dismissed-at";
const INSTALLED_KEY = "casco-pwa-installed";
// Re-offer the prompt after a dismissal instead of never asking again.
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
// Let the page settle before interrupting with a popup.
const SHOW_DELAY_MS = 2500;

// `beforeinstallprompt` (Chromium) isn't in the DOM lib types yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Variant = "ios" | "installable";

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag — `display-mode: standalone` isn't reliable there.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  try {
    const at = window.localStorage.getItem(DISMISSED_KEY);
    return !!at && Date.now() - Number(at) < DISMISS_COOLDOWN_MS;
  } catch {
    // Private browsing / storage disabled — treat as "not dismissed" rather
    // than silently never showing the prompt.
    return false;
  }
}

/**
 * Mobile-only "install this as an app" popup, shown once on the home page.
 * Android/Chromium browsers get a real one-tap install via
 * `beforeinstallprompt`; iOS Safari never fires that event (no install API
 * at all), so it gets step-by-step "Add to Home Screen" instructions
 * instead. Silent everywhere else — desktop, already installed, or
 * dismissed within the last two weeks — so it never blocks first paint or
 * nags on every visit.
 */
export function InstallPwaPrompt() {
  const t = useTranslations("installPwa");
  const [variant, setVariant] = useState<Variant | null>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let installedFlag: string | null = null;
    try {
      installedFlag = window.localStorage.getItem(INSTALLED_KEY);
    } catch {
      // Ignore — falls through to showing the prompt.
    }
    if (isStandalone() || recentlyDismissed() || installedFlag) return;

    const ua = window.navigator.userAgent;
    // iPadOS 13+ masquerades as a Mac in the UA string but keeps touch —
    // catch that too, since it's just as unable to fire beforeinstallprompt.
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    if (!isIOS && !isAndroid) return;

    if (isIOS) {
      // No native install signal to wait for — just surface the instructions.
      const timer = setTimeout(() => setVariant("ios"), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setVariant("installable");
    };
    const onInstalled = () => {
      try {
        window.localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        // Nothing to do — worst case it's offered again next visit.
      }
      setVariant(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Storage unavailable — it'll just be offered again next visit.
    }
    setVariant(null);
  };

  const install = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    deferredPromptRef.current = null;
    try {
      window.localStorage.setItem(
        choice.outcome === "accepted" ? INSTALLED_KEY : DISMISSED_KEY,
        choice.outcome === "accepted" ? "1" : String(Date.now()),
      );
    } catch {
      // Ignore — the in-memory state below still closes the popup either way.
    }
    setVariant(null);
  };

  return (
    <AnimatePresence>
      {variant && (
        <motion.div
          key="pwa-install-prompt"
          role="dialog"
          aria-modal="true"
          aria-label={t("title")}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          // Sits below the map's detail panel/sheet (z-[1240]/z-[1250]) so the
          // two never visually fight for the same strip of screen; hidden
          // past `md` as a belt-and-braces guard alongside the UA check
          // above (e.g. a wide-landscape iPad).
          className="glass safe-bottom fixed inset-x-0 bottom-0 z-[1200] flex flex-col gap-3 rounded-t-[var(--radius-card)] border-t border-border p-4 shadow-2xl md:hidden"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-aqua/15 text-aqua">
              <Download size={20} />
            </div>
            <div className="flex-1">
              <p className="font-heading text-sm font-extrabold leading-tight">{t("title")}</p>
              <p className="mt-0.5 text-sm text-foreground/60">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("notNow")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5"
            >
              <X size={16} />
            </button>
          </div>

          {variant === "ios" && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-button)] bg-foreground/5 p-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Share size={15} className="shrink-0 text-aqua" />
                {t("iosStep1")}
              </span>
              <span className="flex items-center gap-2">
                <SquarePlus size={15} className="shrink-0 text-aqua" />
                {t("iosStep2")}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            {variant === "installable" && (
              <motion.button
                type="button"
                onClick={install}
                whileTap={{ scale: 0.97 }}
                transition={TAP_SPRING}
                className="flex-1 rounded-[var(--radius-button)] border border-transparent bg-aqua px-3 py-2.5 text-sm font-bold text-white hover:bg-aqua-dark"
              >
                {t("install")}
              </motion.button>
            )}
            <motion.button
              type="button"
              onClick={dismiss}
              whileTap={{ scale: 0.97 }}
              transition={TAP_SPRING}
              className={
                variant === "installable"
                  ? "rounded-[var(--radius-button)] border border-border px-3 py-2.5 text-sm font-bold hover:bg-foreground/5"
                  : "flex-1 rounded-[var(--radius-button)] border border-transparent bg-aqua px-3 py-2.5 text-sm font-bold text-white hover:bg-aqua-dark"
              }
            >
              {variant === "installable" ? t("notNow") : t("gotIt")}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
