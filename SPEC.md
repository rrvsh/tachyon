# Specification

## Product

A client-side chat app for interacting with AI models through OpenRouter.

## Data model

### Session

A session represents one conversation tree.

A session stores:

- short 8-character ID
- title
- created timestamp
- updated timestamp
- archive status
- root message ID

A session root message is the first message in the conversation tree. It may be a user or assistant message. The root message has no parent.

### Message

Messages form a tree within a session.

A message stores:

- ID
- session ID
- role
- content
- parent message ID, null for the root message
- created timestamp
- updated timestamp
- finalized status

Completed messages are immutable. Streaming assistant messages may update until finalized.

Messages are not deleted. Edits, forks, and regenerations create new messages.

### Agent

An agent is a reusable OpenRouter request preset.

An agent stores:

- ID
- name
- model
- system prompt
- params
- extra config
- created timestamp
- updated timestamp
- archive status

`params` contains supported OpenRouter request parameters, including:

- temperature
- top_p
- top_k
- frequency_penalty
- presence_penalty
- repetition_penalty
- max_tokens
- max_completion_tokens
- stop
- seed
- reasoning
- provider
- response_format
- models

`extra config` is reserved for advanced OpenRouter/provider-specific request options.

Agents are canonical records and are not owned by sessions.

## Local application state

- IndexedDB is the local source of truth.
- The viewed session is selected locally.
- The current message pointer is local-only and stored per session.
- If a session has no local current message pointer, it opens at the latest message.
- Settings are local-only.

## Settings

Settings are local-only.

Settings store:

- OpenRouter API key
- selected agent ID

API keys are never synced.

The app requires an OpenRouter API key before starting requests. Missing API keys block requests with a user-visible error.

## Session view behavior

- Sessions are viewed through `?session=<id>`.
- The session list navigates by setting the `session` query param.
- Missing or invalid `session` query params show the root blank state.
- The root blank state has no persisted session.
- Blank sessions are not stored.
- Starting a request from the root blank state creates a session and updates the URL.
- New session navigates to the root blank state.
- The send button shows abort only when the currently viewed session has an inflight request.
- Aborting affects only the currently viewed session's inflight request.
- Switching viewed sessions does not cancel inflight requests.

## Message and branch behavior

- The visible conversation is the path from the root message to the current message.
- Submitting text creates a user message on the current path.
- Assistant responses append to the request parent or optional user message.
- Editing a message creates a sibling branch.
- Regenerating an assistant response creates an assistant sibling branch.
- Forking from a message starts a new branch from that point.
- Branch switching changes the local current message pointer.
- A message parent must belong to the same session and be earlier than the child.

## Request behavior

- Each request belongs to the session where it started.
- Each session can have at most one inflight request.
- Different sessions can have inflight requests concurrently.
- A request uses the selected agent's model, system prompt, params, and extra config.
- A request starts from a selected parent message.
- A request may optionally create a user message before the assistant response.
- A request creates one assistant message for the streamed response.
- Streaming writes only to that assistant message.
- Aborted or failed requests preserve partial assistant content.
- Completed, aborted, and failed assistant messages are finalized.

## Error handling

- Request-blocking errors are shown to the user.
- Missing API key, missing selected agent, and invalid agent config block requests.
- OpenRouter, network, and stream errors are shown to the user.
- Failed or aborted requests preserve partial assistant content and finalize the assistant message.
- Corrupt local records are ignored or quarantined.
- Invalid user config is not silently dropped.

## Debug mode

- Debug mode is enabled by query param.
- Debug mode replaces the OpenRouter transport with a local mock transport.
- Mock transport uses the same request, session, message, streaming, abort, and error paths as real requests.
- Mock transport can simulate streaming success, delay, abort, and errors.
- Debug mode does not require an API key.
- Debug mode is not persisted or synced.

## Import and export

