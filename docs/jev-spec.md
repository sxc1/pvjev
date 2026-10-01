# Product requirements: Jev integration

Status: Agreed product requirements for specification; implementation is pending. Release scheduling belongs in [product-spec.md](product-spec.md), not this document.

## 1. Product overview and scope

Jev provides CPU moves for Tic Tac Toe and Connect Four. On each CPU turn, the application sends the current game state and every legal move to one TypeSafe Choice question, applies a validated choice, and saves its confidence and leading move probabilities for later inspection.

Game rules determine legal moves and outcomes. Jev selects among those moves through the shared CPU provider interface. Shared and game-specific specifications govern ordinary gameplay and historical review. This document governs Jev access, credentials, allowance, requests, analysis, and persistence, including the Jev-specific exceptions to ordinary Restart confirmation. Where older shared text conflicts on those subjects, these requirements take precedence.

Assume one browser tab actively controls play. Cross-tab synchronization is outside scope. The proposed global $5 spending cap remains deferred; no benchmark win rate or minimum model-quality target is required.

## 2. Automatic opponent and credential selection

1. Do not present an opponent selector. At match start, automatically use Jev when access is available; otherwise use RNG. Show which opponent the match is using.
2. Guests and signed-in users may supply their own TypeSafe API key for either game. A supplied visitor key takes priority over the application's shared key, including for whitelisted accounts. Visitor-key play does not consume the application's daily allowance.
3. Without a visitor key, signed-in whitelisted accounts may use the shared key for either game without the daily game limit.
4. Without a visitor key, signed-in accounts outside the whitelist may use the shared key for one Connect Four match per rolling 24 hours. They use RNG for Tic Tac Toe and for additional Connect Four matches during that period.
5. Guests without a visitor key use RNG. Google sign-in remains optional for RNG and visitor-key play.
6. Record the automatically selected opponent (`jev` or `rng`) and, for Jev, the credential route (`visitor` or `shared`) when the match starts. Keep that assignment for the match. Adding a key, signing in, or gaining eligibility does not upgrade an existing RNG match.
7. Do not automatically switch between visitor and shared keys during a match. A failed visitor key follows the failure rules in section 7; it must not silently use the application's key. Correcting or replacing a visitor key within the visitor route is allowed.
8. An RNG fallback move within a Jev match does not change the match's opponent or credential route. Later CPU turns try Jev again through that same route. An explicit Restart creates a new match as described in section 4.

## 3. Relay, keys, and account allowance

### 3.1 Credential handling

1. Send all Jev requests through a Supabase relay, including requests using visitor keys. The browser does not call TypeSafe directly and does not use the SDK's browser opt-in.
2. Store the application's TypeSafe key as a Supabase server-side secret. Only the relay may read it; never send it to the browser or include it in the published bundle.
3. Keep a visitor key only in browser memory for the active page session and transiently in the relay while handling its request. Never persist it in browser storage, cookies, a database, files, caches, saved matches, or retained analysis. Do not include keys in URLs, logs, error reports, or telemetry. Relay and SDK logging must not capture credential-bearing request bodies or headers. Do not retain visitor keys in a shared server-side client between requests.
4. Allow visitors to enter, clear, correct, or replace their key. A reload loses the key. Saved visitor-key matches wait for key re-entry before another Jev request; this missing-key state is not a service failure and does not switch routes.
5. The visitor-key relay path accepts guests and forwards only their supplied key. The shared-key path requires a verified Supabase session and server-side authorization. A missing or invalid visitor key must never cause the relay to substitute the shared secret.
6. Authorize shared-key requests using the verified account identity, not a client-supplied user ID. Scope requests to the supported games and game evaluation contract; do not expose an unrestricted TypeSafe proxy. Configure and verify browser-to-relay access from the deployed application origin.

### 3.2 User extension and daily approval

