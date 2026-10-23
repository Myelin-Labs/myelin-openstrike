# Myelin OpenStrike

A free, browser-playable port of [RetricSu's OpenStrike Fiber Arena](https://github.com/RetricSu/openstrike-fiber-arena), published by Myelin Labs for [UTXOPlay](https://store.utxoplay.io/play/openstrike).

**Play:** practice against a bot or create a private 1v1 room. WASD moves, mouse aims, left click fires, Shift walks, R reloads, and Escape opens the menu. First elimination wins; an uneventful round ends after 90 seconds. The original procedural arena is flat and has no jumping. Desktop keyboard and mouse are recommended; touch controls are included.

The browser uses a new Three.js renderer. Gameplay runs in the original Rust `OpenStrikeDuelSim`, with its actual movement, collision, hit detection, health, weapon cooldowns and ammunition. We do **not** use the upstream network-test `HarnessSim` for this port. No Valve maps, textures, models, or Counter-Strike binaries are included.

## What Myelin verifies

Every 64 Hz tick records the two effective native inputs, including bot decisions and neutral controls on timeout. At round end, a pinned native engine replays the entire input tape. A real Myelin session admits one complete-match frame only if the resulting state and trace agree with the live engine. The downloadable export contains the input tape, result, application profile and signed PoA block. The standalone verifier validates the block and executes the native replay again.

This is **host-native replay verification**, not a CKB-VM game execution proof, decentralized matchmaking, anti-cheat certification or trustless payment settlement. The server supplies the input ordering and player labels; a replay alone does not prove that those inputs originated from the named wallet. See [architecture and trust boundaries](docs/ARCHITECTURE.md).

## Build

Requirements: Rust 1.97.1+, a C/C++ toolchain, Clang/libclang, CMake, pkg-config, protobuf compiler, Node.js 22+, Linux x86-64 for the packaged runtime.

```sh
# Only these two submodules are needed; do not recursively clone the PSP toolchain.
git submodule update --init vendor/open-strike
git -C vendor/open-strike submodule update --init vendor/pocketjs
./scripts/build-myelin.sh
node tests/native.mjs
```

`release/myelin-arena-bridge` must be built **before** the Myelin adapter. Its exact bytes are embedded in the application profile. Never strip or replace the bridge after compiling the adapter. Keep the binary pair for the matches it verifies. Rebuilding with another compiler may produce a different profile even from the same source.

For a portable Debian Bookworm binary pair, build in `deploy/Builder.Dockerfile` (Docker or Podman). The runtime image uses `deploy/Dockerfile`. Compile outside the production host when possible.

## Run and integrate

```sh
export RUNTIME_TOKEN="$(openssl rand -hex 32)"
export OPENSTRIKE_ASSETS="$PWD/release"
export DATA_DIR="$PWD/service/data"
PORT=8784 node service/server.mjs
```

The runtime is private. UTXOPlay authenticates a CKB wallet or guest session and supplies `X-Runtime-Token` plus `X-UTXOPlay-Account` to HTTP and WebSocket requests. Never expose the token in browser code. Serve `web/` at `/games/openstrike/`, proxy `/games/openstrike/api/*` to the runtime, and authenticate the WebSocket upgrade against the same revocable session cookie. The existing UTXOPlay shared game shell provides immersive/fullscreen controls.

The public version is **free play**. CKB wallet login uses the store's existing authentication; the game never requests a payment. The upstream Fiber hold-invoice implementation remains in the native developer path as an optional **testnet** experiment. It is not wired into this web release. See the [upstream instructions](docs/UPSTREAM-README.md) and [migration assessment](docs/ARCHITECTURE.md#fiber-testnet-extension).

## Developer tools

```sh
# Re-run a raw tape without rendering or a server.
release/myelin-arena-bridge replay path/to/tape.jsonl
# Validate a downloaded Myelin export with the matching release binary pair.
OPENSTRIKE_ASSETS="$PWD/release" release/myelin-openstrike verify match-export.json
# Record and verify a complete native match in a new private session directory.
OPENSTRIKE_ASSETS="$PWD/release" release/myelin-openstrike record ./private-session match.json
```

[Protocol and integration guide](docs/DEVELOPERS.md) · [Architecture](docs/ARCHITECTURE.md) · [Attribution](NOTICE.md)
