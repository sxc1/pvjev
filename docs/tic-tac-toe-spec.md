# Product requirements: Tic tac toe

Status: Agreed requirements for the first playable game. Shared behavior is defined in [product-spec.md](product-spec.md); future Jev behavior is defined in [jev-spec.md](jev-spec.md).

## 1. Product overview

Tic tac toe is the first playable game in Play vs Jev. A human plays a standard 3 by 3 match against a CPU and can inspect individual moves and their historical positions.

This document defines game rules, setup, interactions, notation, visual feedback, and acceptance criteria. The shared specification governs layout, match actions, CPU requests, confirmation preferences, and persistence.

## 2. Release scope

1. v0.5 supports complete matches against a CPU choosing randomly among legal moves.
2. Include side selection, optional move confirmation, read-only history review, and local persistence.
3. When Jev is integrated, selecting a Jev move also displays its saved choice scores. Jev analysis is not required for v0.5.
4. Initially use cell background colors to mark winning lines. Image assets are a later enhancement.

## 3. Rules and match setup

1. Play on nine cells arranged in three rows and three columns.
2. Before each match, the human chooses X or O. The CPU takes the other side.
3. X always moves first. Choosing O causes the CPU to open; there is no independent first-player selection.
4. Players alternate placing one symbol in an empty cell. Symbols never move or change ownership.
5. Three matching symbols in any row, column, or diagonal win. There are eight possible winning lines.
6. A full board without a winner is a draw. Check for a win before declaring a draw.
7. A win, draw, or resignation ends play. No further moves may be applied.
8. Rematch replaces the completed match and returns to side selection before the next match starts.
9. Apply the shared Restart, Resign, and Rematch actions and confirmation rules. Matches are untimed, with no undo or selectable difficulty.

## 4. Board interaction and confirmation

### 4.1 Playing and inspecting

1. In the live position, clicking or tapping an empty cell selects a move when it is the human's turn and the match is in progress.
2. With confirmation disabled, a legal selection submits immediately.
3. Clicking or tapping an occupied cell selects the move that placed its symbol, highlights that symbol, and displays the board immediately after that move. It never overwrites a symbol or submits a move.
4. Occupied-cell selection enters read-only review without requiring a separate review-mode toggle.
5. Empty-cell clicks during review cannot play a move. The user must return to current before continuing play.
6. Prevent human moves while awaiting the CPU or after completion. Inspection remains available.

### 4.2 Confirming a move

1. Apply the shared confirmation preference, disabled by default and persisted separately from match data.
2. When enabled, selecting an empty cell displays a preview symbol with a slow fading blink animation and reveals a **Confirm move** button.
3. Selecting another empty cell moves the pending preview to that cell.
4. Only **Confirm move** commits the pending move. Until then, the live position, history, and CPU turn remain unchanged.
5. Entering historical review clears the pending selection and hides the confirmation button.
6. Validate the pending move against the live position before committing it.

## 5. Coordinates and notation

1. Columns A, B, and C run left to right. Rows 1, 2, and 3 run bottom to top, like a chessboard.
2. Identify a cell with its column followed by its row, such as A1 or C3.
3. Turns are numbered 1, 2, 3, and so on. Each consists of an X move followed by an O move, unless the match ends before O moves.
4. Label individual moves `1x`, `1o`, `2x`, `2o`, and so on. Each history entry includes the label and cell, for example `1x A1`.
5. Left/right navigation steps through individual moves, not pairs.

## 6. History, review, and analysis

