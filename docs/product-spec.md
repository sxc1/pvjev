# Product requirements: Play vs Jev

Status: Draft based on agreed product requirements.

## 1. Product overview

A public collection of simple board games in which a user plays against a CPU opponent, ultimately powered by Jev. The product is a React single-page application for desktop and mobile browsers. Its initial game set is tic tac toe, Connect Four, and chess.

Users can play a match, review its prior positions, and inspect Jev's ranked move choices when Jev is integrated. Deterministic game rules remain responsible for legal moves and game outcomes.

This document defines shared behavior. Game-specific rules and interactions belong in [tic-tac-toe-spec.md](tic-tac-toe-spec.md), [connect-four-spec.md](connect-four-spec.md), and [chess-spec.md](chess-spec.md). Jev decision-making and integration details belong in [jev-spec.md](jev-spec.md).

## 2. Release scope

| Stage | Scope |
| --- | --- |
| v0.5 | Playable tic tac toe with random legal CPU moves. Establish the shared application, CPU abstraction, review flow, and local persistence. Show all three game tabs, with unimplemented games disabled. |
| v1 | Public, browser-only demo hosted on GitHub Pages. Connect Four, chess, and Jev integration are sequential additions; their implementation order and release boundaries will be determined as challenges arise. No fixed sequence beyond tic tac toe first is committed. |
| v2 | Add whitelist-based Google authentication, stored per-user win/loss totals, global win/loss totals against Jev, and a shared private TypeSafe key behind a relay service or minimal backend. Do not store detailed completed-match histories. Backend and data design are deferred. |

Jev-specific requirements apply when that provider is implemented, not to the RNG-only milestone. Each game becomes enabled when its implementation is available.

## 3. Platforms, hosting, and constraints

1. Use a React SPA hosted on GitHub Pages, with no application backend in v1.
2. Support desktop browsers at 1080p and 1440p, and mobile browsers on modern iPhones and Android devices.
3. Provide touch-friendly controls and layouts. Dedicated keyboard gameplay/navigation is not required; ordinary controls retain standard browser behavior.
4. Offer public access without application authentication in v1. Visitors supply their own TypeSafe API keys to use Jev.
5. The proposed global $5 Jev spending cap is deferred. Browser credentials and direct-access requirements are specified in [jev-spec.md](jev-spec.md).
6. Assume one browser tab actively controls a match. Cross-tab synchronization is outside v1 scope.
7. Exact browser-version coverage and responsive breakpoints are implementation decisions within these device targets.

## 4. Shared user experience and game lifecycle

### 4.1 Navigation and layout

1. Display top tabs for Tic Tac Toe, Connect Four, and Chess from the first release. Tabs for unimplemented games are visible but disabled.
2. Switching between implemented games preserves each match. An outstanding CPU request continues independently of the selected game tab.
3. On desktop, show the board and a side panel for move history and analysis. The board must remain visible during review and inspection.
4. On mobile, provide collapsible history/analysis access. Its placement is an implementation choice; it may obscure part or all of the board while open.

### 4.2 Match setup and play

1. The player can choose their side and who moves first, subject to the game's rules.
2. Matches are untimed and have one difficulty. Initially the CPU chooses randomly among legal moves; once Jev is integrated, it chooses its best move according to its configured evaluation.
3. Validate human and CPU moves against the current position before applying them.
4. Display the current turn and an indicator while the CPU is thinking. Prevent additional human moves while awaiting the CPU, reviewing history, or after the match ends.
5. Detect and display wins, losses, and draws using the game's rules.
6. No undo is available.

### 4.3 Match action and confirmation

Use one action button with state-dependent behavior:

| State | Label | Behavior | Confirmation |
| --- | --- | --- | --- |
| Before any moves | Restart | Reset the match to its starting state | Never |
| Match in progress | Resign | End the match as a human resignation | Always |
| Match completed | Rematch | Replace the completed match with a new match | Never |

Move confirmation is a separate user setting, disabled by default. With confirmation disabled, a valid move selection submits immediately. With confirmation enabled, the player explicitly confirms the selected move before submission. Persist this preference locally, separately from match data.

### 4.4 Game-specific interactions

The child specs define how board clicks distinguish play from inspection, what clicking a human move reveals, and how selected turns map to displayed positions. They also define move notation, turn labels, selection highlights, latest-move feedback, and legal-destination indicators where applicable:

