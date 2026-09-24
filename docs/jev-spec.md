# Jev specification

Status: Initial requirements and open questions. Shared requirements are defined in [product-spec.md](product-spec.md).

## Agreed requirements

1. Integrate Jev as a CPU provider separate from UI and game rules, after the RNG tic tac toe milestone. Its implementation order relative to the other games remains flexible.
2. Evaluate all legal choices and choose the best move under the configured evaluation. Display and retain only the top ten scored/ranked choices as optional analysis.
3. Do not add confidence, explanations, or other analysis fields to the product's optional analysis scope.
4. Preserve original retained analysis with the move; inspection does not request another evaluation.
5. Use asynchronous requests with match, turn, and attempt identifiers. Validate responses before application.
6. After five seconds without a response, offer manual Retry. Explicit failures immediately offer Retry. A retry supersedes its predecessor.
7. After three consecutive invalid CPU responses total, show an error and make a random legal move. Record exactly: "Rejected illegal move attempted by Jev, fell back to random move". Identify the move as RNG fallback with no Jev analysis.
8. Manual retries and service failures do not count as illegal-move attempts.
9. Refreshing during a saved CPU turn automatically requests a response again; duplicate request cost is accepted for v1.
10. v1 has no backend, is public on GitHub Pages, and has a $5 Jev spending cap. Browser access and provider-side cap feasibility are accepted planning assumptions.

## Open questions for integration

1. Should Jev choose among legal moves using Choice probabilities, independently score each move, or use multiple evaluations? What questions and instructions define the best move?
2. What board representation and history should be included in the request?
3. What precisely does the displayed score mean, and what label avoids confusing it with a chance of winning?
4. How are ties ordered and resolved? What precision should scores display?
5. Which model and question configuration should be used? How is configuration versioned internally for reproducibility?
6. How will direct browser access, credentials, and the hard global $5 cap work? What should users see when the cap is exhausted?
7. What request timeout applies? How are rate limits and authentication/service errors presented? Should repeated service failures eventually offer or trigger RNG fallback?
8. How will SDK-level retries, if any, interact with the product's explicit retry rules?

## References

- [Jev introduction](https://docs.typesafe.ai/introduction)
- [Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [API quick start](https://docs.typesafe.ai/introduction/quickstart)