1. Create a separate user extension table referencing the primary key of `auth.users`. Include `userId`, nullable `approvedJevMatchId`, nullable `lastJevMatchStarted`, and `isWhitelisted` (default false), or equivalent SQL names. Deleting the user removes their extension row. Provide rows for existing and newly created accounts.
2. Only trusted server operations may change whitelist status, approved match ID, or allowance timestamps. Clients cannot grant themselves access or edit the cooldown. Use appropriate table privileges and row-level access controls.
3. For a non-whitelisted account starting a shared-key Connect Four match, submit the new client match UUID for server approval. Atomically check eligibility, store that UUID as the approved match ID, and set the start timestamp using server time. Eligibility requires no previous start or at least 24 hours since the previous start. Failed approval must not overwrite a valid approval or its timestamp.
4. Approval consumes the allowance at Start, even if the player leaves before Jev makes a move. Abandonment, resignation, Restart, service failure, and RNG fallback do not refund it.
5. Repeating approval for the same currently approved match ID is idempotent: it does not consume another allowance or advance the timestamp. If a start response is lost, reconcile or retry that same ID instead of generating another one.
6. Every limited shared-key move request must have a verified session for the approving account, identify Connect Four, and match that account's approved match ID. Matching requests may continue the approved match during the cooldown. A match ID alone is not authentication. The client stores the approving account identity with the match so another account cannot resume it through the shared route.
7. Whitelisted shared-key play and visitor-key play do not consume the daily allowance. Whitelist authorization is checked server-side for shared-key calls. A definitive allowance denial at setup selects RNG; an unknown approval result must be reconciled before declaring that a daily match did or did not start.
8. Keep one approved daily match ID per account. Approving a new eligible match replaces the previous ID. Ending an approved match clears its approval without clearing or advancing `lastJevMatchStarted`; end operations clear only the matching ID so a stale operation cannot revoke a newer match.
9. On restore, use the existing approved match ID and revalidate access rather than consuming a new allowance. Shared-key continuation requires the original account. Missing sign-in pauses that route until the account is available; it does not silently change credentials.

## 4. Resign, Restart, and statistics

1. Preserve the shared rules for when Restart, Resign, and Rematch are available. Add a confirmation modal before Restart would discard an incomplete match using the daily shared-key allowance, including before its first move. Ordinary RNG, visitor-key, and unlimited whitelisted matches retain the ordinary confirmation rules.
2. For an incomplete daily Jev match, both the Restart confirmation and the existing Resign confirmation explain that the daily allowance has already been used and ending the match will not restore it. Do not claim that resignation consumes it a second time. Cancelling the modal leaves the match and approval intact.
3. Confirming Restart ends the approved match, invalidates pending attempts, retires its server approval, and starts a new RNG match with a new ID. This explicit Restart uses RNG even though normal match setup defaults to Jev when eligible. Never reuse the approved ID for the restarted board.
4. Confirming Resign ends the match as a human loss, invalidates pending attempts, and retires approval. A normally completed approved match also retires approval. Keep completed history reviewable under the shared rules. Neither completion nor retirement refunds the allowance.
5. Record statistics using the match's assigned opponent, not the final move's provenance or the key owner. A Jev match with RNG fallback moves remains a Jev result; the new RNG match after Restart is an RNG result. Visitor-key Jev matches count as Jev when the player is signed in at completion. Preserve the shared rule that guest completions are not counted retroactively.

## 5. Model inputs and move validation

1. Request `jev-latest` with one Choice question per CPU decision. Send the current game-defined board state without move history, including enough context to identify the side to move and CPU side.
2. Put the game-specific decision prompt in `instructions`. Put every legal move in `criteria`, with stable identifiers and descriptions sufficient to interpret the choices. Do not shortlist moves. Tic Tac Toe and Connect Four fit within the Choice limit of 255 options.
3. Define exact prompts, serializers, criterion descriptions, and move identifiers during implementation. Maintain prompt version notes in source comments, not the UI. The `jev-latest` alias intentionally allows the underlying model to change.
4. Do not issue a request after the match ends or when no legal moves exist. Rules resolve those states.
5. Validate that the returned choice identifies a supplied legal move and agrees with a highest-probability option. Require exactly the expected probability entries, finite probabilities and confidence in their expected ranges, and a probability sum consistent with one. Numerical tolerances are implementation details.
6. Select the highest unrounded probability. For an exact top tie, use the earliest tied move in the supplied legal-move list, even if the provider chose another tied option. Do not randomly sample Jev choices.
7. Before committing, recheck legality and the live match, turn, and attempt identifiers. Reject expired, superseded, resigned, restarted, or replaced attempts without making a move or advancing failure counters. Invalid current answers follow section 7.