- [Tic tac toe interactions](tic-tac-toe-spec.md)
- [Connect Four interactions](connect-four-spec.md)
- [Chess interactions](chess-spec.md)

## 5. CPU requests, retries, and fallback

### 5.1 Turn submission

1. Apply and save a valid human move before requesting the CPU response, unless the move ends the match.
2. Use an asynchronous request/response flow. Waiting for the CPU must not freeze the interface; users may switch game tabs or review history.
3. Associate responses with a match identifier, turn number, and request-attempt identifier.
4. Only the current request for the current live position may apply a move. Discard superseded responses and responses belonging to abandoned matches.
5. A CPU response received during historical review updates and saves the live match without moving the user's historical selection. The user explicitly returns to the live position.
6. Restoring a saved match on the CPU's turn automatically issues another CPU request once the provider is ready. If Jev needs key re-entry after refresh, preserve the turn and resume automatically after the visitor supplies the key. v1 accepts the possible extra paid request to simplify recovery.

### 5.2 Manual retry and service failures

1. A Jev product attempt has a separate five-second client-side deadline covering its entire SDK call and internal retries. Expiry cancels the call and counts as one service failure. The RNG milestone retains its five-second Retry availability threshold without canceling its local provider request.
2. A manual retry supersedes the previous attempt. Only the latest attempt may apply a move.
3. A failed product attempt displays an error and offers Retry unless the third-service-failure fallback applies. Internal SDK retries remain part of the same pending attempt.
4. Manual retries and service failures do not count toward the consecutive-invalid-move limit.
5. Three consecutive Jev service failures trigger a legal RNG fallback with no Jev analysis. Authentication errors count toward this limit; rate-limit and authentication failures show toasts. A successful Jev move resets the service-failure count. SDK retry settings and counter handling are specified in [jev-spec.md](jev-spec.md).

### 5.3 Invalid CPU moves

1. Never apply an illegal CPU move. A typed response must still be checked against its intended position and that position's legal moves.
2. Retry after an invalid CPU response until there have been three consecutive invalid CPU move attempts total.
3. Reset the invalid-move counter after a valid CPU move.
4. After the third consecutive invalid attempt, surface an error and apply a random legal move.
5. For Jev's illegal-move fallback, record exactly: "Rejected illegal move attempted by Jev, fell back to random move".
6. Identify the resulting move as an RNG fallback and attach no Jev analysis to it. RNG generation itself must select only legal moves.

Jev-specific handling is detailed in [jev-spec.md](jev-spec.md).

## 6. Move history, review, and analysis

1. Maintain the complete move sequence for each current match, including enough state to reconstruct every historical position.
2. Selecting a turn displays its historical board state. Left/right controls browse turns, and a return-to-current action restores the live position.
3. Review is read-only. Users cannot branch, resume play from an old position, or undo moves.
4. Historical review remains available after completion until the match is replaced.
5. Move selection through both played pieces and history entries must provide access to the associated Jev response where applicable. Exact mapping, including human moves and repeatedly moved chess pieces, is defined in each game spec.
6. Jev move history displays decision confidence, and optional analysis shows Choice classification probabilities ranked and truncated to the top ten. Evaluate all legal choices before truncating results for display and retention. Display values to three decimal places and show a tie caution beside confidence when applicable.
7. Save the original retained analysis with its move. Reopening it does not call Jev again.
8. RNG moves have no Jev analysis and are labeled accordingly. Any development-only mock analysis must be clearly identified as mock data.

Score semantics, ranking, and ties are specified in [jev-spec.md](jev-spec.md). Historical position selection and notation are defined in [tic-tac-toe-spec.md](tic-tac-toe-spec.md), [connect-four-spec.md](connect-four-spec.md), and [chess-spec.md](chess-spec.md).

## 7. Local persistence

1. Store one current match per implemented game in browser local storage, including its live state, move sequence, retained analysis, and outcome if completed.
2. Preserve these matches across game-tab switches, page refreshes, and browser closure where browser storage persists.
3. Keep a completed match available until Rematch replaces it. Do not create a completed-match archive.
4. Store user settings separately so replacing a match does not reset preferences.
5. Recover a saved CPU turn as specified in section 5.1.
6. Proposed resilience behavior: if storage is unavailable or full, continue in memory with a notice that progress cannot be saved. If saved data is invalid or incompatible, offer a fresh start rather than crashing. This fallback was discussed but is not yet explicitly confirmed.

