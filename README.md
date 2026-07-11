# MatchMesh

MatchMesh is a serverless peer-to-peer football watch room for the Tether Developers Cup Pears track.

Fans can open a desktop room for a match, share a readable room key, and exchange chat messages, score predictions, reactions, and MVP votes directly with other peers. There is no app-owned backend server in the room path.

## Why Pears

- Electron provides the desktop shell for a familiar watch-room interface.
- `pear-runtime` starts a Bare worker alongside the app.
- The Bare worker uses a Hyperswarm topic derived from the room key.
- Room actions are JSON events broadcast directly between peers.
- Each client derives the room board locally from the event stream.

## Features

- Create a room from a match name and get a shareable room key.
- Join an existing room with the same room key from another desktop client.
- Send live chat messages.
- Submit and update score predictions.
- Cast quick match reactions.
- Vote for MVP candidates.
- Track peer count from the worker connection state.
- Rebuild the room board locally from deterministic JSON events.

## Requirements

- Node.js v22.17+
- npm v10.9+

## Setup

Install dependencies:

```sh
npm install
```

## Run

Start the desktop app:

```sh
npm start
```

For a local P2P demo, open two terminals from this project folder and run `npm start` in each one. Create a room in the first window, then join the same room key in the second window.

## Manual Demo Test

1. Run `npm install`.
2. Start one client with `npm start`.
3. Start a second client in another terminal with `npm start`.
4. In the first window, create `Brazil vs Spain` as `Alice`.
5. In the second window, join `brazil-vs-spain` as `Bob`.
6. Send chat, predictions, reactions, and MVP votes from both windows.

Expected result: both clients show matching room state without any app-owned backend server.

## Test

Run the automated test suite:

```sh
npm test
```

The tests cover room-key normalization and deterministic topic derivation, JSON event creation and validation, local room-board derivation, event deduplication, malformed-event handling, immutable snapshots, peer-count normalization, and loading the shared browser core scripts in one global context.

## Verification Note

In this agent environment, automated two-window launch can be exercised, but Hyperswarm discovery may not complete quickly enough to confirm synchronization because the environment is managed and network behavior can differ from a clean local machine. For judging or local review, run two fresh terminals on the same machine or network, use the same room key, wait briefly for discovery, then confirm that chat, predictions, reactions, and MVP votes appear in both windows.

If peers do not find each other locally, try restarting both clients, confirm both windows use the exact same room key, and check whether firewall, VPN, or restricted network settings are blocking peer discovery.

## Demo Video Script

1. Open the project folder and run `npm install`.
2. Start Terminal A with `npm start`.
3. Start Terminal B with `npm start`.
4. In Window A, create the match `Brazil vs Spain` with display name `Alice`.
5. In Window B, join room key `brazil-vs-spain` with display name `Bob`.
6. Show the peer count updating after discovery.
7. From Alice, send a chat message and a score prediction.
8. From Bob, send a reaction and cast an MVP vote.
9. Show both windows displaying the same room board.
10. Close by noting that the room state is derived locally from peer-broadcast JSON events, with no app-owned backend server.

## Hackathon Submission

Title: MatchMesh

Short description: Serverless peer-to-peer football watch rooms built with Electron, pear-runtime, Bare, and Hyperswarm for the Tether Developers Cup Pears track.
