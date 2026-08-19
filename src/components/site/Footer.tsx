import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("site");
  return (
    <footer className="safe-bottom mt-auto border-t border-border py-8 text-center text-sm text-foreground/50">
      {t("footerTagline")}
    </footer>
  );
}