## 8. Architecture boundaries

Keep three responsibilities separate:

1. **Game rules and state:** Legal-move generation, move application, outcomes, and historical position reconstruction.
2. **CPU move providers:** A shared interface accepting the position and legal moves, returning a selected move plus optional retained Jev analysis. RNG, a library-based provider, and Jev can use this interface without coupling their logic to UI components.
3. **Presentation and application coordination:** Boards, controls, history, responsive layout, persistence, and orchestration of turn requests and review selection.

The CPU move handler is abstracted from UI logic. Rules remain authoritative regardless of provider. Match/request identifiers prevent delayed responses from mutating the wrong position.

Detailed provider behavior belongs in [jev-spec.md](jev-spec.md); game-specific state/rules decisions belong in the three game specs. This PRD does not mandate libraries or internal class/file structures.

## 9. Acceptance criteria

Apply each criterion when the relevant game or provider is implemented.

1. v0.5 supports a complete tic tac toe match against a CPU that selects only legal random moves.
2. All three tabs are visible; unimplemented games cannot be opened through their disabled tabs.
3. Implemented games enforce correct rules, never apply illegal moves, and identify their valid end states.
4. Side/first-player selection, untimed play, and the shared action button follow the specified behavior.
5. Moves submit without extra confirmation by default; enabling the setting adds confirmation. Resignation always requires confirmation; restart/rematch never do.
6. Switching games and refreshing preserve each current match when local storage is available. Refresh on a CPU turn requests a new response automatically once any required Jev key is supplied.
7. History selection and left/right controls show the correct saved positions without altering live play. Returning to current restores the latest live position.
8. Desktop review keeps the board visible; mobile controls and history are usable on the target devices.
9. Thinking, delayed-response retry, and explicit-error states follow section 5. Superseded responses never apply a move.
10. Three consecutive invalid CPU responses trigger a legal RNG fallback. Jev invalid-response fallback records the required exact message and has no Jev analysis. Three consecutive Jev service failures also trigger fallback, with a distinct service-failure diagnostic.
11. Jev analysis shows and retains at most ten ranked choices from an evaluation of all legal moves. Reopening analysis sends no request.
12. A completed match is reviewable until replaced, with no archive of previous matches.

Game-specific rule acceptance criteria will be expanded in each child spec. No benchmark win rate is required. Jev's five-second deadline limits client waiting and does not guarantee a successful response within that time.

## 10. Out of scope for v1

1. Application accounts, application authentication, whitelist management, backend storage, and a shared-key Jev relay. Visitor-supplied TypeSafe credentials are part of v1 Jev access.
2. Multiplayer.
3. User/global win-loss statistics.
4. Completed-match libraries and detailed match archives.
5. Export features.
6. Undo, historical branching, clocks, and selectable difficulty.
7. Dedicated keyboard gameplay and cross-browser-tab synchronization.

## 11. Assumptions and deferred decisions

1. v1 uses visitor-supplied Jev keys in the browser; direct access from the deployed origin must be verified before public Jev enablement. The global $5 spending cap is deferred.
2. The order of Connect Four, chess, and Jev implementation is intentionally flexible after v0.5.
3. Local-storage failure behavior in section 7 is a proposed default requiring confirmation.
4. Precise mobile panel placement, responsive breakpoints, and visual styling are implementation decisions.
5. Unresolved game rules and interactions remain in the child specs; they do not imply additional committed features.
6. v2 authentication, statistics, and the shared private Jev key with relay service or minimal backend require a later specification.

## 12. Supporting specifications and outline reference

| Document | Responsibility |
| --- | --- |
| [jev-spec.md](jev-spec.md) | Jev evaluation, retained analysis, API integration, spending, and service behavior |
| [tic-tac-toe-spec.md](tic-tac-toe-spec.md) | First playable game, rules, input, notation, feedback, and inspection |
| [connect-four-spec.md](connect-four-spec.md) | Connect Four rules, column input, notation, feedback, and inspection |
| [chess-spec.md](chess-spec.md) | Chess rules, piece input, notation, feedback, and inspection |

This document uses an adapted lightweight PRD outline informed by [Atlassian's product requirements guidance](https://www.atlassian.com/agile/product-management/requirements). It is not a formal standards-compliance document.
