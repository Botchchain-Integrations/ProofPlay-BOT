# BOT Chain Compatibility Notes

## What changed from the original ProofPlay (Somnia Testnet)

| Area | Before | After |
|---|---|---|
| Chain | Somnia Testnet (STT) | BOT Chain Testnet (BOT/tBOT, chain 968) |
| RPC | `https://rpc.ankr.com/somnia_testnet` | `https://rpc.bohr.life` |
| Explorer | Somnia block explorer | `https://scan.bohr.life` |
| Native currency | STT (18 decimals) | BOT / tBOT (18 decimals) |
| Agent settlement | Somnia agents (JSON API + LLM) | Creator-side `onAgentResponse()` with real stats |
| Football data | Demo-only deterministic data | Live APIfootball (apifootball.com) via RapidAPI |
| Somnia platform address | Somnia testnet address | `address(0)` (no agent integration) |

## What stayed the same

- UI/UX, design system, page structure
- Fantasy scoring logic and on-chain settlement model
- On-chain contracts (FantasyMatchRoom, MatchRoomFactory, PlayerRegistry) - same Solidity code
- Entry fee model (native token, 18 decimals)
- Lineup validation rules (5 players: 1 GK, 1 DEF, 2 MID, 1 FWD, captain from lineup)
- Wallet connection via RainbowKit

## Limitations on BOT Chain

- Block explorer (`scan.bohr.life`) does not support contract verification via API; verify manually via the UI.
- No agent-based automated settlement (Somnia platform integration is disabled; `somniaPlatform` = `address(0)` at deploy). Settlement is triggered manually by the room creator calling `onAgentResponse()`.
- Server-side room index is not wired up; on-chain rooms are read client-side via wagmi.

## Football API Key (RapidAPI)

The provider uses the **APIfootball** listing on RapidAPI (`apifootball3`).

Free Basic plan: 1,000 requests/day (~100/hour). Covers the current season with lineups and per-player match statistics.

Key is stored in:
- `apps/web/.env.local` as `FOOTBALL_API_KEY` (server-side only, not exposed to the browser)
- `contracts/.env` as `FOOTBALL_API_KEY` (used by seeding scripts)

Never commit these `.env` files. They are gitignored.

## Re-seeding a different match

To seed and test with a different fixture:

1. Update `contracts/.env` or pass `FIXTURE_ID=<new-fixture-id>` to the seed script
2. Pass the same `MATCH_KEY="<fixtureId>:<homeTeam>:<awayTeam>"` to the E2E script (must match the API fixture exactly)
3. Update `demoMatches` and `demoPlayersByMatch` in `apps/web/lib/demo-data.ts` to include the new fixture's player pool so the frontend picker matches
4. Optionally update `FOOTBALL_API_KEY` if using a different account
