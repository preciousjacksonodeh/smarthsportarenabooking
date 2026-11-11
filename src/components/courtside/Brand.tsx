import { Link } from "@tanstack/react-router";
import { CLUB } from "@/lib/club";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M5.5 5.5c3.5 3 3.5 10 0 13M18.5 5.5c-3.5 3-3.5 10 0 13" />
        </svg>
      </span>
      <span className={`font-display text-xl ${inverted ? "text-court-foreground" : "text-foreground"}`}>{CLUB.name}</span>
    </Link>
  );
}
