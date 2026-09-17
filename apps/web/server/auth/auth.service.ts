import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

import { prisma } from "@/server/db/prisma";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "peanutec_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_RENEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email ou senha inválidos.");
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Autenticação necessária.");
    this.name = "UnauthorizedError";
  }
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email já cadastrado.");
    this.name = "DuplicateEmailError";
  }
}

function normalizeEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new AuthValidationError("Email inválido.");
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@") || normalized.length > 320) {
    throw new AuthValidationError("Email inválido.");
  }

  return normalized;
}

function validateName(name: unknown): string {
  if (typeof name !== "string") {
    throw new AuthValidationError("Nome inválido.");
  }

  const normalized = name.trim();
  if (!normalized || normalized.length > 120) {
    throw new AuthValidationError("Nome inválido.");
  }

  return normalized;
}

function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new AuthValidationError("A senha deve ter pelo menos 8 caracteres.");
  }
  if (password.length > 256) {
    throw new AuthValidationError("A senha informada é muito longa.");
  }
  return password;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, rawN, rawR, rawP, saltHex, digestHex] = encoded.split("$");
    if (algorithm !== "scrypt") return false;

    const n = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(digestHex, "hex");

    if (!expected.length || !Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return false;
    }

    const derived = (await scrypt(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    })) as Buffer;

    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(user: { id: string; name: string; email: string }): AuthUser {
  return { id: user.id, name: user.name, email: user.email };
}

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function deleteSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lte: now } }, { userId }],
    },
  });

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      lastUsedAt: now,
    },
  });

  return { token, expiresAt };
}

export async function registerUser(input: {
  nome: unknown;
  email: unknown;
  senha: unknown;
}): Promise<AuthUser> {
  const name = validateName(input.nome);
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.senha);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) throw new DuplicateEmailError();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
    },
  });

  return publicUser(user);
}

export async function loginUser(input: {
  email: unknown;
  senha: unknown;
}): Promise<AuthUser> {
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.senha);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }

  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  return publicUser(user);
}

async function getValidatedSession(token: string) {
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  let expiresAt = session.expiresAt;
  if (session.expiresAt.getTime() - now.getTime() <= SESSION_RENEW_WINDOW_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: now, expiresAt },
  });

  return { user: session.user, expiresAt };
}

export async function getUserFromSessionToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await getValidatedSession(token);
  if (!session) return null;
  await setSessionCookie(token, session.expiresAt);
  return publicUser(session.user);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? getUserFromSessionToken(token) : null;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function logoutUser(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  await deleteSessionCookie();
}

export const AUTH_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_TTL_DAYS = 30;
