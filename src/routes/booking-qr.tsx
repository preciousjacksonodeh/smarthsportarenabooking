import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";

import logo from "@/assets/smart_sports_arena_logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { CLUB, OPENING_HOURS, SPORT_LABEL, SPORTS } from "@/lib/club";

export const Route = createFileRoute("/booking-qr")({
  head: () => ({
    meta: [
      { title: "Smarth Sport Arena Booking — scan to book" },
      {
        name: "description",
        content: "Printable QR code for Smarth Sport Arena Booking. Players scan it to open the booking page and get their court pass.",
      },
      { property: "og:title", content: "Smarth Sport Arena Booking — scan to book" },
      { property: "og:description", content: "Scan the QR code to book basketball or football at Smarth Sport Arena." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingQrPage,
});

function BookingQrPage() {
  const [url, setUrl] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/`);
  }, []);

  function download() {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "smarth-sport-arena-booking-qr.png";
    a.click();
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 print:p-0">
      <div className="mx-auto mb-6 flex max-w-xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">
          ← Back to booking
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={download} disabled={!url}>
            <Download /> Download QR
          </Button>
          <Button variant="court" onClick={() => window.print()} disabled={!url}>
            <Printer /> Print poster
          </Button>
        </div>
      </div>

      <article className="court-surface mx-auto flex max-w-xl flex-col items-center rounded-3xl px-8 py-10 text-center shadow-ticket print:max-w-none print:rounded-none print:shadow-none">
        <img
          src={logo.url}
          alt={`${CLUB.name} logo`}
          width={96}
          height={96}
          className="size-24 rounded-full bg-card object-cover ring-4 ring-accent"
        />
        <h1 className="font-display mt-5 text-4xl sm:text-5xl">{CLUB.bookingTitle}</h1>
        <p className="mt-3 text-lg text-court-foreground/80">Scan to book your spot on court</p>

        <div ref={wrap} className="mt-8 rounded-2xl bg-card p-5 text-foreground">
          {url ? (
            <QRCodeCanvas value={url} size={280} level="H" marginSize={1} title={CLUB.bookingTitle} />
          ) : (
            <div className="size-[280px]" />
          )}
        </div>

        <p className="mt-6 font-mono text-sm text-court-foreground/80 break-all">{url}</p>
        <p className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold">
          {SPORTS.map((sp) => (
            <span key={sp}>{SPORT_LABEL[sp]}</span>
          ))}
          <span>Monday – Sunday</span>
          <span>{OPENING_HOURS}</span>
        </p>
      </article>
    </div>
  );
}
