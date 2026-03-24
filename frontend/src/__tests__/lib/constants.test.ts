import { describe, it, expect } from "vitest";
import {
  API_BASE,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  CURRENCY,
  LOCALE,
  ROLE_LABELS,
  STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/constants";

describe("Constants", () => {
  it("should have correct API base path", () => {
    expect(API_BASE).toBe("/api/v1");
  });

  it("should have a reasonable default page size", () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(100);
  });

  it("should have sorted page size options", () => {
    for (let i = 1; i < PAGE_SIZE_OPTIONS.length; i++) {
      expect(PAGE_SIZE_OPTIONS[i]).toBeGreaterThan(PAGE_SIZE_OPTIONS[i - 1]);
    }
  });

  it("should use EUR as currency", () => {
    expect(CURRENCY).toBe("EUR");
  });

  it("should use de-AT locale", () => {
    expect(LOCALE).toBe("de-AT");
  });
});

describe("ROLE_LABELS", () => {
  it("should have labels for all roles", () => {
    expect(ROLE_LABELS).toHaveProperty("educator");
    expect(ROLE_LABELS).toHaveProperty("location_manager");
    expect(ROLE_LABELS).toHaveProperty("admin");
    expect(ROLE_LABELS).toHaveProperty("super_admin");
  });

  it("should have non-empty labels", () => {
    Object.values(ROLE_LABELS).forEach((label) => {
      expect(label.length).toBeGreaterThan(0);
    });
  });
});

describe("STATUS_LABELS", () => {
  it("should have labels for all statuses", () => {
    expect(STATUS_LABELS).toHaveProperty("pending");
    expect(STATUS_LABELS).toHaveProperty("approved");
    expect(STATUS_LABELS).toHaveProperty("rejected");
    expect(STATUS_LABELS).toHaveProperty("cancelled");
    expect(STATUS_LABELS).toHaveProperty("draft");
  });
});

describe("TRANSACTION_TYPE_LABELS", () => {
  it("should have labels for income and expense", () => {
    expect(TRANSACTION_TYPE_LABELS).toHaveProperty("income");
    expect(TRANSACTION_TYPE_LABELS).toHaveProperty("expense");
  });

  it("should have German labels", () => {
    expect(TRANSACTION_TYPE_LABELS.income).toBe("Einnahme");
    expect(TRANSACTION_TYPE_LABELS.expense).toBe("Ausgabe");
  });
});
