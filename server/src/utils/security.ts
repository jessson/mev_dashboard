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

export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin) {
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return getAllowedOrigins().includes(origin);
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
