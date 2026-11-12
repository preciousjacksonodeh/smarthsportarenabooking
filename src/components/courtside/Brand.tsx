import { Link } from "@tanstack/react-router";
import logo from "@/assets/smart_sports_arena_logo.png.asset.json";
import { CLUB } from "@/lib/club";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <img
        src={logo.url}
        alt={`${CLUB.name} logo`}
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-full bg-card object-cover ring-2 ring-accent"
      />
      <span className={`font-display text-xl ${inverted ? "text-court-foreground" : "text-foreground"}`}>{CLUB.name}</span>
    </Link>
  );
}
