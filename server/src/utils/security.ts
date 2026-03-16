const DEFAULT_JWT_SECRET = 'your-secret-key';

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export function getAllowedOrigins(): string[] {
  const configuredOrigins =
    process.env.ALLOWED_ORIGINS
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) || [];

  return Array.from(new Set([...LOCAL_ALLOWED_ORIGINS, ...configuredOrigins]));
}

function normalizeOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const protocol = url.protocol.toLowerCase();
    const port = url.port;
    const isDefaultPort =
      (protocol === 'http:' && (port === '' || port === '80')) ||
      (protocol === 'https:' && (port === '' || port === '443'));

    return `${protocol}//${hostname}${isDefaultPort ? '' : `:${port}`}`;
  } catch {
    return null;
  }
}

function normalizeForwardedHeader(value?: string | string[] | null): string | null {
  if (!value) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw.split(',')[0]?.trim();
  return first || null;
}

export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin) {
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getAllowedOrigins()
    .map((item) => normalizeOrigin(item))
    .filter((item): item is string => Boolean(item))
    .includes(normalizedOrigin);
}

export function isSameOriginViaGateway(
  origin?: string | null,
  forwardedHost?: string | string[] | null,
  forwardedProto?: string | string[] | null
): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const host = normalizeForwardedHeader(forwardedHost);
  const proto = normalizeForwardedHeader(forwardedProto)?.toLowerCase();

  if (!normalizedOrigin || !host || !proto) {
    return false;
  }

  if (proto !== 'http' && proto !== 'https') {
    return false;
  }

  return normalizedOrigin === normalizeOrigin(`${proto}://${host}`);
}

export function isOriginAllowedForRequest(
  origin?: string | null,
  forwardedHost?: string | string[] | null,
  forwardedProto?: string | string[] | null
): boolean {
  if (!origin) {
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return isOriginAllowed(origin) || isSameOriginViaGateway(origin, forwardedHost, forwardedProto);
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      throw new Error('生产环境必须设置 JWT_SECRET');
    }
    return DEFAULT_JWT_SECRET;
  }

  if (isProduction && secret === DEFAULT_JWT_SECRET) {
    throw new Error('生产环境禁止使用默认 JWT_SECRET');
  }

  return secret;
}

export function shouldSynchronizeDatabase(): boolean {
  if (process.env.SYNCHRONIZE_DB === '1' || process.env.SYNCHRONIZE_DB === 'true') {
    return true;
  }

  if (process.env.SYNCHRONIZE_DB === '0' || process.env.SYNCHRONIZE_DB === 'false') {
    return false;
  }

  return process.env.NODE_ENV !== 'production';
}

export function getWriteAllowedRoles(): string[] {
  const configured =
    process.env.WRITE_API_ALLOWED_ROLES
      ?.split(',')
      .map((role) => role.trim())
      .filter(Boolean) || [];

  return configured.length > 0 ? configured : ['admin'];
}

export function isWriteRoleAllowed(role?: string): boolean {
  if (!role) return false;
  return getWriteAllowedRoles().includes(role);
}
