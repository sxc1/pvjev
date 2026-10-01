# Jev Part 1 — Implementation using only visitor key: verification

Status on 2026-10-01: local checks passed; deployed verification remains pending. No deployment, publishing, push, or live TypeSafe credential use occurred during these checks. The source contracts and [Jev specification](jev-spec.md) define behavior; this document records the verification state.

## SDK and relay

The visitor Edge Function pins npm:@typesafe-ai/sdk@0.6.0 in [deno.json](../supabase/functions/jev-visitor/deno.json), with integrity in deno.lock. The SDK ran in Deno 2.5.3 locally. The probe verified a single move Choice question, the choice/confidence/probabilities response and top-level resolved model ID, two retries after the initial call for retryable 503 responses, and cancellation during a retry wait. The SDK reads TYPESAFE_BASE_URL from the environment even when given an explicit API key. It does not impose the product's total five-second deadline or the application's strict distribution validation; the relay handles both.

The relay checks a streamed 16 KiB body limit, 4 KiB visitor key limit, UUIDs, exact fields, game state, and the complete canonical legal move list before creating a fresh SDK client. It supplies the visitor key explicitly, uses a no-op logger, allows configured exact origins, and returns fixed safe errors with no-store. It has no shared-secret lookup. The browser provider makes one fetch per product attempt. Local SDK and handler tests used synthetic keys and mocked upstream requests; they did not contact TypeSafe.

## Local checks

The final local audit on 2026-10-01 reported:

| Check | Result |
| --- | --- |
| npm test | 31 files, 180 tests passed. |
| npm run build | TypeScript and Vite passed; Vite reported its existing 500 kB chunk advisory. The normal build was restored after synthetic testing. |
| Deno 2.5.3 handler and SDK probe tests | 9 passed, 0 failed. Run with --allow-env and the function's deno.json. |
| Synthetic browser run in installed Chrome | 41 passed using a temporary Playwright configuration with trace, video, and screenshots off. The configuration was removed. |
| git diff --check | No whitespace errors; Git emitted only line-ending notices. |

The SDK probe covers response shape, retry count, and cancellation during retry wait. Handler tests cover origin and error headers, malformed payload and Choice rejection, the deadline, supplied-key Authorization despite an environment sentinel, retries, and no fallback to an environment key when the visitor key is empty. Controller tests cover deadline boundaries, stale answers after key replacement, independent recovery counters, manual Retry after restore, missing-key wait, fallback, and historical selection. An earlier focused controller run passed 41 tests across three files; the full run above supersedes that intermediate count.

The browser run used a synthetic relay at http://127.0.0.1:4173, a synthetic publishable key, and JEV_E2E_FAKE_RELAY=1. It covered visitor play in both games, saved analysis after reload, key loss and re-entry, Connect Four color and order mapping, unchanged RNG assignment after adding a key, key replacement and manual Retry, three-failure fallback, and offline mobile review of saved analysis. The visitor key was absent from saved match data and local storage. Statistics identity has local unit coverage; signed-in visitor statistics have not been verified against a deployed service.

The default npm run test:e2e collected tests but could not launch because Playwright-managed browser binaries were absent on this host. The installed Chrome run supplies local browser coverage, but the default command remains unpassed.

## Credential audit and release checks

Source inspection found the visitor key held in a page-session closure and copied only into transient controller/provider input and the visitor POST body. The key input is masked, has autocomplete off, and clears its draft after save, clear, or unmount. The normal production bundle was searched for synthetic test keys, JEV_SHARED_API_KEY, and @typesafe-ai/sdk; none appeared. This static check is not a live traffic or platform-log audit.

Before marking the visitor release gate passed:

1. Deploy the function and site to an approved staging or target environment. Record exact versions and Edge runtime.
2. From the deployed origin, verify guest preflight, success and error CORS, valid and invalid disposable TypeSafe keys, rejected game and override payloads, resolved model presence, retry count, and cancellation. Record redacted statuses and results. Disable HAR, traces, video, body capture, and raw exception logging for credential tests.
3. Inspect browser storage, production bundle, application and platform logs, error reporting, and test artifacts after live calls for credential leakage.
4. With disposable accounts, verify signed-in visitor play, account-at-completion statistics, and that a prior guest result is not credited retroactively.

Local synthetic and mocked checks do not establish these deployed results.

