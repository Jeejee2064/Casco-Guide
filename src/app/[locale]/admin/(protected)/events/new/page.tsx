import { notFound } from "next/navigation";

// Events feature temporarily hidden site-wide — disabled rather than
// deleted. See admin/(protected)/events/page.tsx for details.
export default function NewEventPage() {
  notFound();
}

// import { getTranslations } from "next-intl/server";
// import { EventForm } from "@/components/admin/EventForm";
//
// export default async function NewEventPage() {
//   const t = await getTranslations("admin.eventForm");
//   return (
//     <div className="max-w-3xl space-y-6">
//       <h1 className="font-heading text-2xl font-extrabold">{t("titleNew")}</h1>
//       <EventForm />
//     </div>
//   );
// }
