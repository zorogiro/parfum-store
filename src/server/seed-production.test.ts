import { describe, expect, it } from "vitest";
import { describeDatabase, readSeedConfig, type SeedEnv } from "../../prisma/seed-production-core";

const base: SeedEnv = {
  CONFIRM_PRODUCTION_SEED: "yes",
  DIRECT_URL: "postgresql://user:secret@host.example.com:5432/db?sslmode=require",
  ADMIN_EMAIL: "Admin@Example.com",
  ADMIN_PASSWORD: "a-long-enough-password",
};

describe("production seed guards", () => {
  it("accepts a complete environment and normalizes the email", () => {
    expect(readSeedConfig(base)).toEqual({
      email: "admin@example.com",
      password: "a-long-enough-password",
      resetAdminPassword: false,
    });
  });

  it("requires CONFIRM_PRODUCTION_SEED=yes exactly", () => {
    for (const value of [undefined, "", "1", "true", "YES", "y"]) {
      expect(() => readSeedConfig({ ...base, CONFIRM_PRODUCTION_SEED: value })).toThrow(/Refusing/);
    }
  });

  it("refuses a password shorter than 12 characters", () => {
    expect(() => readSeedConfig({ ...base, ADMIN_PASSWORD: "elevenchars" })).toThrow(/12/);
    expect(readSeedConfig({ ...base, ADMIN_PASSWORD: "twelve-chars" }).password).toBe(
      "twelve-chars",
    );
  });

  it("refuses a missing or invalid email and a missing database", () => {
    expect(() => readSeedConfig({ ...base, ADMIN_EMAIL: "" })).toThrow(/ADMIN_EMAIL/);
    expect(() => readSeedConfig({ ...base, ADMIN_EMAIL: "not-an-email" })).toThrow(/ADMIN_EMAIL/);
    expect(() => readSeedConfig({ ...base, DIRECT_URL: undefined })).toThrow(/DIRECT_URL/);
  });

  it("only resets the password with RESET_ADMIN_PASSWORD=1", () => {
    expect(readSeedConfig({ ...base, RESET_ADMIN_PASSWORD: "1" }).resetAdminPassword).toBe(true);
    expect(readSeedConfig({ ...base, RESET_ADMIN_PASSWORD: "yes" }).resetAdminPassword).toBe(false);
  });

  it("never puts the password in an error message", () => {
    expect(() => readSeedConfig({ ...base, ADMIN_PASSWORD: "short" })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("short") }),
    );
  });

  it("describes the database without credentials", () => {
    const text = describeDatabase(base.DIRECT_URL);
    expect(text).toBe("host.example.com:5432/db");
    expect(text).not.toMatch(/secret|user/);
    expect(describeDatabase("not a url with secret")).not.toContain("secret");
  });
});
