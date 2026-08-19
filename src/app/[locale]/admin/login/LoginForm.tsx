"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import type { Locale } from "@/i18n/routing";

export function LoginForm({ locale }: { locale: Locale }) {
  const t = useTranslations("admin.login");
  const [state, formAction, pending] = useActionState(signIn.bind(null, locale), {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral-dark">
          {t("error")}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : t("submit")}
      </Button>
    </form>
  );
}
