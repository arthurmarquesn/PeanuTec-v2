import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const fields = new Map<string, any>();
  let userSequence = 0;

  const cookieValues = new Map<string, string>();
  const cookieStore = {
    get(name: string) {
      const value = cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
    set(name: string, value: string) {
      if (value) cookieValues.set(name, value);
      else cookieValues.delete(name);
    },
  };

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.email) {
          return [...users.values()].find((user) => user.email === where.email) ?? null;
        }
        return users.get(where.id) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        userSequence += 1;
        const user = {
          id: `user-${userSequence}`,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
        };
        users.set(user.id, user);
        return user;
      }),
    },
    session: {
      deleteMany: vi.fn(async ({ where }: any) => {
        let deleted = 0;
        for (const [hash, session] of sessions) {
          const expired = where?.OR?.some((entry: any) => entry.expiresAt?.lte && session.expiresAt <= entry.expiresAt.lte);
          const sameUser = where?.OR?.some((entry: any) => entry.userId === session.userId);
          if (expired || sameUser || (where?.tokenHash && hash === where.tokenHash)) {
            sessions.delete(hash);
            deleted += 1;
          }
        }
        return { count: deleted };
      }),
      create: vi.fn(async ({ data }: any) => {
        const record = { id: `session-${sessions.size + 1}`, ...data };
        sessions.set(data.tokenHash, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const session = sessions.get(where.tokenHash);
        if (!session) return null;
        const user = users.get(session.userId);
        return user ? { ...session, user } : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const session = [...sessions.values()].find((item) => item.id === where.id);
        if (!session) throw new Error("Session missing");
        Object.assign(session, data);
        return session;
      }),
      delete: vi.fn(async ({ where }: any) => {
        for (const [hash, session] of sessions) {
          if (session.id === where.id) sessions.delete(hash);
        }
      }),
    },
    field: {
      findFirst: vi.fn(async ({ where }: any) => {
        const field = fields.get(where.id);
        return field && field.userId === where.userId ? field : null;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        [...fields.values()].filter((field) => field.userId === where?.userId).map((field) => ({ id: field.id })),
      ),
    },
  };

  return { users, sessions, fields, cookieValues, cookieStore, prisma };
});

vi.mock("@/server/db/prisma", () => ({ prisma: state.prisma }));
vi.mock("next/headers", () => ({ cookies: async () => state.cookieStore }));

import {
  getCurrentUser,
  getUserFromSessionToken,
  loginUser,
  logoutUser,
  registerUser,
  requireUser,
  UnauthorizedError,
} from "@/server/auth/auth.service";
import { requireOwnedField, ResourceNotFoundError } from "@/server/auth/authorization";

describe("V2 authentication", () => {
  beforeEach(() => {
    state.users.clear();
    state.sessions.clear();
    state.fields.clear();
    state.cookieValues.clear();
    vi.clearAllMocks();
  });

  it("registers and authenticates a user with a hashed password", async () => {
    const user = await registerUser({
      nome: "Alice",
      email: " Alice@Example.com ",
      senha: "SenhaSegura123!",
    });

    const stored = state.users.get(user.id);
    expect(stored.passwordHash).not.toBe("SenhaSegura123!");
    expect(stored.passwordHash.startsWith("scrypt$")).toBe(true);

    const logged = await loginUser({
      email: "alice@example.com",
      senha: "SenhaSegura123!",
    });

    expect(logged.id).toBe(user.id);
    expect(state.cookieValues.has("peanutec_session")).toBe(true);
  });

  it("rejects invalid credentials", async () => {
    await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await expect(loginUser({ email: "alice@example.com", senha: "errada123" })).rejects.toThrow("Email ou senha inválidos.");
  });

  it("rejects an API access without a session", async () => {
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await getCurrentUser()).toBeNull();
  });

  it("expires a session and removes it from persistence", async () => {
    const user = await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await loginUser({ email: "alice@example.com", senha: "SenhaSegura123!" });
    const token = state.cookieValues.get("peanutec_session")!;
    const hash = createHash("sha256").update(token).digest("hex");
    const session = state.sessions.get(hash);
    session.expiresAt = new Date(Date.now() - 1_000);

    expect(await getUserFromSessionToken(token)).toBeNull();
    expect(state.sessions.has(hash)).toBe(false);
    expect(user.id).toBe("user-1");
  });

  it("renews a session close to expiration", async () => {
    await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await loginUser({ email: "alice@example.com", senha: "SenhaSegura123!" });
    const token = state.cookieValues.get("peanutec_session")!;
    const hash = createHash("sha256").update(token).digest("hex");
    const session = state.sessions.get(hash);
    const oldExpiry = session.expiresAt;
    session.expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await getUserFromSessionToken(token);
    expect(session.expiresAt.getTime()).toBeGreaterThan(oldExpiry.getTime());
  });

  it("keeps the session valid across a service-module restart", async () => {
    await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await loginUser({ email: "alice@example.com", senha: "SenhaSegura123!" });
    const token = state.cookieValues.get("peanutec_session")!;

    vi.resetModules();
    const freshAuth = await import("@/server/auth/auth.service");
    const user = await freshAuth.getUserFromSessionToken(token);

    expect(user?.email).toBe("alice@example.com");
  });

  it("invalidates the session on logout", async () => {
    await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await loginUser({ email: "alice@example.com", senha: "SenhaSegura123!" });
    const token = state.cookieValues.get("peanutec_session")!;

    await logoutUser();

    expect(state.cookieValues.has("peanutec_session")).toBe(false);
    expect(await getUserFromSessionToken(token)).toBeNull();
  });

  it("denies access to another user's field", async () => {
    state.fields.set("field-b", { id: "field-b", userId: "user-2" });
    await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await loginUser({ email: "alice@example.com", senha: "SenhaSegura123!" });

    await expect(requireOwnedField("field-b")).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("allows the owner to access their field", async () => {
    state.fields.set("field-a", { id: "field-a", userId: "user-1" });
    await registerUser({ nome: "Alice", email: "alice@example.com", senha: "SenhaSegura123!" });
    await loginUser({ email: "alice@example.com", senha: "SenhaSegura123!" });

    const result = await requireOwnedField("field-a");
    expect(result.field.id).toBe("field-a");
    expect(result.user.id).toBe("user-1");
  });
});
