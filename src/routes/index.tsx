import { useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import Header from "@/components/pulse/Header";
import Hero from "@/components/pulse/Hero";
import EventInfo from "@/components/pulse/EventInfo";
import Programme from "@/components/pulse/Programme";
import RegisterSection from "@/components/pulse/RegisterSection";
import Faq from "@/components/pulse/Faq";
import Footer, { FinalCta } from "@/components/pulse/Footer";
import MobileCta from "@/components/pulse/MobileCta";
import { useReveal, useScrollProgress } from "@/components/pulse/reveal";
import { eventQueryOptions } from "@/lib/event.queries";
import { CURRENT_EVENT_SLUG } from "@/lib/registration";

const TITLE = "PULSE FIT DAY — Inscription gratuite · PULSE Libreville";
const DESCRIPTION =
  "Réservez gratuitement votre place au PULSE FIT DAY à Libreville : entraînement géant, coachs, QR code d’entrée et attestation de participation.";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(eventQueryOptions(CURRENT_EVENT_SLUG)),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: event } = useSuspenseQuery(eventQueryOptions(CURRENT_EVENT_SLUG));
  const bar = useRef<HTMLDivElement>(null);
  useReveal();
  useScrollProgress(bar);

  if (!event) {
    return (
      <>
        <Header simple />
        <main className="page-state">
          <div className="eyebrow green">ÉVÉNEMENT</div>
          <h1>BIENTÔT DE RETOUR.</h1>
          <p>Aucun événement n’est ouvert aux inscriptions pour le moment.</p>
        </main>
      </>
    );
  }

  const full = event.capacity != null && event.registeredCount >= event.capacity;
  const spotsLeft = event.capacity != null ? Math.max(0, event.capacity - event.registeredCount) : null;
  return (
    <>
      <div className="scroll-progress" ref={bar} aria-hidden="true" />
      <Header />
      <main>
        <Hero event={event} />
        <EventInfo event={event} />
        <Programme />
        <RegisterSection event={event} />
        <Faq />
        <FinalCta full={full} />
      </main>
      <Footer />
      {!full && <MobileCta spotsLeft={event.registeredCount >= 20 ? spotsLeft : null} />}
    </>
  );
}
