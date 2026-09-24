# Connect Four specification

Status: Initial requirements and open questions. Shared behavior is defined in [product-spec.md](product-spec.md); Jev behavior is defined in [jev-spec.md](jev-spec.md).

## Agreed requirements

1. Display the game tab from v0.5, disabled until implemented. Schedule implementation after tic tac toe, with order relative to chess and Jev determined later.
2. The player can choose their side and who moves first according to the game rules.
3. Apply shared controls, confirmation preference, history review, local persistence, and CPU abstraction.
4. Review is read-only with left/right navigation and a return-to-current action.

## Questions to resolve before implementation

1. Confirm seven columns, six rows, gravity-based placement, and four in a row to win.
2. How are color and first-player choices presented?
3. Does tapping/clicking a column preview the landing cell? How are full columns indicated?
4. How does clicking an occupied piece for inspection differ from clicking its column to play? Is an explicit review mode needed?
5. Does selecting a history entry show the position before or after that individual move? How is the initial position accessed?
6. Does selecting a human piece/move show the subsequent Jev response? What appears for a terminal move or a pending response?
7. Does move notation include column only or column and row? How are turns numbered and players labeled?
8. How are current turn, selected piece, last move, available columns, pending confirmation, and winning line displayed?
9. Is a falling-piece animation desired, and how should reduced-motion preferences affect it?
10. What is shown when a selected move has no Jev analysis?

## Rule acceptance coverage to define

Cover gravity, full-column rejection, horizontal/vertical/diagonal wins, draws, and prevention of moves after completion.
