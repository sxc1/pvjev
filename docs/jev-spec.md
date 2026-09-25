# Product requirements: Jev integration

Status: Draft based on agreed product requirements. Shared requirements are defined in [product-spec.md](product-spec.md).

## 1. Product overview

Jev provides CPU moves for Play vs Jev. On each CPU turn, the application sends the current game state and every legal move to a single Choice question, applies a validated choice, and saves its confidence and leading move probabilities for later inspection.

The game rules determine legal moves and outcomes. Jev selects among the legal moves. This document defines evaluation, credentials, request timing, retries, fallback, and retained analysis; the shared and game-specific specifications define gameplay and historical review.

## 2. Goals and release scope

1. Let visitors play against Jev and inspect the original decision behind each Jev move.
2. Keep Jev separate from game rules and presentation through the shared CPU provider interface.
3. Integrate Jev after the RNG tic tac toe milestone. Its order relative to Connect Four and chess remains flexible; each game adopts Jev when its integration is ready.
4. v1 runs in the browser on GitHub Pages, with visitors supplying their own TypeSafe API keys. No application backend or application sign-in is required.
5. v2 adds a shared private TypeSafe key behind a relay service or minimal backend. Provider credentials remain on that backend. Detailed design is deferred to v2.
6. Defer the proposed global $5 spending cap.

## 3. Model and decision inputs

1. Use `jev-latest` as the requested model.
2. Submit one Choice question per CPU decision. Supply the current board state in the format defined for that game, without move history.
3. Include the information needed to interpret that state, including the side to move and CPU side, through the game-defined representation or request context.
4. Put the decision prompt in the Choice question's `instructions`. Define the exact prompt at implementation time for each game.
5. Put all legal moves in `criteria`. Each criterion has a stable identifier mapping to one legal move and a description sufficient to interpret it. Do not shortlist moves before evaluation.
6. Maintain prompt version notes in source-code comments. Do not expose prompt versions in the user interface. Using `jev-latest` intentionally allows the underlying model to change over time.
7. Do not issue a request after the match has ended or when no legal move exists. The game rules resolve those states.
8. The current game set fits the Choice limit of 255 options, including chess. No multi-request partitioning of the legal-move set is required.

## 4. Move selection and validation

1. Select the move with the highest returned Choice probability. Do not sample randomly from the distribution except when resolving a tie through the permitted tie rule or applying an explicit RNG fallback.
2. Use first legal-move index as the simple tie breaker: when multiple moves share the highest unrounded probability, choose the earliest of those moves in the supplied legal-move list.
3. Validate the returned Choice answer before applying it. The choice must identify a supplied legal move and agree with a highest-probability option; probabilities must cover the supplied choices, and probabilities and confidence must be valid finite values in their expected ranges. Numerical validation tolerances are implementation details.
4. If the returned choice differs from the application's first-index choice only because of an exact top tie, apply the first-index rule.
5. Recheck legality against the intended live position before committing. Match, turn, and attempt identifiers must still match. Discard stale results without advancing failure counters.
6. Invalid responses follow section 7. Never apply an illegal move.

## 5. Move history and analysis

1. Begin each Jev move's history entry with its returned Choice confidence, followed by the game's normal move notation. Label the value as confidence where needed for clarity.
2. Display per-choice classification probabilities in the move breakdown, using the label **Choice probability**. These values do not represent the chance of winning the game.
3. Confidence describes the returned decision's probability distribution and is distinct from the probability assigned to the played move. Retain the provider's confidence rather than replacing it with the highest probability.
4. Display confidence and probabilities to thousandth precision, as decimal values with three digits after the decimal point. Retain unrounded values for ranking and later display.
5. A tie means equal highest unrounded probabilities. Display rounding alone does not create a tie. Show a simple caution tooltip next to history confidence when a tie occurred; explain that the first tied legal move was chosen. Make the caution accessible by touch on mobile.
6. Evaluate the complete legal-move set, then retain and display at most its top ten choices. Sort by descending probability and use supplied legal-move order to break ranking ties. The played move is included in that retained list.
7. Save the original retained probabilities, decision confidence, and tie information with the move. Preserve the resolved model ID from the response as internal metadata. Reopening analysis never calls Jev again.
8. Saved scores describe the choices available before that move. The historical board follows the game's existing post-move review behavior.
9. Human, RNG, and RNG-fallback moves have no Jev confidence or analysis. Label RNG provenance according to the shared specification.

## 6. Visitor credentials and browser access

1. Ask the visitor for their own TypeSafe API key before making a Jev request. Support correcting or replacing the key after an authentication error.
2. Keep the key in memory for the active page session. Do not include it in the published bundle, URL, saved match, retained analysis, logs, or browser persistent storage.
3. Use the TypeSafe JavaScript SDK with its explicit browser opt-in and the visitor-supplied key.
4. A missing key is a setup condition and does not count as a service failure. Preserve the match while waiting for key entry.
5. When a saved match is restored on a CPU turn, automatically request its move once the key is available. After refresh, key re-entry may be necessary before resuming. A duplicate paid request after refresh is accepted for v1.
6. Verify that a request from the deployed GitHub Pages origin succeeds, including browser CORS requirements, before enabling Jev publicly. SDK browser opt-in alone does not establish this.

## 7. Requests, retries, and RNG fallback

### 7.1 Attempts and timing

