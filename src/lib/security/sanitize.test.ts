// Security Utilities Tests
// FASE 46: Tests for sanitization and validation helpers.

import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  sanitizeObject,
  isValidAgentId,
  isAcceptableSize,
} from "./sanitize";

describe("sanitizeInput", () => {
  it("strips HTML tags and encodes special chars", () => {
    expect(sanitizeInput("<script>alert('xss')</script>")).toBe("alert(&#39;xss&#39;)");
  });

  it("encodes special characters", () => {
    expect(sanitizeInput('Tom & Jerry "show"')).toBe("Tom &amp; Jerry &quot;show&quot;");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("handles nested tags", () => {
    expect(sanitizeInput("<div><b>bold</b></div>")).toBe("bold");
  });

  it("passes clean strings through", () => {
    expect(sanitizeInput("hello world")).toBe("hello world");
  });
});

describe("sanitizeObject", () => {
  it("sanitizes string values", () => {
    const result = sanitizeObject({ name: "<b>test</b>" });
    expect(result.name).toBe("test");
  });

  it("sanitizes nested objects", () => {
    const result = sanitizeObject({
      outer: { inner: '<img src=x onerror=alert(1)>' },
    });
    expect(result.outer.inner).toBe("");
  });

  it("sanitizes arrays of strings", () => {
    const result = sanitizeObject({ tags: ["<script>x</script>", "safe"] });
    expect(result.tags).toEqual(["x", "safe"]);
  });

  it("leaves non-string values unchanged", () => {
    const result = sanitizeObject({ count: 42, enabled: true });
    expect(result.count).toBe(42);
    expect(result.enabled).toBe(true);
  });
});

describe("isValidAgentId", () => {
  it("accepts valid IDs", () => {
    expect(isValidAgentId("product-hunter")).toBe(true);
    expect(isValidAgentId("ceo")).toBe(true);
    expect(isValidAgentId("agent-01")).toBe(true);
  });

  it("rejects invalid IDs", () => {
    expect(isValidAgentId("Product Hunter")).toBe(false); // uppercase
    expect(isValidAgentId("agent_01")).toBe(false); // underscore
    expect(isValidAgentId("agent/../../etc")).toBe(false); // path traversal
    expect(isValidAgentId("a".repeat(101))).toBe(false); // too long
  });
});

describe("isAcceptableSize", () => {
  it("accepts small payloads", () => {
    expect(isAcceptableSize({ name: "test" })).toBe(true);
  });

  it("rejects oversized payloads", () => {
    expect(isAcceptableSize({ data: "x".repeat(200_000) }, 1000)).toBe(false);
  });

  it("handles nested objects", () => {
    expect(isAcceptableSize({ a: { b: { c: 1 } } })).toBe(true);
  });
});
