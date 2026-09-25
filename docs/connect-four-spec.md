# Product requirements: Connect Four

Status: Draft for review. Shared behavior is defined in [product-spec.md](product-spec.md); Jev behavior is defined in [jev-spec.md](jev-spec.md).

## 1. Product overview

Connect Four is a playable match between a human and a CPU on a seven-column, six-row board. The human chooses a color and move order, drops pieces into columns, and can review individual moves and their historical positions. When Jev is integrated, its saved choice scores are available on applicable CPU moves.

This document defines Connect Four rules, setup, input, notation, visual feedback, and acceptance criteria. The shared specification governs layout, match actions, CPU requests, confirmation preferences, and persistence.

## 2. Release scope

1. Show the Connect Four tab from v0.5, disabled until the game is implemented. Implement it after tic tac toe; its order relative to chess and Jev remains flexible.
2. The first playable version uses a CPU that chooses randomly among legal columns. Jev behavior applies when that provider is integrated.
3. Include color and move-order selection, optional move confirmation, read-only history review, and local persistence.
4. Falling-piece animation, multiplayer, undo, difficulty selection, and a completed-match archive are outside this scope.

## 3. Rules and match setup

1. Use seven columns and six rows. A move chooses one non-full column; gravity places the piece in its lowest empty cell.
2. The human chooses red or yellow and first or second independently. The CPU uses the other color. Either color may open.
3. Present setup as two rows of choices, one for color and one for move order, using the tic tac toe setup style. Show the choices before each new match.
4. Players alternate placing one piece per move. A placed piece stays in its cell and retains its color.
5. Four or more connected pieces of one color horizontally, vertically, or diagonally win. Check for a win before declaring a draw.
6. A full board without a winner is a draw. A win, draw, or resignation ends the match; no further moves may be applied.
7. Rematch replaces the completed match and returns to setup. Apply the shared Restart, Resign, and Rematch actions and confirmation rules. Matches are untimed.

## 4. Board interaction and confirmation

### 4.1 Playing a column

1. In the live position, a human can select a non-full column only on the human's turn while the match is ongoing. The selection targets that column's current landing cell.
2. With move confirmation disabled, pressing or touching the board previews a piece in the landing cell. Holding and dragging between columns updates the preview. Releasing over a legal column commits the move in that column; an ordinary click or tap commits on release.
3. Releasing outside the board or over a full column cancels the transient preview without making a move. Full columns are unselectable and provide no message or animation.
4. The release position determines the chosen column, even if the press began on another column or on an occupied piece. Selecting an occupied piece for inspection requires review mode.
5. Prevent human moves while waiting for the CPU, during historical review, and after match completion. Do not show available-column indicators.

### 4.2 Confirming a move

1. Apply the shared confirmation preference, disabled by default and persisted separately from match data.
2. With confirmation enabled, selecting a legal column shows the human piece in its landing cell with the tic tac toe slow fading blink and reveals a **Confirm move** button. Selecting another legal column moves the pending preview.
3. Only **Confirm move** commits a pending move. Until then, the live position, history, and CPU turn remain unchanged. Validate the pending column against the current live position before committing.
4. Entering review clears the pending preview and hides the confirmation button. A full column never becomes a pending move.
5. The hold-and-drag preview used when confirmation is disabled is transient. The slow fading blink and Confirm move button apply only when confirmation is enabled.

## 5. Coordinates and notation

1. Columns A through G run left to right. Rows 1 through 6 run bottom to top, matching tic tac toe's coordinate direction. A piece first dropped in the leftmost column lands at A1.
2. Each history entry includes its turn label and landing coordinate, for example `1r A1`.
3. Number pairs of moves 1, 2, 3, and so on. Suffix each individual move with its color: `r` for red and `y` for yellow. The first and second moves share turn number 1, the third and fourth share turn number 2, and so on.
4. The chosen first color sets suffix order. Red first produces `1r, 1y, 2r, 2y`; yellow first produces `1y, 1r, 2y, 2r`.
5. Show player color in move history. Left/right review navigation advances one individual move at a time, not a pair.

## 6. History, review, and analysis

