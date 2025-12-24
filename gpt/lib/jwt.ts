import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./config.js";
import { Errors } from "./errors.js";

let _sm: SecretsManagerClient | undefined;

let _cachedKeyBytes: Uint8Array | undefined;
let _cachedFetchedAt = 0;

function sm(): SecretsManagerClient {
  if (!_sm) _sm = new SecretsManagerClient({ region: env().REGION });
  return _sm;
}

function cacheMs(): number {
  const n = Number(env().JWT_KEY_CACHE_MS);
  return Number.isFinite(n) && n > 0 ? n : 300000;
}

async function getSigningKeyBytes(): Promise<Uint8Array> {
  const now = Date.now();
  if (_cachedKeyBytes && now - _cachedFetchedAt < cacheMs()) return _cachedKeyBytes;

  const out = await sm().send(new GetSecretValueCommand({ SecretId: env().JWT_SECRET_NAME }));
  const secretString = out.SecretString;
  if (!secretString) throw Errors.internal("JWT secret missing SecretString");
  _cachedKeyBytes = new TextEncoder().encode(secretString);
  _cachedFetchedAt = now;
  return _cachedKeyBytes;
}

export type JwtClaims = { sub: string; email: string; roles: string[] };

export async function signAccessToken(input: JwtClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: input.email, roles: input.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(env().JWT_ISSUER)
    .setAudience(env().JWT_AUDIENCE)
    .setSubject(input.sub)
    .setIssuedAt(now)
    .setExpirationTime(env().JWT_EXPIRES_IN)
    .sign(await getSigningKeyBytes());
}

export async function verifyAccessToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, await getSigningKeyBytes(), {
    issuer: env().JWT_ISSUER,
    audience: env().JWT_AUDIENCE,
    algorithms: ["HS256"]
  });

  const sub = payload.sub;
  const email = (payload as any).email;
  const roles = (payload as any).roles;

  if (typeof sub !== "string") throw Errors.unauthorized("Invalid token");
  if (typeof email !== "string") throw Errors.unauthorized("Invalid token");
  if (!Array.isArray(roles) || !roles.every((r) => typeof r === "string")) throw Errors.unauthorized("Invalid token");

  return { sub, email, roles };
}

export function extractBearerToken(headers: Record<string, string | undefined> | undefined): string | null {
  if (!headers) return null;
  const auth = headers.authorization ?? headers.Authorization ?? headers.AUTHORIZATION;
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}