1. Selecting a history entry or occupied cell displays the position immediately after that individual move.
2. Highlight the selected historical move in yellow. Do not show symbols from later moves.
3. Do not offer the initial empty position as a history entry or navigation destination.
4. The shared return-to-current action restores the latest live position and its blue latest-move highlight.
5. Selecting a human move shows only its highlight and historical board position. It shows no Jev information and does not select the subsequent CPU response.
6. Selecting an RNG move shows its historical board position without choice scores. Identify RNG moves according to the shared specification.
7. Once Jev is implemented, selecting a Jev move displays its saved choice scores. The scores describe choices available before that move; the displayed board shows the position after it.
8. Apply the shared analysis rules: evaluate all legal choices, retain at most the top ten, and reopen saved analysis without another Jev request. Tic tac toe has at most nine legal choices.
9. Review is read-only during and after a match. Completion does not change the position or analysis associated with a selected move.
10. A CPU response received during review updates and saves the live match without changing the historical selection. Returning to current reveals the updated position.
11. Keep a completed match reviewable until Rematch replaces it. No completed-match archive is required.

## 7. Status and visual feedback

1. Place the **Your turn** / **CPU thinking** label at the top. It reflects the live match; display the result when the match ends.
2. Highlight the most recent move in blue when showing the live position.
3. Selecting a move for historical review switches the selected-move highlight to yellow.
4. Pending confirmation uses the slow fading blink preview and is not treated as a committed latest move.
5. Fill winning cells' backgrounds green if the human won and red if the CPU won. Mark all winning lines formed by the final move.
6. Keep the blue latest-move or yellow selected-move highlight distinguishable when it overlaps a winning cell. Exact styling is an implementation choice.
7. Show winning backgrounds only in historical positions containing the winning line, not in earlier positions.
8. Display draws and resignations through the shared result presentation; neither creates a winning line.

## 8. Shared integration and persistence

1. Keep deterministic rules, CPU providers, and presentation separate. Validate human and CPU moves using the same rules.
2. Apply the shared asynchronous request flow, retries, invalid-move handling, and stale-response protection.
3. Persist the current match, chosen sides, live position, complete move sequence, retained analysis, and outcome according to the shared specification.
4. Preserve the match across game-tab switches and refreshes. Restore CPU turns using the shared recovery behavior.
5. Apply the shared desktop and mobile layouts, touch-friendly controls, and history/analysis access.

## 9. Acceptance criteria

1. Choosing X starts with the human; choosing O starts with the CPU. X always opens.
2. A legal move places exactly one symbol in an empty cell and advances play unless the match ends.
3. Occupied cells cannot be overwritten. Selecting one instead shows the position after its original move and highlights that move.
4. Each of the three rows, three columns, and two diagonals can produce a win for either side. A final move completing multiple lines marks each one.
5. A full board without a winner is a draw; a winning final placement is a win rather than a draw.
6. No human or CPU move can be applied after a win, draw, or resignation.
7. Confirmation disabled submits immediately. Confirmation enabled shows a slowly fading blink preview, allows changing the selected empty cell, and commits only through **Confirm move**. Entering review clears it.
8. Coordinates and labels follow section 5. History navigation visits individual post-move positions and excludes the initial empty board.
9. Cell and history selection reconstruct the correct position without modifying the live match. Empty-cell clicks in review cannot submit moves.
10. Human and RNG move inspection shows no Jev scores. Jev move inspection shows saved scores without issuing another request.
11. The top status label, blue latest-move highlight, yellow review highlight, and human-green/CPU-red winning backgrounds follow section 7, including overlapping highlights.
12. A CPU response during review updates only the live match; return-to-current reveals the latest position.
13. A completed match remains reviewable until Rematch replaces it and returns to side selection.
14. A complete RNG match can be played and restored using shared persistence behavior. CPU moves are always legal.

## 10. Out of scope and deferred details

1. Alternative board sizes or win conditions, independent first-player selection, multiplayer, undo, and historical branching.
2. Access to the initial empty position through history.
3. Jev information when selecting a human move, including analysis of the subsequent response.
4. Winning-line image assets in the initial release.
5. Exact animation timing and highlight styling are implementation decisions within these requirements. Jev score semantics and service integration remain in [jev-spec.md](jev-spec.md).
