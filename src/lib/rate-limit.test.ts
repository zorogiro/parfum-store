import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "./rate-limit";

function setup() {
  let time = 1_000_000;
  const limiter = new InMemoryRateLimiter({
    maxFailures: 5,
    windowMs: 15 * 60 * 1000,
    now: () => time,
  });
  return { limiter, advance: (ms: number) => (time += ms) };
}

async function fail(limiter: InMemoryRateLimiter, key: string, times: number) {
  for (let i = 0; i < times; i++) await limiter.recordFailure(key);
}

describe("InMemoryRateLimiter", () => {
  it("does not block before 5 failures", async () => {
    const { limiter } = setup();
    await fail(limiter, "a", 4);
    expect(await limiter.isBlocked("a")).toBe(false);
  });

  it("blocks after 5 failures", async () => {
    const { limiter } = setup();
    await fail(limiter, "a", 5);
    expect(await limiter.isBlocked("a")).toBe(true);
  });

  it("stays blocked until the window ends, then resets", async () => {
    const { limiter, advance } = setup();
    await fail(limiter, "a", 5);
    advance(15 * 60 * 1000 - 1);
    expect(await limiter.isBlocked("a")).toBe(true);
    advance(1);
    expect(await limiter.isBlocked("a")).toBe(false);
    await fail(limiter, "a", 4);
    expect(await limiter.isBlocked("a")).toBe(false);
  });

  it("keeps separate counters per key", async () => {
    const { limiter } = setup();
    await fail(limiter, "1.1.1.1|a@x.com", 5);
    expect(await limiter.isBlocked("1.1.1.1|a@x.com")).toBe(true);
    expect(await limiter.isBlocked("1.1.1.1|b@x.com")).toBe(false);
    expect(await limiter.isBlocked("2.2.2.2|a@x.com")).toBe(false);
  });

  it("reset clears the counter", async () => {
    const { limiter } = setup();
    await fail(limiter, "a", 5);
    await limiter.reset("a");
    expect(await limiter.isBlocked("a")).toBe(false);
  });
});
