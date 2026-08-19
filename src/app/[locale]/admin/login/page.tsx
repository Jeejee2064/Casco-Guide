import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";
import type { Locale } from "@/i18n/routing";

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.login");

  return (
    <div className="brand-accent flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-surface p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <span className="text-3xl">🌴</span>
          <h1 className="font-heading mt-2 text-xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <LoginForm locale={locale} />
      </div>
    </div>
  );
}