1. A magnifying glass button toggles review mode. Turning it on immediately shows the review UI and selects the most recently played piece. If no move has been played, there is no selected piece or historical position to display.
2. While review mode is on, clicking or tapping an occupied piece selects the move that placed it and displays the position immediately after that move. The selected piece is highlighted. Board interaction cannot place a move during review.
3. History entries and previous/next controls can also enter review directly. They display the position immediately after the selected individual move. The initial empty position is not a history entry or navigation destination.
4. Turning review mode off or using **Return to current** restores the live position and its latest-move highlight. A new match begins in live mode.
5. Selecting a human move displays only its historical position and piece highlight, without CPU information or an automatic selection of the subsequent CPU response. A human terminal move behaves the same way.
6. Selecting an RNG move displays its historical position without choice scores and identifies it according to the shared specification. A pending CPU response has no piece to select.
7. Once Jev is implemented, selecting a Jev move shows its saved choice scores. The scores describe choices available before the selected move; the board shows the position after it. Retain at most the top ten choices after evaluating all legal choices. Reopening saved analysis makes no new Jev request.
8. When a selected move has no Jev analysis, use the same presentation as tic tac toe. Review remains read-only during and after a match.
9. A CPU response received during review updates and saves the live match without changing the historical selection. Returning to current reveals the updated position. Keep completed matches reviewable until Rematch replaces them.

## 7. Status and visual feedback

1. Place the live-match status above the board as in tic tac toe: **Your turn**, **CPU is thinking**, **Victory**, **Defeat**, or **Draw**, as applicable. Service error and retry states follow the shared specification.
2. Highlight the most recent move blue when showing the live position. Highlight the selected piece purple when reviewing a move. Do not show pieces from later moves in a historical position.
3. Highlight every winning line formed by the final move green for a human victory or red for a CPU victory. Preserve a visible distinction when a latest or selected piece overlaps a winning cell.
4. Show winning highlights only in historical positions containing that winning line. Draws and resignations create no winning line.
5. Do not animate pieces falling. Respect reduced-motion preferences for the confirmation blink; exact timing and styling are implementation choices.

## 8. Shared integration, library, and persistence

1. Use [`@devshareacademy/connect-four`](https://github.com/devshareacademy/connect-four) for core Connect Four game logic. Its first/second player values map to the chosen colors. It accepts a column move and returns the landing coordinate; user-facing color labels and turn notation belong to this application. Verify that its winning-cell output covers every line formed by a final move; derive any additional winning highlights from the resulting board if needed.
2. Store the chosen color, move order, complete move sequence, live position, outcome, and any retained Jev analysis. Reconstruct historical positions from move prefixes without changing the live match.
3. Validate human and CPU moves against the current position. Preserve deterministic rules, CPU providers, and presentation as separate responsibilities.
4. Apply the shared asynchronous CPU request flow, retries, invalid-move handling, and stale-response protection. Preserve the match across game-tab switches and refreshes, and recover CPU turns according to the shared specification.
5. Apply shared desktop and mobile layouts, touch-friendly controls, and history/analysis access. Pointer and touch dragging must work without the page scrolling in place of the gesture.

## 9. Acceptance criteria

1. Any combination of human color and move order starts correctly. The CPU takes the opposite color, and either red or yellow can make the first move.
2. Every legal move lands in the lowest empty cell of its selected column. A full column cannot change the board or history.
3. Horizontal, vertical, and both diagonal four-in-a-row wins are detected for either color. If a move completes multiple winning lines, all are marked. A winning last placement takes precedence over a full-board draw.
4. A full board without a winner is a draw. No human or CPU move can be applied after a win, draw, or resignation.
5. With confirmation disabled, press-and-hold previews the landing cell, dragging updates it, and release over a legal column places exactly one piece there. Release outside the board or over a full column cancels. A normal click or tap places on release.
6. With confirmation enabled, a legal selection shows the blinking pending piece; changing columns moves it; only **Confirm move** commits it. Entering review clears it. Full columns cannot be pending or confirmed.
7. Coordinates and turn labels follow section 5 for either starting color. History navigation visits individual post-move positions and excludes the initial board.
8. Enabling review with at least one move selects the last played piece. Piece selection, history selection, and previous/next navigation show the correct historical position without modifying the live match. Turning review off or returning to current restores the live position.
9. Human and RNG move inspection shows no Jev scores. Jev move inspection shows saved scores without another request. A pending CPU response presents no selectable piece.
10. Live status, blue latest-move highlight, purple reviewed-piece highlight, and human-green/CPU-red winning highlights follow section 7, including overlapping highlights and historical positions.
11. A CPU response during review updates only the live match. A completed match remains reviewable until Rematch replaces it.
12. A complete RNG match can be played and restored using shared persistence behavior. CPU moves are always legal.

## 10. Out of scope and deferred details

1. Alternative board sizes or win conditions, multiplayer, undo, historical branching, clocks, and selectable difficulty.
2. Access to the initial empty position through history; automatic display of a subsequent CPU response when selecting a human move.
3. Falling-piece animation, winning-line image assets, and a completed-match archive.
4. Exact animation timing, breakpoint sizes, and highlight styling are implementation choices within these requirements. Jev score semantics and service integration remain in [jev-spec.md](jev-spec.md).
