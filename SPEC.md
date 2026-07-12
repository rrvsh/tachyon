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

A session root message is the first root-level message created in the conversation. It may be a user or assistant message. The session root message has no parent.

A session may contain additional root-level messages after edits or regenerations. Messages in the same session with no parent are root-level siblings.

### Message

Messages form a branchable conversation tree within a session.

A message stores:

- ID
- session ID
- role
- content
- parent message ID, null for a root-level message
- created timestamp
- updated timestamp
- finalized status

Message `finalized` is a boolean.

`finalized = false` means an assistant message is currently streaming and may still update.

`finalized = true` means the message will no longer update. Completed, aborted, and failed assistant messages are all finalized. Message records do not durably distinguish completion, abort, or failure.

User messages are created finalized.

Only assistant messages may be unfinalized.

On startup or import, any unfinalized message without an active local request is finalized.

Finalized messages are immutable. Streaming assistant messages may update until finalized.

Messages are not deleted. Edits, forks, and regenerations create new messages.

### Agent

An agent is a reusable OpenRouter request preset.

An agent stores:

- ID
- name
- model
- system prompt
- params
- created timestamp
- updated timestamp
- archive status

`params` contains OpenRouter request parameters, including standard, advanced, and provider-specific options.

Supported common parameters include:

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

`params` must not contain request-owned fields:

- model
- messages
- stream

Agents are canonical records and are not owned by sessions.

## Local application state

- IndexedDB is the local source of truth.
- The viewed session is selected locally.
- The current message pointer is local-only and stored per session.
- If a session has no local current message pointer, it opens at the latest message.
- Latest message means the latest leaf message in the session.
- Latest descendant means the latest leaf under a selected branch.
- Latest leaf is chosen by greatest created timestamp, then by message ID.
- Updated timestamp is not used for latest-message or branch selection.
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
- Starting a request from the root blank state may include user text or may be assistant-only.
- When a root blank state request includes user text:
  - the submitted user message is created as the session root message
  - the assistant placeholder message is created as a child of that user message
- When a root blank state request has no user text:
  - the assistant placeholder message is created as the session root message
  - the OpenRouter message context contains only the selected agent system prompt
- In both root blank request cases:
  - `session.rootMessageId` is set to the first created message
  - the local current message pointer is set to the assistant placeholder message
  - the URL is updated to `?session=<id>` before transport starts
- If request validation fails before session/message records are created, nothing is persisted.
- If transport fails after the assistant placeholder is created, the assistant message is finalized as failed.
- New session navigates to the root blank state.
- The send button shows abort only when the currently viewed session has an inflight request.
- Aborting affects only the currently viewed session's inflight request.
- Switching viewed sessions does not cancel inflight requests.

## Message and branch behavior

- Messages with no parent are root-level messages.
- Root-level messages in the same session are siblings.
- The visible conversation is the path from the selected root-level message to the current message.
- Submitting text creates a user message on the current path.
- Assistant responses append to the request parent or optional user message.
- Editing a message creates a sibling branch in the same session.
- Editing a root-level message creates a root-level sibling in the same session.
- Editing a message in place copies the visible continuation path with new IDs and selects the copied continuation.
- Editing a message and forking creates a new session from the edited path and does not copy following messages.
- Edit-and-fork copies the visible path from the selected root-level message through the edited message into the new session with new IDs, replaces the copied target message content with the edited content, and remaps parent links within the copied path.
- If edit-and-fork resends, the assistant placeholder is created as a child of the edited message in the new session.
- Regenerating an assistant response creates an assistant sibling branch in the same session.
- Regenerating a root-level assistant message creates a root-level assistant sibling in the same session.
- Forking from a message creates a new session.
- Forking copies the visible path from the selected root-level message through the fork target into the new session with new IDs.
- Forking preserves copied message roles, content, and finalized status, and remaps parent links within the copied path.
- Forking does not copy descendants after the fork target.
- The new session root message is the first copied message in the path.
- The new session current message pointer is the copied fork target.
- Branch switching changes the local current message pointer.
- A sibling set is all valid messages in the same session with the same parent message ID, including root-level messages with no parent.
- Siblings are ordered by created timestamp, then by message ID.
- Branch switching sets the local current message pointer to the selected sibling's latest descendant.
- Submitting user text selects the created user message until the assistant placeholder is created, then selects the assistant placeholder.
- Assistant-only requests select the assistant placeholder.
- Completing, aborting, or failing a request keeps the current pointer on the assistant placeholder only if the pointer still refers to that request's path.
- If the user changes the current pointer while a request is inflight, request finalization does not move the pointer back.
- A message parent must belong to the same session and be earlier than the child.

## Request behavior

- Each request belongs to the session where it started.
- Each session can have at most one inflight request.
- Different sessions can have inflight requests concurrently.
- Inflight request state is runtime-only and is not stored in IndexedDB or exported.
- The app keeps a runtime request registry keyed by session ID.
- Each runtime request registry entry stores:
  - session ID
  - assistant message ID
  - abort controller
  - request start timestamp
