# Chess specification

Status: Initial requirements and open questions. Shared behavior is defined in [product-spec.md](product-spec.md); Jev behavior is defined in [jev-spec.md](jev-spec.md).

## Agreed requirements

1. Display the game tab from v0.5, disabled until implemented. Schedule implementation after tic tac toe, with order relative to Connect Four and Jev determined later.
2. The player can choose their side and who moves first according to the game rules.
3. Apply shared controls, confirmation preference, history review, local persistence, and CPU abstraction.
4. Review is read-only with left/right navigation and a return-to-current action. Play is untimed with one difficulty.
5. Export features are out of v1 scope.

## Questions to resolve before implementation

1. Specify complete rules coverage for castling, en passant, promotion, check, checkmate, stalemate, and other draw conditions, including automatic versus claimable draws.
2. Which rules library, if any, will enforce legality independently of the CPU provider?
3. How is side selection presented, and should the board automatically face the human player's side?
4. Support click/tap source and destination, drag-and-drop, or both? How does promotion selection work?
5. How does clicking a piece distinguish selecting it to move from inspecting its history? Is an explicit review mode needed?
6. A piece may have moved repeatedly: does inspection open its latest move or a list? How are captures and promoted pieces represented in inspection?
7. Does selecting a history entry show the position before or after the individual move? How are half-moves, move pairs, and the initial position navigated?
8. Does selecting a human move show the subsequent Jev response? What appears for terminal moves or pending responses?
9. Use standard algebraic notation? Show board coordinates and captured pieces? How are turns and players labeled?
10. How are current turn, selection, latest move, legal destinations, check, and pending confirmation displayed?
11. Which provider should be used when chess first becomes playable: RNG, a library-based CPU, or Jev if already integrated?
12. Are draw offers supported? What controls handle claimable draws without altering the shared Restart/Resign/Rematch button?
13. What is shown when a selected move has no Jev analysis? Are position imports deferred along with exports?

## Rule acceptance coverage to define

Cover legal movement, king safety, all special moves, promotion choices, checkmate, stalemate, applicable draw rules, and prevention of moves after completion.