1. Associate each product attempt with its match, turn, and attempt identifiers. One product attempt consists of one SDK call, including any SDK retries.
2. Configure `maxRetries: 2` and `maxRetryAfterMs: 1500`. Other SDK retry settings use their defaults unless a later implementation finding requires an explicit change.
3. Two retries permit up to three HTTP attempts. The server retry-delay setting does not define the duration of the whole SDK call.
4. Start a separate client-side five-second deadline when the SDK call begins. It covers HTTP attempts and all waiting between them. At expiry, cancel the call and pending retries, stop accepting its result, and record one service failure.
5. Keep the interface responsive during the call. Game-tab switching and historical review remain available, and a valid response can update the live match without changing the historical selection.
6. Manual Retry starts a new product attempt with a fresh deadline and supersedes the previous attempt. Cancel superseded work where possible; identifier validation still protects against late results.

### 7.2 Service failures

1. A failed SDK call counts as one service failure, regardless of its internal HTTP retry count. The five-second overall deadline also counts as one service failure.
2. Authentication, rate-limit, connection, and service errors count toward the same service-failure limit. Authentication errors receive no special exemption.
3. Present rate-limit and authentication errors as toasts when the product attempt fails. Internal retries are part of the pending attempt and do not create separate failure counts or repeated toasts.
4. After the first and second consecutive service failures, show the error and offer manual Retry. Do not automatically start another product attempt for a service failure.
5. After the third consecutive service failure, surface an error and immediately apply a random legal move. Identify it as RNG fallback, record a service-failure reason, and attach no Jev analysis.
6. Reset the consecutive service-failure count after a successful Jev move. Counters belong to the match, not other game tabs; a new match starts with zero failures. Cancellation caused by retry, resignation, or match replacement does not itself count as a failure.
7. SDK retries and the act of pressing Retry do not independently increment counters. Service failures do not count as invalid CPU responses.

### 7.3 Invalid responses

1. A completed SDK call containing an invalid CPU answer increments the separate invalid-response counter. Automatically request another answer until there have been three consecutive invalid responses total.
2. Reset the invalid-response counter after a valid Jev move. Service failures and manual retries do not advance it; an invalid answer does not reset the service-failure counter because no successful Jev move occurred.
3. After the third invalid response, surface an error and apply a random legal move. Record exactly: "Rejected illegal move attempted by Jev, fell back to random move".
4. Identify that move as RNG fallback and attach no Jev analysis. Service-failure fallback uses its own diagnostic rather than the illegal-move message.
5. Both fallback paths select from freshly computed legal moves using trusted RNG logic. Fallback ends the failed CPU turn; start the next CPU turn's recovery counters at zero.

## 8. Persistence and architecture

1. Preserve the current match, move sequence, Jev provenance, and retained analysis through the shared local-persistence mechanism. Do not retain the full choice distribution beyond the top ten.
2. Keep recovery counts with the current match so refreshing cannot restart a partially failed turn's counters. Request controllers, timers, and credentials remain runtime data.
3. Keep game-state encoding and legal-move mapping in the game integration, network evaluation in the Jev provider, and request coordination and presentation in their existing shared boundaries.
4. Saved history remains readable without a key or network access. A saved analysis view never recomputes the decision using the current model or prompt.

## 9. Acceptance criteria

1. Every Jev turn evaluates every legal move with one Choice question using `jev-latest`, a game-specific prompt, and the current game-defined board state without history.
2. A valid applied move has the highest unrounded probability; an exact top tie uses first legal-move index and shows the tie caution next to history confidence.
3. Confidence and Choice probabilities display to three decimal places. Inspection retains no more than ten ranked choices and sends no network request.
4. Visitor keys are required for new Jev calls, held only in session memory, and absent from the bundle and persisted data. Restoring a CPU turn waits for key re-entry when necessary and then resumes automatically.
5. SDK calls use `maxRetries: 2` and `maxRetryAfterMs: 1500`. The separate five-second deadline cancels pending retries and rejects late results as one failed product attempt.
6. Rate-limit and authentication failures show toasts. The first two consecutive service failures offer manual Retry; the third applies a legal RNG fallback. A successful Jev move resets the service-failure count.
7. Three invalid responses trigger a legal RNG fallback with the exact required diagnostic. Service failures do not advance that counter, and fallback carries no Jev analysis.
8. Results from expired, superseded, resigned, or replaced matches never apply a move. Responses received during review preserve the selected historical position.
9. Browser requests succeed from the deployed GitHub Pages origin before public Jev enablement.
10. Source comments track prompt versions without exposing them in the product UI. Changes to the prompt or model do not alter previously saved analysis.

## 10. Deferred work and implementation decisions

1. v2 provides the shared private key and relay service or minimal backend; its access controls, deployment, and operational details need a later specification.
2. The global $5 spending cap remains deferred.
3. Exact prompts, criterion descriptions, serializers, move identifiers, validation tolerances, credential-entry layout, and toast and tooltip wording are implementation decisions within these requirements.
4. No benchmark win rate or minimum model-quality target is required for v1.

## 11. References

- [Shared product requirements](product-spec.md)
- [Tic tac toe](tic-tac-toe-spec.md), [Connect Four](connect-four-spec.md), and [chess](chess-spec.md)
- [Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [Models and aliases](https://docs.typesafe.ai/models)
- [JavaScript client configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig)
- [JavaScript retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy)
- [Request options and cancellation](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions)