## 6. Move history and retained analysis

1. Begin a Jev history entry with the returned Choice confidence followed by normal move notation. Label confidence clearly. In the breakdown, label per-choice values **Choice probability**; they are not probabilities of winning the game.
2. Retain the provider's confidence, which describes the decision distribution and is distinct from the played move's probability. Display confidence and probabilities to three decimal places; retain unrounded values.
3. A tie means equal highest unrounded probabilities, not equal rounded display values. Show an accessible caution beside confidence explaining that the first tied legal move was chosen, including touch access on mobile.
4. Evaluate all legal moves, then retain and display at most ten choices sorted by descending probability and then supplied legal-move order. Include the played move. Save confidence, tie information, and the resolved model ID with the move; the model ID is internal metadata.
5. Scores describe choices before the move, while the historical board follows the game's post-move review behavior. Reopening analysis sends no request and never recomputes scores with a newer model or prompt.
6. Human, RNG, and RNG-fallback moves have no Jev confidence or analysis. Distinguish fallback from ordinary RNG play and retain its diagnostic.

## 7. Requests, deadlines, retries, and fallback

### 7.1 Attempts and cancellation

1. Identify every product attempt by match, turn, and attempt IDs. One attempt is a browser-to-relay request and the relay's TypeSafe SDK call, including SDK retries. Do not multiply retries by adding an independent automatic browser retry loop.
2. Configure the relay SDK with `maxRetries: 2` and `maxRetryAfterMs: 1500`. This permits up to three upstream HTTP attempts; other SDK retry settings use defaults unless implementation findings require an explicit change.
3. Start the five-second deadline when the browser dispatches the relay request. It covers the entire round trip, including relay authorization, TypeSafe processing, retry waits, and delivery back to the browser. The SDK's per-attempt timeout is not this deadline.
4. At expiry, invalidate the attempt before aborting its browser request and count one service failure. Forward cancellation upstream where available and bound relay work with a server-side timeout. Do not depend on the relay detecting a browser disconnect to protect game state.
5. Work already underway at the relay or TypeSafe may finish and incur usage after cancellation. This wasted usage is acceptable; refunding it or recovering its answer is not required. An expired answer must never make a move, update saved analysis, or count as a later success, even if cancellation failed.
6. Manual Retry creates a fresh attempt and deadline, superseding the previous attempt. Resignation, Restart, and match replacement also invalidate outstanding attempts. Cancel superseded work where possible; attempt validation remains mandatory.
7. Keep the UI responsive. Switching game tabs and reviewing history do not cancel a valid live-match request. A valid CPU response may update and save the live match without moving the historical selection.

### 7.2 Service failures

1. A failed relay/SDK attempt or five-second deadline counts as one service failure regardless of internal HTTP retries. Authentication, authorization, rate-limit, connection, and service errors use this counter. Missing visitor-key entry or waiting for required sign-in is a setup state, not a failed request.
2. Show authentication and rate-limit errors as toasts when the product attempt fails. Do not create separate counts or repeated toasts for internal retries.
3. After the first and second consecutive service failures, show the error and offer manual Retry. Do not automatically start another product attempt for a service failure. Allow a visitor key to be corrected before retrying through the same route.
4. After the third consecutive service failure, surface an error and apply a legal random move with RNG-fallback provenance and a service-failure diagnostic, without Jev analysis.
5. A successful Jev move resets the service-failure count. Counts belong to the current match. Cancellation due to Retry, resignation, or match replacement is not itself a failure. Service failures do not increment the invalid-response counter.

### 7.3 Invalid responses

