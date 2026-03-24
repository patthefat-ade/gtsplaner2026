import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  formatDuration,
  formatUserName,
  getInitials,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("should format a number as EUR currency", () => {
    const result = formatCurrency(1234.56);
    // de-AT locale uses € with specific formatting
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("€");
  });

  it("should format a string number as EUR currency", () => {
    const result = formatCurrency("99.99");
    expect(result).toContain("99");
    expect(result).toContain("€");
  });

  it("should format zero correctly", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
    expect(result).toContain("€");
  });

  it("should format negative values", () => {
    const result = formatCurrency(-50);
    expect(result).toContain("50");
    expect(result).toContain("€");
  });
});

describe("formatDate", () => {
  it("should format an ISO date string to dd.MM.yyyy", () => {
    // Use datetime with timezone to avoid UTC date shift
    const result = formatDate("2026-03-15T12:00:00");
    expect(result).toBe("15.03.2026");
  });

  it("should return dash for null", () => {
    expect(formatDate(null)).toBe("–");
  });

  it("should return dash for undefined", () => {
    expect(formatDate(undefined)).toBe("–");
  });

  it("should return dash for empty string", () => {
    expect(formatDate("")).toBe("–");
  });
});

describe("formatDateTime", () => {
  it("should format an ISO datetime string", () => {
    const result = formatDateTime("2026-03-15T14:30:00Z");
    expect(result).toContain("15.03.2026");
    // Time part depends on timezone
    expect(result).toContain(":");
  });

  it("should return dash for null", () => {
    expect(formatDateTime(null)).toBe("–");
  });
});

describe("formatTime", () => {
  it("should format HH:mm:ss to HH:mm", () => {
    expect(formatTime("14:30:00")).toBe("14:30");
  });

  it("should handle HH:mm format", () => {
    expect(formatTime("09:15")).toBe("09:15");
  });

  it("should return dash for null", () => {
    expect(formatTime(null)).toBe("–");
  });

  it("should return dash for undefined", () => {
    expect(formatTime(undefined)).toBe("–");
  });
});

describe("formatDuration", () => {
  it("should format minutes only", () => {
    expect(formatDuration(30)).toBe("30 Min.");
  });

  it("should format hours only", () => {
    expect(formatDuration(120)).toBe("2 Std.");
  });

  it("should format hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 Std. 30 Min.");
  });

  it("should handle zero minutes", () => {
    expect(formatDuration(0)).toBe("0 Min.");
  });

  it("should handle large values", () => {
    expect(formatDuration(480)).toBe("8 Std.");
  });
});

describe("formatUserName", () => {
  it("should format first and last name", () => {
    expect(
      formatUserName({ first_name: "Max", last_name: "Mustermann" })
    ).toBe("Max Mustermann");
  });

  it("should return dash for null", () => {
    expect(formatUserName(null)).toBe("–");
  });

  it("should return dash for undefined", () => {
    expect(formatUserName(undefined)).toBe("–");
  });

  it("should handle empty names", () => {
    expect(formatUserName({ first_name: "", last_name: "" })).toBe("–");
  });
});

describe("getInitials", () => {
  it("should return initials from first and last name", () => {
    expect(getInitials("Max", "Mustermann")).toBe("MM");
  });

  it("should handle single name", () => {
    expect(getInitials("Max", undefined)).toBe("M");
  });

  it("should handle no names", () => {
    expect(getInitials(undefined, undefined)).toBe("");
  });

  it("should return uppercase initials", () => {
    expect(getInitials("anna", "berger")).toBe("AB");
  });
});
