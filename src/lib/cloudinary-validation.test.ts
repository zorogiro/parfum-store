import { describe, expect, it } from "vitest";
import { isProductImagePublicId, isProductImageUrl } from "./cloudinary-validation";

describe("isProductImagePublicId", () => {
  it("accepts ids inside store/products", () => {
    expect(isProductImagePublicId("store/products/abc123_X-y")).toBe(true);
  });

  it.each([
    ["other folder", "store/avatars/abc"],
    ["no folder", "abc"],
    ["root-level lookalike", "xstore/products/abc"],
    ["sub-folder", "store/products/sub/abc"],
    ["path traversal", "store/products/../secret"],
    ["empty name", "store/products/"],
    ["whitespace", "store/products/a b"],
    ["url", "https://evil.com/store/products/abc"],
    ["trailing newline", "store/products/abc\n"],
    ["empty", ""],
  ])("rejects %s", (_label, id) => {
    expect(isProductImagePublicId(id)).toBe(false);
  });
});

describe("isProductImageUrl", () => {
  const cloud = "demo";
  const id = "store/products/abc123";
  const base = "https://res.cloudinary.com/demo/image/upload";

  it("accepts the delivery URL with or without version and extension", () => {
    expect(isProductImageUrl(`${base}/v1700000000/${id}.jpg`, cloud, id)).toBe(true);
    expect(isProductImageUrl(`${base}/${id}.webp`, cloud, id)).toBe(true);
    expect(isProductImageUrl(`${base}/${id}`, cloud, id)).toBe(true);
  });

  it.each([
    ["other host", `https://evil.com/demo/image/upload/${id}.jpg`],
    ["http", `http://res.cloudinary.com/demo/image/upload/${id}.jpg`],
    ["other cloud", `https://res.cloudinary.com/other/image/upload/${id}.jpg`],
    ["other public id", `${base}/store/products/zzz.jpg`],
    ["transformation segment", `${base}/w_1,h_1/${id}.jpg`],
    ["query string", `${base}/${id}.jpg?x=1`],
    ["credentials trick", `https://res.cloudinary.com@evil.com/demo/image/upload/${id}.jpg`],
    ["not a url", "javascript:alert(1)"],
  ])("rejects %s", (_label, url) => {
    expect(isProductImageUrl(url, cloud, id)).toBe(false);
  });

  it("rejects when the public id is outside our folder or the cloud name is empty", () => {
    expect(isProductImageUrl(`${base}/other/abc.jpg`, cloud, "other/abc")).toBe(false);
    expect(isProductImageUrl(`${base}/${id}.jpg`, "", id)).toBe(false);
  });
});
