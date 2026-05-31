# Proof of Play (Somnia Fantasy Football MVP)

Monorepo starter for a 4-week MVP where users join single-match fantasy football rooms, Somnia agents fetch stats, contracts settle scores, and winners are paid on-chain.

## Workspace layout

- `apps/web`: Next.js app (frontend + API routes for demo fixtures/players/stats)
- `contracts`: Solidity + Hardhat contracts and tests
- `packages/shared`: shared TypeScript types and scoring constants
- `supabase`: SQL schema for off-chain cache/index data
- `docs`: architecture and implementation notes

## Quick start

```bash
pnpm install
pnpm dev
```

## Core routes (web)

- `/`: Landing page
- `/rooms`: List rooms
- `/rooms/create`: Create room
- `/rooms/[id]`: Join room, submit lineup, view status
- `/rooms/[id]/results`: Final scores, receipt, payout status

## Contract targets

- `MatchRoomFactory.sol`
- `FantasyMatchRoom.sol`
- `PlayerRegistry.sol`

## Notes

- This scaffold uses deterministic demo data via API routes so settlement is demo-safe.
- Replace demo stats endpoint with a live football API later without changing the on-chain room lifecycle.

## Demo runbook

- Local Anvil end-to-end flow: `docs/e2e-local-demo-runbook.md`
