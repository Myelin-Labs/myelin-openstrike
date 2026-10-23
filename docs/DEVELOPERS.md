# Developer integration

## HTTP API

All private runtime endpoints require `X-Runtime-Token` and `X-UTXOPlay-Account`. UTXOPlay supplies these after validating its own browser session. Never trust account headers from a public client.

| Request | Body | Result |
|---|---|---|
| `GET /api/state` | — | Current room or null, slot, snapshots and verification status |
| `POST /api/action` | `{"type":"create","mode":"practice"}` | Start a bot round |
| `POST /api/action` | `{"type":"create","mode":"duel"}` | Waiting private room; share its 24-hex ID |
| `POST /api/action` | `{"type":"join","room":"…"}` | Join an available duel and start |
| `POST /api/action` | `{"type":"input","room":"…","input":{…}}` | Validated controls; WebSocket is preferred |
| `POST /api/action` | `{"type":"leave"}` | Detach from the current room; a live round continues |
| `GET /api/export` | — | Completed, verified Myelin export for a participant |

There are no deposit, withdrawal, wager or payment endpoints in the web runtime.

## WebSocket protocol

Upgrade `/api/socket` on the private runtime, or `/games/openstrike/api/socket` on UTXOPlay. The public endpoint requires the same-origin session cookie and validates `Origin`. Session revocation closes the socket. Do not put tokens or account IDs in URL query parameters.

```json
{"type":"input","room":"0123456789abcdef01234567","input":{"sequence":42,"client_tick":100,"move_x":0,"move_y":1,"yaw":0,"pitch":0,"walk":false,"jump":false,"fire":false,"reload":false}}
```

`sequence` is monotonic per player, up to u32; `client_tick` is advisory and does not control the native clock. Movement axes lie in [-1,1], yaw in [-pi,pi], pitch within approximately [-1.553,1.553]. The flat arena ignores jumping. Send complete controls at up to 64 Hz, including neutral frames when idle. Inputs older than 250 ms become neutral server-side. Messages above 2,048 bytes, binary messages and rates above 120/s are rejected.

The server emits `ready`, `state`, `error`, and `pong` messages. State includes `room.state.players`, `room.tick`, `room.appliedSeq`, events, room status and (only after sealing) `room.proof.verified`. An input is not a hit claim; only native events and snapshots determine health and winners. A `ping` with finite `time` receives the same time in a `pong`.

States: `waiting → running → sealing → finished`. `failed`, `interrupted`, `expired` and `cancelled` do not issue verified results. Keep match controls disabled after `running` ends. The current API exposes the current room export; archive downloaded exports before moving on if you need a personal match history.

## Native JSONL bridge

`myelin-arena-bridge` reads one `{"inputs":[A,B]}` line per engine tick and emits a `frame` object. Close stdin on native `Ended` or tick 5,760; it emits the final `result`. Do not submit later inputs after elimination. The service records the exact lines, then submits:

```json
{"type":"match","room":"0123456789abcdef01234567","players":["64-hex-account-id","practice-bot"],"tape":"JSONL input pairs including newlines","result":{"completed":true,"ticks":128,"last":{},"trace_hash":"…"}}
```

This is a shape example, not a valid fabricated result. Obtain the real result from the bridge. `record` rejects a forged result, an incomplete tape, an engine mismatch or an already sealed session directory.

## Verification and packaging

`node tests/native.mjs` exercises a real native round, replay equality, real Myelin record/verify, forged-result rejection and block-tamper rejection. The UTXOPlay repository additionally contains `tests/live-openstrike.mjs`, which signs disposable CKB authentication challenges, runs a two-account socket duel, tests isolation and downloads an export. It neither funds a wallet nor sends transactions.

Use the release binary pair associated with the export's profile, set `OPENSTRIKE_ASSETS` to its directory, and run `myelin-openstrike verify export.json`. The release `SHA256SUMS` detects download corruption; GitHub release provenance and your deployment's expected authority are separate trust decisions.

Web assets are bundled locally with pinned npm lockfiles, without CDN execution. Build with `npm ci --prefix web-src && npm run build --prefix web-src`; serve `web/index.html`, `web/app.js`, `web/style.css` and `web/arena.json`. If integrating outside UTXOPlay, supply an authenticated proxy and optionally omit the shared `/game-shell.js` and `/game-shell.css` references.
