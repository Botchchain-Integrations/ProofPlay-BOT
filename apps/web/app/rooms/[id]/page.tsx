import Link from "next/link";
import type { Player, Room } from "@proofplay/shared";
import { isAddress } from "viem";
import { LineupCard } from "@/components/LineupCard";
import { OnChainRoomStatus } from "@/components/OnChainRoomStatus";
import { PlayerPicker } from "@/components/PlayerPicker";
import { RoomActions } from "@/components/RoomActions";
import {
  demoMatches,
  getLineupsForRoom,
  getMatchLabel,
  getPlayersForMatch,
  getRoomById
} from "@/lib/demo-data";
import { readOnChainPlayers } from "@/lib/server/services/registry-read.service";

type RoomPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomDetailsPage({ params }: RoomPageProps) {
  const { id } = await params;
  const routeIsAddress = isAddress(id);
  const room = getRoomById(id);
  const onChainPool = routeIsAddress
    ? await readOnChainPlayers(id).catch(() => ({ matchId: null as `0x${string}` | null, players: null as Player[] | null }))
    : { matchId: null as `0x${string}` | null, players: null as Player[] | null };

  if (!room && !routeIsAddress) {
    return (
      <div style={{ maxWidth: "36rem" }}>
        <div className="glass-card">
          <h1 className="page-title">Room not found</h1>
          <p className="meta" style={{ marginTop: "0.5rem" }}>
            No room exists for id: <span className="mono">{id}</span>
          </p>
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <Link href="/rooms" className="btn">
              Back to rooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const resolvedRoom: Room =
    room ??
    ({
      id,
      matchId: demoMatches[0]?.id ?? "unknown-match",
      entryFee: "5",
      maxParticipants: 10,
      deadline: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      status: "open"
    } as const);

  const players =
    onChainPool.players ??
    getPlayersForMatch(resolvedRoom.matchId);
  const lineups = room ? getLineupsForRoom(room.id) : [];
  const previewLineup = lineups[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="page-head">
        <span className="section-header">Match Room</span>
        <h1 className="page-title" style={{ marginTop: "0.25rem" }}>
          {room ? getMatchLabel(room.matchId) : "On-Chain Fantasy Room"}
        </h1>
        <p style={{ marginTop: "0.4rem" }}>
          Room ID: <span className="mono">{resolvedRoom.id}</span>
        </p>
        {!room && routeIsAddress ? (
          <p className="meta" style={{ marginTop: "0.35rem" }}>
            This page is using a room contract address route and on-chain actions.
            {onChainPool.players && onChainPool.players.length > 0 ? (
              <span className="mono" style={{ display: "block", marginTop: "0.3rem" }}>
                Seeded pool: {onChainPool.players.length} players on-chain.
              </span>
            ) : onChainPool.players === null && routeIsAddress ? (
              <span className="mono" style={{ display: "block", marginTop: "0.3rem" }}>
                Could not read the on-chain player pool.
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="grid">
        {routeIsAddress ? (
          <OnChainRoomStatus roomAddress={id} />
        ) : (
          <div className="glass-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Room Status
              </h2>
              <span className={`pill ${resolvedRoom.status}`}>{resolvedRoom.status.toUpperCase()}</span>
            </div>
            <dl className="kv-grid">
              <div className="kv-item">
                <dt>Entry Fee</dt>
                <dd>{resolvedRoom.entryFee} BOT</dd>
              </div>
              <div className="kv-item">
                <dt>Max Participants</dt>
                <dd>{resolvedRoom.maxParticipants}</dd>
              </div>
              <div className="kv-item">
                <dt>Lineup Deadline</dt>
                <dd className="mono">{new Date(resolvedRoom.deadline).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</dd>
              </div>
            </dl>
          </div>
        )}

        <RoomActions
          entryFee={resolvedRoom.entryFee}
          players={players}
          initialRoomAddress={routeIsAddress ? id : undefined}
        />
      </div>

      <PlayerPicker
        players={players}
        selectedIds={previewLineup?.playerIds ?? []}
        captainId={previewLineup?.captainId}
      />

      {previewLineup ? <LineupCard lineup={previewLineup} players={players} /> : null}

      <div className="btn-row">
        <Link className="btn ghost" href={`/rooms/${resolvedRoom.id}/results`}>
          View Results Page
        </Link>
        <Link className="btn" href={`/rooms/${resolvedRoom.id}/settle`}>
          Creator Settle Helper
        </Link>
      </div>
    </div>
  );
}