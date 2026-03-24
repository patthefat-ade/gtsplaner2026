import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "@/hooks/use-debounce";

describe("useDebounce", () => {
  it("should return the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("should debounce value changes", async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "hello", delay: 300 } }
    );

    expect(result.current).toBe("hello");

    // Change value
    rerender({ value: "world", delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe("hello");

    // Advance timer by 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now value should be updated
    expect(result.current).toBe("world");

    vi.useRealTimers();
  });

  it("should cancel previous timer on rapid changes", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    // Rapid changes
    rerender({ value: "ab", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "abc", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "abcd", delay: 300 });

    // Still the initial value because timer keeps resetting
    expect(result.current).toBe("a");

    // Advance past the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should have the final value
    expect(result.current).toBe("abcd");

    vi.useRealTimers();
  });

  it("should use default delay of 300ms", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: "initial" } }
    );

    rerender({ value: "updated" });

    // Not yet updated
    expect(result.current).toBe("initial");

    // Advance 299ms - still not updated
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("initial");

    // Advance 1 more ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("updated");

    vi.useRealTimers();
  });

  it("should work with number values", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 42 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(42);

    vi.useRealTimers();
  });
});
