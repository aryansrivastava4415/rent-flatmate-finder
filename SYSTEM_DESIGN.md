# System Design Write-up

## Compatibility Scoring Design

Every tenant–listing pair has at most one `Compatibility` record, enforced by a
unique constraint on `(tenantId, listingId)`. Scores are computed **lazily, on
first browse**: when a tenant fetches the listings feed, the backend checks
whether a score already exists for each visible listing; if not, it calls the
scoring service once and persists the result before responding. This satisfies
the requirement that scores are "stored in DB, not recomputed on every
request" while keeping the system simple — no background job queue is needed,
and the cost of scoring is paid once per tenant–listing pair rather than once
per page view.

Cache invalidation is tied to tenant intent: when a tenant updates their
profile (location/budget/move-in date), all of their existing `Compatibility`
rows are deleted so the next browse recomputes scores against the new
preferences. Listings are not currently re-scored if an owner edits a listing
after scores exist; for production hardening this would be extended by also
invalidating compatibility rows tied to a listing on `PATCH /listings/:id`.

The browse endpoint sorts results by score descending in application code
after scores are resolved (rather than in SQL), since scores may need to be
computed just-in-time for new listings within the same request.

## LLM Integration and Fallback

`llm.service.js` exposes a single `computeCompatibility(listing, tenantProfile)`
function so the rest of the app never has to know whether a score came from an
LLM or a rule. Internally:

1. If `ANTHROPIC_API_KEY` is not set, it skips the network call entirely and
   returns a rule-based score immediately — this keeps local development and
   grading frictionless with no API key required.
2. If a key is present, it calls the Anthropic Messages API with a prompt that
   embeds the listing and tenant profile as JSON and instructs the model to
   return `{ score, explanation }` as raw JSON. A 12-second timeout
   (`AbortController`) bounds worst-case latency.
3. The response is parsed defensively: markdown fences are stripped, the score
   is coerced to a number and clamped to `[0, 100]`, and any parse failure,
   non-2xx status, network error, or timeout is caught and logged, falling
   through to the same rule-based scorer used in step 1.

The rule-based fallback is intentionally simple and explainable: 50 points for
a case-insensitive substring match between preferred and listing location, and
up to 50 points for budget fit (full marks inside the tenant's
`[budgetMin, budgetMax]` range, partial credit scaled by distance from the
range midpoint otherwise). Every score — LLM or rule-based — is tagged with a
`source` enum so the data model is transparent about provenance, and the
explanation string is always human-readable, satisfying the "LLM failures must
be handled gracefully" requirement without any user-visible error state.

## Chat Implementation

Chat is gated on the `Interest` lifecycle: a Socket.io room only becomes
joinable once an `Interest` transitions to `ACCEPTED`. The Socket.io server
authenticates every connection via a JWT passed in `socket.handshake.auth`
(mirroring the REST API's bearer-token auth) rather than trusting client-
supplied user IDs. On `join_room`, the server re-fetches the `Interest` from
the database and verifies the connecting user is either the tenant or the
listing's owner before allowing the socket to join the
`interest:{interestId}` room — this check is repeated on every `send_message`
event too, since socket membership alone shouldn't be trusted as
authorization for a specific action.

Messages are persisted to the `Message` table *before* being broadcast, so
chat history survives reconnects and is available via a regular REST endpoint
(`GET /chat/:interestId/messages`) for initial load — the frontend fetches
history over REST and then joins the socket room for live updates, avoiding
having to replay history over the socket protocol itself.

## Notification Flow

Email notifications are fired synchronously inline with the relevant REST
handler (not queued), since assignment scope favors a directly traceable flow
over infrastructure like a job queue:

- **Tenant expresses interest** → owner is emailed. If the cached
  compatibility score for that pair exceeds 80, the subject line is escalated
  to flag it as a strong match, satisfying the "high compatibility" alert
  requirement without a separate polling/cron mechanism.
- **Owner accepts/declines** → tenant is emailed accordingly, with an accepted
  notice pointing them to the now-unlocked chat.

The email service is provider-agnostic SMTP via Nodemailer. If `SMTP_*`
variables are absent, it logs the would-be email to the console instead of
throwing — so the rest of the request (creating the interest, updating its
status) always succeeds even if mail delivery is unconfigured or fails, and
the notification content remains fully inspectable during development and
grading.
