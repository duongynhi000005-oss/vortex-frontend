import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Markdown } from "@/components/Markdown";
import { loadCallNotes } from "@/lib/callNotes.server";
import { getTranslation } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Community Call Notes",
  description: "Archive of community and governance call notes, with decisions and recordings.",
  alternates: { canonical: "/governance/calls" },
};

export default function CommunityCallsPage() {
  const { t } = getTranslation();
  const notes = loadCallNotes();

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("calls.title")} />
      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-bold text-vx-text mb-3">{t("calls.title")}</h1>
        <p className="text-vx-muted text-sm mb-8">{t("calls.description")}</p>

        {notes.length === 0 ? (
          <p className="card p-6 text-sm text-vx-muted">{t("calls.empty")}</p>
        ) : (
          <ol className="space-y-6" aria-label={t("calls.title")}>
            {notes.map((note) => (
              <li key={note.slug}>
                <article className="card p-5" aria-labelledby={`call-${note.slug}`}>
                  <h2 id={`call-${note.slug}`} className="text-base font-semibold text-vx-text">
                    <time dateTime={note.date}>{note.date}</time>
                  </h2>
                  {note.summary && <p className="mt-1 text-sm text-vx-muted">{note.summary}</p>}
                  {note.recordingUrl && (
                    <a
                      href={note.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-vx-sage underline focus-visible:outline focus-visible:outline-2"
                    >
                      {t("calls.recording")}
                    </a>
                  )}
                  {note.decisions.length > 0 && (
                    <section className="mt-3" aria-label={t("calls.decisions")}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-vx-dim">{t("calls.decisions")}</h3>
                      <ul className="mt-1 list-disc pl-5 text-sm text-vx-text">
                        {note.decisions.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {note.body && (
                    <div className="mt-3 text-sm text-vx-text">
                      <Markdown source={note.body} />
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}
      </main>
      <Footer />
    </div>
  );
}
