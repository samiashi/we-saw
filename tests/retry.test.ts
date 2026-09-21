import { describe, expect, it } from "vitest";
import { retryWrite, withRetry } from "@/lib/retry";

describe("withRetry", () => {
  it("retries retryable results with backoff", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        return calls < 3
          ? { error: { message: "upstream" }, status: 503 }
          : { error: null, status: 200 };
      },
      (value) => Boolean(value.error),
      { attempts: 3, baseDelayMs: 1 },
    );

    expect(calls).toBe(3);
    expect(result.error).toBeNull();
  });

  it("returns non-retryable results immediately", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        return { error: { message: "denied" }, status: 403 };
      },
      (value) => Boolean(value.error) && value.status >= 500,
      { attempts: 3, baseDelayMs: 1 },
    );

    expect(calls).toBe(1);
    expect(result.error?.message).toBe("denied");
  });

  it("retries thrown errors and gives up on the last attempt", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("network");
        },
        () => true,
        { attempts: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("network");
    expect(calls).toBe(2);
  });
});

describe("retryWrite", () => {
  it("retries server and network failures, not client errors", async () => {
    let networkCalls = 0;
    const network = await retryWrite(
      async () => {
        networkCalls += 1;
        return networkCalls < 2
          ? { error: { message: "TypeError: Failed to fetch" }, status: 0 }
          : { error: null, status: 200 };
      },
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(networkCalls).toBe(2);
    expect(network.error).toBeNull();

    let deniedCalls = 0;
    const denied = await retryWrite(
      async () => {
        deniedCalls += 1;
        return { error: { message: "row level security" }, status: 401 };
      },
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(deniedCalls).toBe(1);
    expect(denied.error?.message).toBe("row level security");
  });
});
