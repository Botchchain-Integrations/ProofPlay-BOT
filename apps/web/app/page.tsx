import Link from "next/link";
import { FixtureCard } from "@/components/FixtureCard";
import { listFootballMatches } from "@/lib/server/services/matches.service";
import { demoMatches } from "@/lib/demo-data";

async function getFeaturedFixtures() {
  try {
    const live = await listFootballMatches();
    if (live.length > 0) {
      return live.slice(0, 4).map((match) => ({
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        kickoffTime: match.kickoffTime,
        status: match.status,
        homeScore: undefined,
        awayScore: undefined
      }));
    }
  } catch {
    // fall back to demo fixtures when the live provider is unavailable
  }

  return demoMatches.slice(0, 4).map((match) => ({
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoffTime: match.kickoffTime,
    status: match.status
  }));
}

const STEPS = [
  {
    num: "01",
    title: "Pick a Match",
    desc: "Choose any fixture from the live football data feed with its verified pick pool.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 10l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    num: "02",
    title: "Create or Join a Room",
    desc: "Set the entry fee, deadline, and room size. Friends join and submit 5-player lineups with a captain.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 8h8M6 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    num: "03",
    title: "Verified Settlement",
    desc: "Real match stats score each lineup on-chain. The winner claims the pool with an auditable receipt.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2l2.5 5.5L18 8.5l-4 4 1 5.5L10 15l-5 3 1-5.5-4-4 5.5-1L10 2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
];

export default async function HomePage() {
  const fixtures = await getFeaturedFixtures();
  const heroFixture = fixtures[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3.5rem", paddingBottom: "3rem" }}>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="section-header">BOT Chain Fantasy</span>
          <h1>
            Fantasy football rooms that settle with{" "}
            <span className="text-gradient">verifiable sports data</span>
          </h1>
          <p>
            Create or join single-match rooms, pick 5 players with a captain, and settle on-chain.
            Real football stats drive the scores. No admin override. No guessing.
          </p>
          <div className="hero-actions">
            <Link href="/rooms" className="btn primary">
              Explore Rooms
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/rooms/create" className="btn">
              Create a Room
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          {heroFixture ? (
            <FixtureCard {...heroFixture} variant="hero" />
          ) : (
            <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
              <p style={{ color: "var(--zinc-500)", fontSize: "0.875rem" }}>No matches right now</p>
              <Link href="/rooms" className="arrow-link" style={{ marginTop: "0.5rem", display: "inline-flex" }}>
                Browse rooms →
              </Link>
            </div>
          )}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>How it works</h2>
        </div>
        <div className="steps-grid">
          {STEPS.map((item) => (
            <div className="glass-card step-card" key={item.num}>
              <div className="step-card-icon">{item.icon}</div>
              <div>
                <div className="section-header step-num" style={{ textAlign: "center" }}>
                  {item.num}
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: "1rem" }}>
          <span className="section-header">Featured</span>
          <h2 style={{ margin: "0.25rem 0 0 0", fontSize: "1.25rem", fontWeight: 700 }}>Matches</h2>
        </div>
        {fixtures.length > 0 ? (
          <div className="list">{fixtures.map((fixture) => <FixtureCard key={fixture.id} {...fixture} />)}</div>
        ) : (
          <div className="empty-state">
            <div>
              <p style={{ margin: 0, color: "var(--zinc-500)", fontSize: "0.875rem" }}>No matches loaded</p>
              <Link href="/rooms/create" className="arrow-link" style={{ marginTop: "0.6rem", display: "inline-flex" }}>
                Create a room →
              </Link>
            </div>
          </div>
        )}
      </section>

      <p className="footer-note">
        Demo fallback loads deterministic fixtures when the live football API is unavailable.
      </p>
    </div>
  );
}