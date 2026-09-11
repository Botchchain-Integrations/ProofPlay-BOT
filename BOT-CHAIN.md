# BOT Chain Testnet (ProofPlay Deployment)

Chain: **BOT Chain Testnet**, chain ID **968**.

- RPC: `https://rpc.bohr.life`
- Block Explorer: `https://scan.bohr.life` (manual UI verification; no API verification available)

## Deployed Contracts

| Contract | Address |
|---|---|
| PlayerRegistry | `0xE554b684AC83486A1d6f8020D9b92a5181DcdD64` |
| MatchRoomFactory | `0xf6920D45d16c5FAa9eB40753Bb3F16D353355705` |

Both owned by the deployer: `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84`.

## Environment Setup

**apps/web/.env.local** (gitignored):
```
NEXT_PUBLIC_BOT_CHAIN_ID=968
NEXT_PUBLIC_BOT_RPC_URL=https://rpc.bohr.life
NEXT_PUBLIC_BOT_EXPLORER_URL=https://scan.bohr.life
NEXT_PUBLIC_FACTORY_ADDRESS=0xf6920D45d16c5FAa9eB40753Bb3F16D353355705
NEXT_PUBLIC_REGISTRY_ADDRESS=0xE554b684AC83486A1d6f8020D9b92a5181DcdD64
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=proofplay-dev-project-id
FOOTBALL_API_KEY=<your-rapidapi-key-for-apifootball>
```

**contracts/.env** (gitignored):
```
BOT_CHAIN_ID=968
BOT_RPC_URL=https://rpc.bohr.life
DEPLOYER_PRIVATE_KEY=<0x...>
FOOTBALL_API_KEY=<same-key-as-web>
REGISTRY_ADDRESS=0xE554b684AC83486A1d6f8020D9b92a5181DcdD64
FACTORY_ADDRESS=0xf6920D45d16c5FAa9eB40753Bb3F16D353355705
```

## Football Data Provider

APIfootball (`apifootball.com`) via RapidAPI, covered under the Free Basic plan (1,000 req/day).

- Provider: `apps/web/lib/server/football-api/api-football.ts`
- Default competitions: Premier League (league 152), La Liga (league 302)
- Pool = both starting XIs in lineup order; on-chain player ids are 1-based indexes into that pool
- Real match stats used for settlement and scoring

## E2E Scripts

All from `contracts/`:
```bash
# 1. Seed PlayerRegistry with the real fixture 812679 (Arsenal vs Chelsea, 2026-09-06, FT 2-1)
pnpm --filter @proofplay/contracts exec hardhat run scripts/seed-demo-players.ts --network botTestnet

# 2. Create room, join, submit lineup, lock, request settlement
pnpm --filter @proofplay/contracts exec hardhat run scripts/e2e-proofplay.ts --network botTestnet

# 3. Settle with real APIfootball stats
ROOM_ADDRESS=<roomAddress> FIXTURE_ID=812679 \
  pnpm --filter @proofplay/contracts exec hardhat run scripts/mock-settle-room.ts --network botTestnet

# 4. Claim prize as winner
ROOM_ADDRESS=<roomAddress> \
  pnpm --filter @proofplay/contracts exec hardhat run scripts/claim-prize.ts --network botTestnet
```

## Scoring Rules (unchanged)

| Action | Points |
|---|---|
| Goal | +5 |
| Assist | +3 |
| Clean sheet (GK/DEF only) | +4 |
| Yellow card | -1 |
| Red card | -3 |
| 60+ minutes played | +1 |
| Captain | x2 multiplier |

Native entry fee in BOT (18 decimals). Clean sheet requires 0 goals conceded by the player's team.

## tBOT Faucet

The deployer wallet holds ~23 tBOT from previous deployments. If refilled funds are needed, check available faucets for BOT Chain Testnet (chain 968) or contact the Botchain team.
