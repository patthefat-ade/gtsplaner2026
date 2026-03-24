import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";

describe("api instance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should have correct baseURL", () => {
    expect(api.defaults.baseURL).toBe("/api/v1");
  });

  it("should have JSON content type", () => {
    expect(api.defaults.headers["Content-Type"]).toBe("application/json");
  });

  it("should have withCredentials enabled", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("should have request interceptors", () => {
    expect(api.interceptors.request).toBeDefined();
  });

  it("should have response interceptors", () => {
    expect(api.interceptors.response).toBeDefined();
  });
});
