import { describe, expect, it } from "vitest";
import { MemoryCacheStore, deserializeValue, serializeValue } from "@/server/infra/cache-store";

describe("MemoryCacheStore", () => {
  it("stores values until they expire", async () => {
    const store = new MemoryCacheStore();
    await store.set("a", { n: 1 }, 10);
    expect(await store.get("a")).toEqual({ n: 1 });
    await new Promise((r) => setTimeout(r, 15));
    expect(await store.get("a")).toBeUndefined();
  });

  it("deletes and clears", async () => {
    const store = new MemoryCacheStore();
    await store.set("a", 1, 1000);
    await store.set("b", 2, 1000);
    await store.delete("a");
    expect(await store.get("a")).toBeUndefined();
    await store.clear();
    expect(await store.get("b")).toBeUndefined();
  });
});

describe("Redis value serialisation", () => {
  it("round-trips nested dates and nulls", () => {
    const value = {
      sha: "abc",
      date: new Date("2026-09-01T10:00:00Z"),
      nested: { when: new Date("2026-01-02T03:04:05Z"), none: null, list: [1, "x"] },
    };
    const restored = deserializeValue<typeof value>(serializeValue(value));
    expect(restored.date).toBeInstanceOf(Date);
    expect(restored.date.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(restored.nested.when.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(restored.nested.none).toBeNull();
    expect(restored.nested.list).toEqual([1, "x"]);
  });

  it("leaves ISO-looking strings untouched", () => {
    const restored = deserializeValue<{ s: string }>(serializeValue({ s: "2026-09-01T10:00:00Z" }));
    expect(typeof restored.s).toBe("string");
  });
});