- Remote sync is deferred.
- Exports are JSON files containing version, export timestamp, sessions, messages, and agents.
- Export serializes canonical IndexedDB records, not a raw database dump.
- Import validates the export before applying it.
- Import merges records by stable ID.
- Matching unchanged records are ignored.
- Conflicting immutable records are quarantined instead of overwritten.
- Import preserves branches from different exports.
- Import excludes local-only settings, API keys, and current message pointers.

## Functional UI behavior

- Functional UI exposes all in-scope operations without styling polish.
- Message controls are split into action controls and branch controls.

Message action controls:

- Edit any message in place:
  - creates a sibling branch
  - copies following messages with new IDs
  - preserves the visible continuation
- Edit any message and fork from it:
  - creates a sibling branch
  - does not copy following messages
  - can optionally resend from the edited message
- Fork from any message:
  - creates/selects a branch from that message
  - does not copy following messages
- Regenerate any assistant message:
  - creates a new assistant branch from the same request parent
  - does not copy following messages

Branch controls:

- Branch controls appear only when a message has siblings.
- Branch controls show previous/next arrows and current sibling position as `1/N`.
- Switching branches selects the sibling and rerenders following messages from that branch.
- If the selected branch has multiple descendant paths, it opens at the latest descendant.

Other UI behavior:

- Functional UI supports creating, editing, and archiving agents.
- Archived sessions are hidden from the main session list and available in a separate reversible archive view.

## Technical architecture

- The app is a static site with no backend.
- The app uses vanilla TypeScript.
- The app uses Vite for development and static production builds.
- The production build outputs static files only.
- The app does not use a UI framework.
- The app targets mobile, desktop, and low-power devices.
- Code is split into small modules with stable interfaces.
- The project structure supports parallel implementation and review.

Project structure:

```txt
src/
  main.ts
  app/
    actions.ts
    state.ts
  data/
    schema.ts
    validation.ts
    db.ts
    importExport.ts
  messages/
    tree.ts
    operations.ts
  agents/
    agents.ts
  settings/
    settings.ts
  requests/
    lifecycle.ts
    transport.ts
    openrouter.ts
    debug.ts
  ui/
    render.ts
    events.ts
tests/
  unit/
  e2e/
```

Architecture rules:

- `data/schema.ts` owns canonical record types.
- `data/db.ts` owns IndexedDB access.
- `data/validation.ts` owns record validation.
- `messages/` owns tree traversal and branch operations.
- `agents/` owns agent validation and request config assembly.
- `settings/` owns local-only settings.
- `requests/transport.ts` defines the shared transport interface.
- `requests/openrouter.ts` implements OpenRouter transport.
- `requests/debug.ts` implements mock debug transport.
- `requests/lifecycle.ts` owns streaming, abort, failure, and finalization.
- `app/actions.ts` is the UI-facing application API.
- `ui/` owns DOM rendering and event wiring.
- UI code calls application actions instead of mutating storage directly.
- Core data and message-tree logic is implemented as pure functions where possible.

## Tooling

- The project uses Nix flakes for the development environment.
- `nix develop` is the canonical development entrypoint.
- The dev shell provides Node.js LTS, pnpm, and Playwright browser support.
- The project uses pnpm for JavaScript package management.
- `pnpm-lock.yaml` is committed.
- npm and yarn lockfiles are not used.
- Playwright tests use browsers provided by Nix.
- The project does not require `playwright install`.
- The dev shell sets `PLAYWRIGHT_BROWSERS_PATH`.

Required scripts:

- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm lint`
- `pnpm format`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm check`

`pnpm check` runs typecheck, lint, format check, tests, and build.

## Testing requirements

- Unit tests cover data validation, message tree operations, agent config, import/export, and request lifecycle.
- E2E tests cover core session, streaming, abort, branching, agent, debug mode, and import/export flows.
- E2E tests use debug mode instead of the real OpenRouter API.
- `pnpm check` must pass before implementation is considered complete.

## Out of scope

- Styling and visual polish.
- Remote sync.
- Tool calling.
- Message deletion.
- Synced settings or API keys.
- Raw database export/import.
- Markdown and code-block rendering.
- Advanced branch visualization.
- Data cleanup and compaction.
