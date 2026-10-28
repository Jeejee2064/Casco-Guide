import { JsonLd } from "./JsonLd";

export interface InfoSection {
  title: string;
  body: string;
}

/** Shared body of the simple text pages (About, Contact): H1, lead
 * paragraph, titled sections, and an optional slot for a call to action. */
export function InfoPage({
  title,
  lead,
  sections,
  jsonLd,
  children,
}: {
  title: string;
  lead: string;
  sections: InfoSection[];
  jsonLd: object[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
      {jsonLd.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      <h1 className="font-heading text-3xl font-extrabold sm:text-5xl">{title}</h1>
      <p
        className="mt-6 text-xl leading-relaxed text-foreground/80 sm:text-2xl sm:leading-relaxed"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {lead}
      </p>
      {children}
      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-xl font-bold">{section.title}</h2>
            <p className="mt-2 leading-relaxed text-foreground/70">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
