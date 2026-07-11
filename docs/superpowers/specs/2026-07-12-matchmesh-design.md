# MatchMesh Design

## Summary

MatchMesh is a stable hackathon demo for the Tether Developers Cup Pears track. It is a peer-to-peer football watch-party room where fans can create a match room, share a room key, chat, submit score predictions, cast match reactions, and see a live room board without running a central server.

The project targets a reliable submission before the extended deadline on 2026-07-15 14:59. The first version favors a complete, demonstrable loop over broad feature coverage.

## Goals

- Demonstrate real Pears peer-to-peer behavior with two local clients.
- Connect clearly to the football tournament theme: fans, matches, predictions, watch-parties, and communities.
- Require no backend deployment and no cloud account to demo.
- Produce a GitHub repository, README, and demo video that judges can understand quickly.

## Non-Goals

- No real match data API in the first version.
- No wallet, tipping, escrow, or ticketing logic in the first version.
- No local AI model integration in the first version.
- No account system, hosted database, or centralized relay owned by the app.
- No complex conflict-resolution model beyond event id deduplication and timestamp ordering.

## User Experience

The app opens to a focused room launcher:

- Create room: user enters a match name, for example `Brazil vs Spain`, and a display name.
- Join room: user enters a room key and display name.

Inside a room, the app shows four main areas:

- Match header: match name, room key, peer count, and connection status.
- Live chat: short messages from each fan.
- Predictions: each fan can submit one score prediction, such as `2-1`.
- Reactions and MVP board: quick buttons such as `Goal soon`, `Great save`, `Pressure rising`, and `MVP`, with live counts.

The demo flow uses two app windows:

1. Window A creates a room.
2. Window B joins with the room key.
3. A sends a chat message and B sees it.
4. B submits a score prediction and A sees it.
5. Both cast reactions and the room board updates.

## Architecture

MatchMesh is a Pears app with a local UI and a peer-to-peer sync layer.

The app is split into four small modules:

- `room`: creates and joins rooms from a match name or room key.
- `p2p`: manages peer discovery, connections, message broadcast, and incoming event handling.
- `state`: stores room events, deduplicates them, and derives the visible room board.
- `ui`: renders the launcher, room dashboard, chat, predictions, and reactions.

The first implementation should keep the UI and sync logic simple enough to inspect during judging. A later version can add persistent history or Autobase-style multiwriter logs if time allows.

## Pears Usage

The submission should explicitly use Pears ecosystem building blocks:

- Pear CLI / runtime for running the app.
- Hyperswarm or the Pears-recommended peer discovery layer for room joining.
- Hypercore-style append-only event thinking for the room feed, even if the first version keeps persistence minimal.

The README and demo video should name where Pears is used:

- Room key maps to a shared P2P topic.
- Peers discover each other through that topic.
- Chat, prediction, and reaction actions are broadcast as signed or locally identified events.
- Each client derives the same room board from the event stream.

## Event Model

All user actions become room events:

```json
{
  "id": "clientId:sequence",
  "type": "chat.sent",
  "roomId": "room-key",
  "clientId": "alice",
  "createdAt": "2026-07-12T00:00:00.000Z",
  "payload": {}
}
```

Event types:

- `room.created`: match metadata.
- `peer.joined`: optional local presence signal.
- `chat.sent`: chat message text.
- `prediction.submitted`: display name and score prediction.
- `reaction.cast`: reaction kind.
- `mvp.cast`: player or free-text MVP pick.

Events are appended locally and broadcast to peers. Received events are ignored if their `id` already exists. The visible room board is derived from the event list sorted by `createdAt`, with `id` as a stable tie-breaker.

## Data Flow

1. User clicks an action in the UI.
2. `state` creates an event with a stable id.
3. UI updates immediately from local state.
4. `p2p` broadcasts the event to connected peers.
5. Remote clients receive the event.
6. Remote `state` deduplicates and stores the event.
7. Remote UI re-renders the room board.

This keeps the demo responsive even when the second peer connects a moment later.

## Error Handling

- No peers connected: show `Waiting for fans to join`.
- Invalid or empty room key: keep user on the join form with a clear validation message.
- Duplicate event: ignore silently.
- Temporary disconnect: keep local state and show `Reconnecting`.
- Message parse failure: ignore that message and keep the connection alive.
- P2P startup failure: show a technical error panel with a short troubleshooting hint for the README.

## Testing

Manual acceptance tests are enough for the first hackathon version:

- Create a room in one window and join it in a second window.
- Confirm peer count changes when the second window joins.
- Send chat from A and confirm it appears in B.
- Submit prediction from B and confirm it appears in A.
- Cast reactions from both windows and confirm counts match.
- Reload one window and confirm the app starts cleanly.

Small automated tests should cover pure state logic if time permits:

- Event deduplication.
- Prediction replacement or latest-prediction derivation.
- Reaction count derivation.
- Stable sorting by timestamp and id.

## Demo Video Script

The demo video should be 90 to 150 seconds:

1. Open with the title: `MatchMesh: serverless P2P football watch rooms`.
2. Show Window A creating `Brazil vs Spain`.
3. Copy the room key into Window B and join as another fan.
4. Send chat both ways.
5. Submit two score predictions.
6. Cast reactions and MVP votes.
7. Show that there is no backend URL or server dashboard; the sync is peer-to-peer.
8. End with the Pears stack explanation: room topic, peer discovery, event stream, local room board.

## Three-Day Build Plan

Day 1:

- Scaffold Pears app.
- Build room launcher and static room dashboard.
- Confirm two local app windows can start.
- Implement basic P2P connection and peer count.

Day 2:

- Implement event model, broadcast, deduplication, and derived state.
- Add chat, predictions, reactions, and MVP board.
- Write manual test checklist.

Day 3:

- Polish UI and empty states.
- Write README and submission notes.
- Record demo video.
- Do a clean run from setup instructions.

## Submission Package

- GitHub repository with source code.
- README with setup, run, demo, architecture, and Pears usage.
- Demo video link.
- DoraHacks submission description.

The submission title should be:

`MatchMesh - P2P Football Watch Rooms`

The short description should be:

`A serverless Pears app where football fans create peer-to-peer watch rooms for live chat, score predictions, reactions, and MVP voting.`
