import Link from "next/link";
import { demoRooms } from "@/lib/demo-data";

export default function HomePage() {
  const settledRooms = demoRooms.filter((room) => room.status === "settled").length;

  return (
    <section className="hero">
      <h1>Fantasy football rooms settled on BOT Chain</h1>
      <p>
        Create or join single-match rooms, pick 5 players, and settle on-chain with deterministic
        scoring and automatic payouts.
      </p>

      <div className="mini-stats">
        <div className="mini-stats__item">
          <strong>{demoRooms.length}</strong>
          <span>Demo Rooms</span>
        </div>
        <div className="mini-stats__item">
          <strong>{settledRooms}</strong>
          <span>Settled</span>
        </div>
        <div className="mini-stats__item">
          <strong>5-player</strong>
          <span>Lineup Format</span>
        </div>
      </div>

      <div className="grid">
        <article className="card">
          <h3>1. Create room</h3>
          <p>Set match, entry fee, lineup deadline, and room size.</p>
          <Link className="btn primary" href="/rooms/create">
            Start a room
          </Link>
        </article>

        <article className="card">
          <h3>2. Join and pick lineup</h3>
          <p>Players join with wallet and submit 5 picks with captain.</p>
          <Link className="btn" href="/rooms">
            Browse rooms
          </Link>
        </article>

        <article className="card">
          <h3>3. Settle and pay winner</h3>
          <p>Stats are fetched and room is settled with transparent payout.</p>
          <Link className="btn" href="/rooms/room-001/results">
            Open settled demo
          </Link>
        </article>
      </div>

      <p className="footer-note">
        Demo mode: falls back to deterministic demo stats when the live football API is unavailable.
      </p>
    </section>
  );
}
