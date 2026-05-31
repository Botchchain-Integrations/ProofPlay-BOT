import { OnChainRoomsList } from "@/components/OnChainRoomsList";
import { RoomCard } from "@/components/RoomCard";
import { demoRooms, getMatchLabel } from "@/lib/demo-data";

export default function RoomsPage() {
  return (
    <section>
      <h1 className="section-title">Match Rooms</h1>
      <p className="meta">Open, locked, and settled single-match fantasy contests.</p>

      <h2 className="section-title" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
        Live On-Chain Rooms
      </h2>
      <OnChainRoomsList />

      <h2 className="section-title" style={{ marginTop: "1.1rem", marginBottom: "0.5rem" }}>
        Demo Rooms
      </h2>
      <p className="meta">These are static samples to keep the UI usable before on-chain settlement.</p>
      <div className="list" style={{ marginTop: "0.75rem" }}>
        {demoRooms.map((room) => (
          <RoomCard key={room.id} room={room} matchLabel={getMatchLabel(room.matchId)} />
        ))}
      </div>
    </section>
  );
}