1. An invalid current CPU answer increments a separate invalid-response counter. Automatically request another answer until there have been three invalid responses without a successful Jev move.
2. A valid Jev move resets the invalid-response counter. Service failures and manual retries do not advance it. An invalid answer does not reset the service-failure counter.
3. After the third invalid response, surface an error and apply a random legal move. Record exactly: "Rejected illegal move attempted by Jev, fell back to random move". Give it RNG-fallback provenance and no Jev analysis. Service-failure fallback uses its own diagnostic.
4. Both fallback paths use freshly computed legal moves and trusted RNG logic. Fallback ends the failed CPU turn and resets both recovery counters for the next CPU turn. It does not switch credential routes or refund an allowance.

## 8. Persistence and architecture

1. Save the current match ID, selected opponent, credential route, approving account identity where applicable, moves, outcomes, Jev provenance, and retained analysis locally. Preserve both recovery counters so refresh cannot erase a partially failed turn. Never save a TypeSafe key or a transient request controller, timer, or pending attempt.
2. Restoring a CPU turn creates a fresh attempt only after access for its saved route is available. Reuse the saved match ID and approval. A saved visitor-key match waits for key re-entry; it cannot fall through to the shared secret.
3. Saved history remains readable without credentials or network access. Do not retain the full probability distribution beyond the top ten.
4. There are no existing users requiring save migration. Update the local schema as needed; old incompatible matches may be discarded through a clear fresh-start path. No backward-compatible migration is required.
5. Keep state encoding and legal-move mapping in game integrations, TypeSafe evaluation in the relay/provider, and request coordination and presentation in their existing boundaries. Supabase stores account access and aggregate statistics; full game histories remain local.

## 9. Acceptance criteria

1. Both games automatically choose Jev with a supplied visitor key or whitelisted shared-key access. Guests without a key use RNG. Non-whitelisted shared-key access applies only to an eligible Connect Four match; Tic Tac Toe uses RNG without a visitor key.
2. Visitor keys override the shared key, pass through the relay, and are never persisted or logged. Guest calls cannot obtain use of the shared secret. Visitor-key reloads wait for re-entry without changing routes.
3. Server-side approval atomically consumes the daily allowance at Start using server time. Repeated approval of the same ID is idempotent. Subsequent limited requests require the same approved ID and authenticated account. Clients cannot edit whitelist or allowance fields.
4. Cancelling Restart or Resign preserves the approved match. Confirming Restart warns, ends approval without refund, invalidates pending work, and creates a new RNG match. Confirming Resign records the Jev loss and retires approval. Late answers from either ended match make no move.
5. Match statistics preserve Jev identity across RNG fallback and distinguish the new RNG match after Restart.
6. Each Jev decision evaluates every legal move once per SDK HTTP attempt using one Choice question and `jev-latest`. The selected move has the highest probability; exact ties use supplied legal-move order.
7. Analysis retains at most ten choices, original confidence, tie metadata, and resolved model ID. Values display to three decimals; history inspection makes no network call.
8. The five-second deadline covers the whole round trip. Tests with uncancellable and late relay responses prove that expired and superseded answers cannot apply moves or analysis. Continued upstream usage after abort is acceptable.
9. SDK retries, service failures, invalid answers, manual Retry, and fallback obey section 7 without double-counting. Recovery counters survive refresh and reset after fallback.
10. Deployed relay checks cover guest visitor-key calls, authenticated shared-key calls, forbidden access, allowance consumption and continuation, and absence of keys from persisted data and application logs. Mocks alone do not establish deployed relay behavior.

## 10. Implementation decisions and references

Exact prompts, request/response types, serializers, numerical tolerances, schema names, relay deployment details, key-entry layout, and toast/tooltip wording are implementation decisions within these requirements. The global $5 cap remains deferred.

- [Shared product requirements](product-spec.md)
- [Tic Tac Toe](tic-tac-toe-spec.md) and [Connect Four](connect-four-spec.md)
- [Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [Models and aliases](https://docs.typesafe.ai/models)
- [JavaScript client configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig)
- [JavaScript retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy)
- [Request options and cancellation](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions)
- [Supabase user extension tables](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase secrets](https://supabase.com/docs/guides/functions/secrets)
