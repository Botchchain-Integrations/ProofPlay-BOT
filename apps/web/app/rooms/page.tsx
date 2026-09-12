import Link from "next/link";
import { OnChainRoomsList } from "@/components/OnChainRoomsList";
import { RoomCard } from "@/components/RoomCard";
import { demoRooms, getMatchLabel } from "@/lib/demo-data";

export default function RoomsPage() {
  const settledCount = demoRooms.filter((room) => room.status === "settled").length;
  const openCount = demoRooms.filter((room) => room.status === "open").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="page-head__row">
        <div>
          <span className="section-header">Dashboard</span>
          <h1 className="page-head__title">Match Rooms</h1>
          <p>Open, locked, and settled single-match fantasy contests on BOT Chain.</p>
        </div>
        <Link href="/rooms/create" className="btn primary">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" style={{ width: "0.9rem", height: "0.9rem" }}>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Room
        </Link>
      </div>

      <div className="stats-row">
        <div className="glass-card stat-card">
          <strong>{demoRooms.length}</strong>
          <span>Demo Rooms</span>
        </div>
        <div className="glass-card stat-card">
          <strong>{openCount}</strong>
          <span>Open</span>
        </div>
        <div className="glass-card stat-card">
          <strong>{settledCount}</strong>
          <span>Settled</span>
        </div>
        <div className="glass-card stat-card">
          <strong>5</strong>
          <span>Player Lineups</span>
        </div>
      </div>

      <section>
        <div style={{ marginBottom: "0.6rem" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Live On-Chain Rooms
          </h2>
          <p className="meta" style={{ marginTop: "0.25rem", fontSize: "0.8125rem" }}>
            Rooms created through the factory contract on BOT Chain.
          </p>
        </div>
        <OnChainRoomsList />
      </section>

      <section>
        <div style={{ marginBottom: "0.6rem" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Demo Rooms
          </h2>
          <p className="meta" style={{ marginTop: "0.25rem", fontSize: "0.8125rem" }}>
            Static samples that keep the UI usable before on-chain settlement.
          </p>
        </div>
        <div className="list">
          {demoRooms.map((room) => (
            <RoomCard key={room.id} room={room} matchLabel={getMatchLabel(room.matchId)} />
          ))}
        </div>
      </section>
    </div>
  );
}