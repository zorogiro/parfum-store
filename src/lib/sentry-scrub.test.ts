import { describe, expect, it } from "vitest";
import { redactText, scrubEvent, scrubUrl } from "./sentry-scrub";

describe("scrubUrl", () => {
  it("drops query and fragment but keeps the path", () => {
    expect(scrubUrl("https://shop.tn/order/confirmation?number=ORD-1&token=abc#x")).toBe(
      "https://shop.tn/order/confirmation",
    );
    expect(scrubUrl("/p/nuit-d-oud")).toBe("/p/nuit-d-oud");
  });
});

describe("redactText", () => {
  it("redacts emails, Tunisian phones and long tokens", () => {
    const token = "a".repeat(43);
    const out = redactText(`bad input for ali@example.com +21612345678 12 345 678 token ${token}`);
    expect(out).not.toMatch(/ali@|12345678|12 345 678|aaaa/);
    expect(out).toContain("bad input for");
  });

  it("keeps ordinary error text", () => {
    expect(redactText("Unique constraint failed on the fields: (`number`)")).toContain("Unique");
  });
});

describe("scrubEvent", () => {
  it("removes request data, headers, cookies, user, breadcrumbs and query strings", () => {
    const event = scrubEvent({
      message: "failed for 98765432",
      user: { email: "a@b.co", ip_address: "1.2.3.4" },
      breadcrumbs: [{ message: "x" }],
      extra: { phone: "+21612345678" },
      contexts: { request: { x: 1 }, runtime: { name: "node" } },
      transaction: "GET /suivi?phone=12345678",
      tags: { url: "https://shop.tn/suivi?number=1", other: "keep?me" },
      request: {
        url: "https://shop.tn/order/confirmation?token=secret",
        query_string: "token=secret",
        data: { phone: "+21612345678", address: "rue 1" },
        cookies: { a: "b" },
        headers: { cookie: "a=b", authorization: "x" },
        method: "POST",
      },
      exception: { values: [{ type: "Error", value: "bad phone +21612345678" }] },
    });
    expect(JSON.stringify(event)).not.toMatch(/secret|12345678|98765432|a@b\.co|1\.2\.3\.4|rue 1/);
    expect(event.request).toEqual({
      url: "https://shop.tn/order/confirmation",
      method: "POST",
    });
    expect(event.contexts).toEqual({ runtime: { name: "node" } });
    expect(event.tags.other).toBe("keep?me");
    expect(event.transaction).toBe("GET /suivi");
  });

  it("tolerates an empty event", () => {
    expect(scrubEvent({})).toEqual({});
  });
});
