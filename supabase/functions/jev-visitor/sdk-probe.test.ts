// V0 compatibility probe: synthetic key, mocked HTTP transport, no live credentials.
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const request = {
  state: { game: "tic-tac-toe", board: [null, null, null] },
  model: "jev-latest",
  questions: { move: choice("Choose a legal move", {
    "cell-0": "Place X at A3.",
    "cell-1": "Place X at B3.",
  }) },
};
function success() {
  return new Response(JSON.stringify({
    answers: { move: {
      type: "choice", choice: "cell-0", confidence: 0.8,
      probabilities: { "cell-0": 0.7, "cell-1": 0.3 },
    } },
    model: "jev-resolved-probe",
    usage: { inputTokens: 1, outputTokens: 1 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}
function unavailable() {
  return new Response("{}", {
    status: 503,
    headers: { "content-type": "application/json", "retry-after-ms": "1200" },
  });
}
function client(fetchImpl: typeof fetch, retry = { maxRetries: 2, maxRetryAfterMs: 1500 }) {
  return new TypeSafeClient({
    apiKey: "synthetic-probe-key", fetch: fetchImpl,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    retry,
  });
}

Deno.test("Choice request, result and resolved model survive Deno import", async () => {
  let calls = 0;
  const sdk = client((async (_url: string | URL | Request, init?: RequestInit) => {
    calls++;
    const payload = JSON.parse(String(init?.body));
    check(payload.model === "jev-latest", "model alias was not sent");
    check(Object.keys(payload.questions).join() === "move", "unexpected question");
    check(payload.questions.move.type === "choice", "Choice request changed");
    check(Object.keys(payload.questions.move.criteria).join() === "cell-0,cell-1", "criteria changed");
    return success();
  }) as typeof fetch);
  const result = await sdk.systemOne(request);
  check(calls === 1, "success should use one upstream call");
  check(result.answers.move.choice === "cell-0", "Choice answer missing");
  check(result.answers.move.confidence === 0.8, "confidence missing");
  check(result.answers.move.probabilities["cell-1"] === 0.3, "probabilities missing");
  check(result.model === "jev-resolved-probe", "resolved model missing");
});

Deno.test("maxRetries 2 permits exactly three upstream calls", async () => {
  const counts: string[] = [];
  const sdk = client((async (_url: string | URL | Request, init?: RequestInit) => {
    counts.push(new Headers(init?.headers).get("X-TypeSafe-Retry-Count") ?? "initial");
    return counts.length < 3 ? unavailable() : success();
  }) as typeof fetch);
  await sdk.systemOne(request, {
    retry: { maxRetries: 2, maxRetryAfterMs: 1500, backoffInitialMs: 1, backoffJitter: 0 },
  });
  check(counts.join() === "initial,1,2", `unexpected retries: ${counts.join()}`);
});

Deno.test("abort cancels the pending retry wait", async () => {
  let calls = 0;
  const controller = new AbortController();
  const sdk = client((async () => {
    calls++;
    return unavailable();
  }) as typeof fetch);
  const started = performance.now();
  const pending = sdk.systemOne(request, { signal: controller.signal });
  setTimeout(() => controller.abort(), 30);
  let name = "";
  try { await pending; } catch (error) {
    name = error instanceof Error ? error.name : "unknown";
  }
  check(name === "APIUserAbortError", `unexpected abort result: ${name}`);
  check(calls === 1, `abort failed to stop retries: ${calls}`);
  check(performance.now() - started < 1000, "retry wait did not stop promptly");
});