- Starting a request must synchronously claim the session in the runtime request registry before transport starts.
- If the session already has an inflight registry entry, the request is blocked with a user-visible error.
- When a request completes, fails, or aborts, its runtime registry entry is cleared.
- Reloading the page clears the runtime request registry.
- On startup, any unfinalized assistant message without a runtime registry entry is finalized.
- Request start order:
  1. Select transport:
     - debug transport if debug mode is active
     - OpenRouter transport otherwise
  2. Validate request preconditions:
     - selected session or root blank state is valid
     - selected parent message, if any, belongs to the session
     - selected agent exists and has valid config
     - API key exists unless debug mode is active
     - session has no inflight request
  3. If validation fails, show a user-visible error and persist nothing.
  4. Create any required session, user, and assistant records in IndexedDB.
  5. Set the local current message pointer to the assistant placeholder.
  6. Update the URL if a new session was created.
  7. Claim the runtime inflight registry for the session.
  8. Start transport.
  9. Stream writes only update the assistant placeholder.
  10. On completion, abort, or failure:
      - preserve current assistant content
      - set assistant `finalized = true`
      - clear the runtime inflight registry entry
- Finalization is idempotent.
- If completion, abort, and failure race, whichever finalizes first wins; later outcomes are ignored.
- A request uses the selected agent's model, system prompt, and params.
- A request starts from a selected parent message.
- Request message context is the visible path from the selected root-level message through the request parent.
- If the request creates a user message, that user message is included at the end of the context.
- If the request is assistant-only from the root blank state, the message context is empty.
- If the selected agent has a non-empty system prompt, it is prepended as a system message in the OpenRouter request.
- Stored app messages sent to OpenRouter use only `user` and `assistant` roles.
- The OpenRouter payload uses the selected agent model, assembled messages, `stream: true`, and selected agent params.
- Params containing request-owned fields or invalid config block the request with a user-visible config error.
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
- Import is deterministic and convergent.
- Import merges records by stable ID.
- Matching unchanged records are ignored.
- Non-conflicting changes are merged.
- Records that conflict and cannot be safely merged are quarantined instead of overwritten.
- Quarantined records are kept aside and are not used by normal app views or requests.
- Import preserves all non-conflicting branches from different exports.
- Import excludes local-only settings, API keys, and current message pointers.

## Functional UI behavior

- Functional UI exposes all in-scope operations without styling polish.
- Message controls are split into action controls and branch controls.

Message action controls:

- Edit any message in place:
  - creates a sibling branch in the same session
  - root-level edits create root-level siblings in the same session
  - copies following messages on the visible continuation path with new IDs
  - preserves the visible continuation
- Edit any message and fork from it:
  - creates a new session
  - copies the visible path from the selected root-level message through the edited message with new IDs
  - replaces the copied target message content with the edited content
  - does not copy following messages
  - can optionally resend from the edited message in the new session
- Fork from any message:
  - creates a new session
  - copies the visible path from the selected root-level message through the fork target with new IDs
  - does not copy following messages
  - selects the copied fork target in the new session
  - navigates to the new session
- Regenerate any assistant message:
  - creates a new assistant branch in the same session from the same request parent
  - root-level assistant regenerations create root-level assistant siblings in the same session
  - does not copy following messages

Branch controls:

- Branch controls appear only when a message has siblings.
- Branch controls show previous/next arrows and current sibling position as `1/N`.
- Switching branches selects the sibling and rerenders following messages from that branch.
- If the selected branch has multiple descendant paths, it opens at the latest descendant.
- Pure branch switching does not update the session updated timestamp.

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
- `requests/transport.ts` defines the shared interface for real and debug requests.
- Transports stream text deltas and support abort.
- Transports do not write app state; `requests/lifecycle.ts` owns message updates and finalization.
- `requests/openrouter.ts` implements OpenRouter transport.
- `requests/debug.ts` implements mock debug transport.
- Debug mode uses the same transport interface as OpenRouter.
- `requests/lifecycle.ts` owns streaming, abort, failure, and finalization.
- `app/actions.ts` is the UI-facing application API.
- `ui/` owns DOM rendering and event wiring.
- UI code calls application actions instead of mutating storage directly.
- Core data and message-tree logic is implemented as pure functions where possible.

## Task decomposition rules

Implementation is split into small, testable tasks for subagents.

Each task must:

- Have one clear outcome.
- Touch the fewest reasonable modules.
- Be independently reviewable.
- Avoid mixing unrelated behavior changes.
- Avoid broad refactors unless explicitly refactor-only.
- Preserve existing passing tests unless the intended behavior changes.

Subagents should run in isolated git worktrees where possible. Worktrees are preferred but not required when setup or repo state prevents them.

Each task follows cleanroom TDD with separate subagents where possible:

1. **Red subagent**: writes or updates failing tests for the intended behavior.
2. **Green subagent**: implements the smallest change that passes the tests.
3. **Refactor subagent**: simplifies without changing behavior.
4. **Validate subagent**: runs task-specific and required broader checks.
5. **Commit subagent**: commits only the completed, validated task.

Each subagent must rely on source, tests, and prior committed/task artifacts, not private assumptions from other subagents.

Tasks should be ordered iteratively:

- Start with the thinnest end-to-end working slice.
- Add behavior in small vertical increments.
- Prefer visible, usable functionality early.
- Expand coverage as behavior is added.
- Defer broad internal cleanup until behavior is proven.

A task is complete only when:

- Its tests pass.
- Relevant validation commands pass.
- The diff is scoped to the task.
- Output includes changed files, tests added or updated, validation commands run, and remaining risks or blockers.

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
