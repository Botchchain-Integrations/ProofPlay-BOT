# Proof of Play Local E2E Demo Runbook (Anvil)

This runbook covers the full flow:

1. Deploy contracts to Anvil
2. Seed demo players in `PlayerRegistry`
3. Create/join/submit lineup in UI
4. Mock settle room (`onAgentResponse`)
5. Claim prize and view on-chain results

## 1) Start local chain

```bash
anvil
```

Keep this terminal running.

## 2) Deploy contracts to localhost

```bash
pnpm --filter @proofplay/contracts deploy:localhost
```

Copy the two addresses printed by deploy script:

- `PlayerRegistry`
- `MatchRoomFactory`

## 3) Seed demo players for the UI match key

```bash
REGISTRY_ADDRESS=<PLAYER_REGISTRY_ADDRESS> pnpm --filter @proofplay/contracts seed:local
```

This seeds players for match key:

- `ars-che-2026-05-24:Arsenal:Chelsea`

That matches the current Create Room UI hashing logic.

## 4) Configure web app env

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SOMNIA_CHAIN_ID=31337
NEXT_PUBLIC_SOMNIA_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_FACTORY_ADDRESS=<MATCH_ROOM_FACTORY_ADDRESS>
NEXT_PUBLIC_REGISTRY_ADDRESS=<PLAYER_REGISTRY_ADDRESS>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=proofplay-dev-project-id
```

## 5) Start frontend

```bash
pnpm --filter @proofplay/web dev
```

Open [http://localhost:3000](http://localhost:3000).

## 6) Run room lifecycle from UI

1. Connect wallet (Anvil account in your wallet).
2. Go to `/rooms/create` and create a room for Arsenal vs Chelsea.
3. Open the created room from the transaction section or `/rooms`.
4. Join room from at least two wallets.
5. Submit valid 5-player lineups.
6. Click `Lock Room`.
7. Click `Request Settlement`.

## 7) Execute mock agent callback settlement

Open the helper page:

- `/rooms/<ROOM_ADDRESS>/settle`

Run the command shown there, or directly:

```bash
ROOM_ADDRESS=<ROOM_ADDRESS> pnpm --filter @proofplay/contracts settle:local
```

The script will:

- lock room if needed
- call `requestSettlement()`
- build deterministic mock stats from submitted lineups
- call `onAgentResponse(...)` as room creator
- print winner and participant scores

## 8) Finalize demo

1. Open `/rooms/<ROOM_ADDRESS>/results` and confirm winner + receipt.
2. From room actions, click `Claim Prize` with winner wallet.
3. Refresh results and confirm payout status state.

## Troubleshooting

- `Invalid player`: reseed with correct `REGISTRY_ADDRESS`, ensure using Arsenal vs Chelsea default match in create form.
- `Only creator`: settlement script must run with same creator account that created room.
- `Room not locked`: use `Lock Room` first or let settlement script lock it.
- Empty on-chain list: confirm `NEXT_PUBLIC_FACTORY_ADDRESS` points to deployed localhost factory.
