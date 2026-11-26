import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
}

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let cachedProjectId: string | null = null;
let certCache: CertCache | null = null;
let pendingCertFetch: Promise<Record<string, string>> | null = null;

function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;

  const configPath = path.resolve(
    __dirname,
    '..',
    '..',
    'firebase-applet-config.json',
  );
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: unknown };
    if (typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
      cachedProjectId = parsed.projectId.trim();
      return cachedProjectId;
    }
  } catch {
    // Fallback to env var if config file is unavailable
  }

  const envId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    '';
  cachedProjectId = envId.trim();
  return cachedProjectId;
}

function parseMaxAgeSeconds(cacheControlHeader: string | null): number {
  if (!cacheControlHeader) return 3600;
  const match = /max-age=(\d+)/i.exec(cacheControlHeader);
  if (!match) return 3600;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 60) return 300;
  return Math.min(parsed, 86400);
}

async function fetchGooglePublicCerts(
  forceRefresh = false,
): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certCache && now < certCache.expiresAt) {
    return certCache.certs;
  }
  if (pendingCertFetch) {
    return pendingCertFetch;
  }

  pendingCertFetch = (async () => {
    try {
      const response = await fetch(GOOGLE_CERTS_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Cert fetch failed with status ${response.status}`);
      }
      const certs = (await response.json()) as Record<string, string>;
      const maxAgeSec = parseMaxAgeSeconds(
        response.headers.get('cache-control'),
      );
      certCache = {
        certs,
        expiresAt: Date.now() + maxAgeSec * 1000,
      };
      return certs;
    } finally {
      pendingCertFetch = null;
    }
  })();

  return pendingCertFetch;
}

function decodeBase64UrlToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    const raw = decodeBase64UrlToBuffer(segment).toString('utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Cryptographically verifies a Firebase Auth ID Token (RS256) directly against
 * Google's public x509 certificates without requiring IAM or service account keys.
 */
export async function verifyFirebaseIdToken(
  rawToken: unknown,
): Promise<VerifiedFirebaseUser | null> {
  if (typeof rawToken !== 'string') return null;
  const token = rawToken.trim();
  if (token.length < 40 || token.length > 8192) return null;

  const projectId = getFirebaseProjectId();
  if (!projectId) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: unknown; kid?: unknown }>(
    headerB64,
  );
  const payload = decodeBase64UrlJson<{
    aud?: unknown;
    iss?: unknown;
    sub?: unknown;
    exp?: unknown;
    iat?: unknown;
    auth_time?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
  }>(payloadB64);

  if (!header || !payload) return null;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId) return null;
  if (payload.iss !== expectedIssuer) return null;
  if (
    typeof payload.sub !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.sub)
  ) {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 30) {
    return null;
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    return null;
  }
  if (
    typeof payload.auth_time === 'number' &&
    payload.auth_time > nowSec + 300
  ) {
    return null;
  }
  if (payload.email_verified !== true) {
    return null;
  }

  let certs: Record<string, string>;
  try {
    certs = await fetchGooglePublicCerts(false);
    if (!certs[header.kid]) {
      certs = await fetchGooglePublicCerts(true);
    }
  } catch {
    return null;
  }

  const pemCert = certs[header.kid];
  if (typeof pemCert !== 'string' || !pemCert.includes('BEGIN CERTIFICATE')) {
    return null;
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const signature = decodeBase64UrlToBuffer(signatureB64);
    const valid = verifier.verify(pemCert, signature);
    if (!valid) return null;
  } catch {
    return null;
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: typeof payload.name === 'string' ? payload.name : null,
    emailVerified: true,
  };
}

export function extractBearerToken(authHeader: unknown): string | null {
  if (typeof authHeader !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}
