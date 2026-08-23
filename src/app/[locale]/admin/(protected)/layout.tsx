import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Sidebar } from "@/components/admin/Sidebar";
import { isSupabaseConfigured } from "@/lib/data/spots";
import { AdminAnalyticsOptOut } from "@/components/admin/AdminAnalyticsOptOut";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect({ href: "/admin/login", locale });
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminAnalyticsOptOut />
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-6 sm:p-8">{children}</main>
    </div>
  );
}
