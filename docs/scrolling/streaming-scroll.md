# Streaming chat scroll behavior

## Problem observed

During assistant streaming, updating the whole app on every token recreated the chat DOM and fought the user's scroll input. The visible symptoms were:

- opening Agents/Settings could be interrupted by streaming rerenders
- the chat followed the stream initially, but upward scroll input was mostly ignored
- the viewport could not reliably scroll down/up while streaming until completion

## Working behavior

The chat follows streamed output only while the user is at the live edge. User intent wins immediately.

Rules:

- switching sessions or creating a fresh render pins to the bottom
- streaming chunks update only the assistant message text, not the whole app DOM
- if `data-autoscroll` is not `false`, streaming scrolls a bottom sentinel into view
- upward wheel, touchmove, keyboard upward navigation, or scrollbar drag away from bottom disables autoscroll
- recent user scroll input creates a short guard window so a stream chunk cannot immediately pull the viewport back down
- autoscroll re-enables only when the conversation is near the bottom again

## Implementation summary

Files involved:

- `src/requests/lifecycle.ts`
  - streaming deltas persist the assistant message
  - dispatch `app:stream-updated` with `{ messageId, content }` instead of `app:changed`
- `src/main.ts`
  - handles `app:stream-updated`
  - updates `[data-message-content="<id>"]` text in place
  - scrolls `[data-scroll-anchor]` into view only when autoscroll is enabled and no recent user scroll occurred
- `src/ui/render.ts`
  - renders `data-message-content` on message text nodes
  - renders a bottom `[data-scroll-anchor]`
  - preserves open dialogs across full rerenders
  - tracks scroll intent and near-bottom reattachment
- `src/ui/events.ts`
  - captures upward wheel/touch intent at the app level before streaming can follow

## Key lesson

For streaming chat, avoid full rerenders on every token. Keep the scroll container stable and mutate only the active streamed message. Track user scroll intent separately from scroll position; programmatic scrolling can otherwise be mistaken for user intent.
