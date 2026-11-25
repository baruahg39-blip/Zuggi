import crypto from 'crypto';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Extend Express Request to carry a per-request correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

// Debug mode strictly defaults to OFF and is always disabled in production
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const DEBUG_MODE = !IS_PRODUCTION && process.env.DEBUG_MODE === 'true';

const PLACEHOLDER_FRAGMENTS = [
  'your_gemini_api_key',
  'your_server_google_maps_api_key',
  'your_cashfree_app_id',
  'your_cashfree_secret_key',
  'your_httpsms_api_key',
  'your-project-id',
  'your_supabase_service_role_key',
  'replace_with_strong_admin_passcode',
  'replace_with_64_char_random_hex_secret',
  'postgres:postgres',
  'admin:admin',
  'changeme'
];

function isPlaceholderOrEmpty(value: string | undefined): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return PLACEHOLDER_FRAGMENTS.some((frag) => lower.includes(frag));
}

export interface EnvValidationReport {
  ok: boolean;
  isProduction: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates all required and optional environment variables and database TLS/security settings.
 * In production (NODE_ENV=production), refuses to start if any critical variable is missing,
 * contains a placeholder/default credential, or uses an insecure non-TLS database URL.
 */
export function validateEnvironmentConfig(): EnvValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const adminPasscode = (process.env.ZUGGI_ADMIN_PASSCODE || '').trim();
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  const trackingSecret = (process.env.TRACKING_TOKEN_SECRET || '').trim();
  const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS || '').trim();
  const appUrl = (process.env.APP_URL || '').trim();
  const primaryDomain = (process.env.PRIMARY_DOMAIN || '').trim();

  // 1. Critical production variables (app refuses to start if missing/invalid in production)
  if (isPlaceholderOrEmpty(adminPasscode) || adminPasscode.length < 8) {
    const msg = 'ZUGGI_ADMIN_PASSCODE must be set to a strong non-placeholder secret (min 8 chars).';
    if (IS_PRODUCTION) errors.push(msg);
    else warnings.push(msg);
  }

  if (isPlaceholderOrEmpty(supabaseUrl)) {
    const msg = 'SUPABASE_URL is not configured (required for production PostgreSQL persistence).';
    if (IS_PRODUCTION) errors.push(msg);
    else warnings.push(msg);
  } else {
    // Enforce TLS/SSL and block local/unauthenticated DB endpoints in production
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:') {
        const msg = 'SUPABASE_URL must use HTTPS (TLS/SSL) — plain HTTP database connections are forbidden.';
        if (IS_PRODUCTION) errors.push(msg);
        else warnings.push(msg);
      }
      const host = parsed.hostname.toLowerCase();
      if (IS_PRODUCTION && (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0')) {
        errors.push('SUPABASE_URL cannot point to localhost in production.');
      }
      if (parsed.username || parsed.password) {
        const msg = 'SUPABASE_URL must not embed database username/password credentials in the URL.';
        if (IS_PRODUCTION) errors.push(msg);
        else warnings.push(msg);
      }
    } catch {
      const msg = 'SUPABASE_URL is not a valid HTTPS URL.';
      if (IS_PRODUCTION) errors.push(msg);
      else warnings.push(msg);
    }
  }

  if (isPlaceholderOrEmpty(supabaseKey)) {
    const msg = 'SUPABASE_SERVICE_ROLE_KEY is not configured (required for authenticated server-side DB access).';
    if (IS_PRODUCTION) errors.push(msg);
    else warnings.push(msg);
  }

  if (isPlaceholderOrEmpty(trackingSecret) || trackingSecret.length < 32) {
    const msg = 'TRACKING_TOKEN_SECRET must be set to a random 32+ character signing secret in production.';
    if (IS_PRODUCTION) errors.push(msg);
    else warnings.push(msg);
  }

  if (!allowedOriginsRaw && !appUrl && !primaryDomain) {
    const msg = 'Set ALLOWED_ORIGINS, APP_URL, or PRIMARY_DOMAIN to restrict CORS in production.';
    if (IS_PRODUCTION) errors.push(msg);
    else warnings.push(msg);
  }

  // 2. Optional third-party integrations (warn clearly when missing so operators know what is active)
  const optionalChecks: Array<{ name: string; label: string }> = [
    { name: 'HTTPSMS_API_KEY', label: 'SMS OTP delivery (httpSMS)' },
    { name: 'MY_JIO_PHONE_NUMBER', label: 'SMS sender number (httpSMS)' },
    { name: 'CASHFREE_APP_ID', label: 'Cashfree payment gateway' },
    { name: 'CASHFREE_SECRET_KEY', label: 'Cashfree webhook & payout signing' },
    { name: 'GEMINI_API_KEY', label: 'Logistics intelligence summary API' }
  ];

  for (const item of optionalChecks) {
    if (isPlaceholderOrEmpty(process.env[item.name])) {
      warnings.push(`${item.name} is not set (${item.label} will operate in fallback/disabled mode).`);
    }
  }

  // Enforce strict TLS on any custom PostgreSQL URL if ever introduced
  const rawDbUrl = (process.env.DATABASE_URL || '').trim();
  if (rawDbUrl) {
    const lowerDb = rawDbUrl.toLowerCase();
    if (lowerDb.includes('postgres:postgres@') || lowerDb.includes('root:root@') || lowerDb.includes('admin:admin@')) {
      const msg = 'DATABASE_URL contains default credentials. Rotate and use a strong unique password.';
      if (IS_PRODUCTION) errors.push(msg);
      else warnings.push(msg);
    }
    if (IS_PRODUCTION && !lowerDb.includes('sslmode=require') && !lowerDb.includes('sslmode=verify-full') && !lowerDb.includes('ssl=true')) {
      errors.push('DATABASE_URL must enforce TLS/SSL in production (e.g. ?sslmode=require).');
    }
  }

  if (errors.length > 0) {
    console.error('[Startup Config Error] Refusing to start due to critical environment/security misconfiguration:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    throw new Error(`Critical configuration check failed (${errors.length} error(s)).`);
  }

  if (warnings.length > 0 && DEBUG_MODE) {
    console.warn(`[Startup Config Notice] ${warnings.length} optional variable(s) not set in this environment.`);
  }

  return {
    ok: errors.length === 0,
    isProduction: IS_PRODUCTION,
    errors,
    warnings
  };
}

/**
 * Attaches a unique correlation ID to every request and ensures every 4xx/5xx JSON error
 * response includes `correlationId` while stripping stack traces, file paths, and DB details.
 */
export function correlationIdMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const incoming = String(req.headers['x-correlation-id'] || '').trim();
  const correlationId = /^[a-zA-Z0-9_-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
      const sanitized: Record<string, any> = {
        ...body,
        correlationId: body.correlationId || correlationId
      };
      // Strip any accidental internal details from error responses
      delete sanitized.stack;
      delete sanitized.sql;
      delete sanitized.query;
      delete sanitized.filePath;
      delete sanitized.internalError;
      delete sanitized.details;
      return originalJson(sanitized);
    }
    return originalJson(body);
  }) as any;

  next();
}

/**
 * Helper to log full error diagnostics server-side with correlation ID and return a safe client response.
 */
export function sendSafeError(
  req: express.Request,
  res: express.Response,
  statusCode: number,
  publicMessage: string,
  internalError?: unknown,
  contextTag = 'Server Error'
) {
  const correlationId = req.correlationId || crypto.randomUUID();
  if (internalError) {
    const errCode = (internalError as any)?.code || (internalError as any)?.name || 'error';
    const errMsg = internalError instanceof Error ? internalError.message : String(internalError);
    console.error(`[${contextTag}] correlationId=${correlationId} code=${errCode} detail=${errMsg.slice(0, 300)}`);
  }
  return res.status(statusCode).json({
    success: false,
    message: publicMessage,
    correlationId
  });
}

/**
 * Global Express error-handling middleware (must be registered after all routes).
 * Guarantees zero stack traces, query details, or internal file paths ever reach the client.
 */
export function globalErrorHandler(
  err: any,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) {
  const correlationId = req.correlationId || crypto.randomUUID();

  // Handle malformed JSON request bodies cleanly as 400
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    console.warn(`[Malformed JSON] correlationId=${correlationId}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request payload.',
      correlationId
    });
  }

  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  console.error(
    `[Unhandled Server Error] correlationId=${correlationId} status=${status} path=${req.path}`,
    err?.stack || err?.message || 'unknown_error'
  );

  if (res.headersSent) return;
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'An internal server error occurred. Please try again later.' : 'Request could not be processed.',
    correlationId
  });
}

/**
 * Applies security headers to every response via Helmet:
 * - X-Content-Type-Options: nosniff
 * - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload (1 year)
 * - X-Frame-Options: DENY (on all responses in production and all API routes in dev)
 * - Content-Security-Policy restricting scripts strictly to self & trusted Firebase origins
 */
export function applySecurityHeaders(app: express.Express): void {
  app.disable('x-powered-by');

  const scriptSrc = IS_PRODUCTION
    ? [
        "'self'",
        'https://apis.google.com',
        'https://www.gstatic.com'
      ]
    : [
        "'self'",
        "'unsafe-inline'",
        'https://apis.google.com',
        'https://www.gstatic.com'
      ];

  const frameAncestors = IS_PRODUCTION
    ? ["'none'"]
    : ["'self'", 'https://aistudio.google.com', 'https://*.google.com', 'https://*.run.app'];

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc,
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'https://*.firebaseapp.com',
            'https://*.supabase.co',
            'https://photon.komoot.io',
            'https://nominatim.openstreetmap.org',
            'https://router.project-osrm.org',
            'https://api.cashfree.com',
            'https://sandbox.cashfree.com',
            'wss:'
          ],
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com', 'https://sdk.cashfree.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors
        }
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: IS_PRODUCTION ? { action: 'deny' } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  // Enforce X-Frame-Options: DENY on all API & tracking routes even in non-production dev
  if (!IS_PRODUCTION) {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/trips')) {
        res.setHeader('X-Frame-Options', 'DENY');
      }
      next();
    });
  }
}

/**
 * Builds the strict CORS origin allowlist from configured frontend domains.
 * Never allows wildcard (*) on API endpoints.
 */
function buildAllowedOriginsSet(): Set<string> {
  const origins = new Set<string>();

  const addOrigin = (raw: string) => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      origins.add(parsed.origin.toLowerCase());
    } catch {
      // Ignore malformed entry
    }
  };

  const primaryDomain = (process.env.PRIMARY_DOMAIN || 'zuggi.in').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const partnerSubdomain = (process.env.PARTNER_SUBDOMAIN || `partner.${primaryDomain}`).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  addOrigin(`https://${primaryDomain}`);
  addOrigin(`https://www.${primaryDomain}`);
  addOrigin(`https://${partnerSubdomain}`);

  if (process.env.APP_URL) {
    addOrigin(process.env.APP_URL);
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(addOrigin);
  }

  if (!IS_PRODUCTION) {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return origins;
}

const ALLOWED_ORIGINS = buildAllowedOriginsSet();

function isOriginAllowed(origin: string | undefined, hostHeader: string | undefined): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const normalized = parsed.origin.toLowerCase();
    if (ALLOWED_ORIGINS.has(normalized)) return true;
    // Allow exact same-host requests (e.g. Cloud Run preview/production host serving both SPA and API)
    if (hostHeader && parsed.host.toLowerCase() === hostHeader.toLowerCase()) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function strictCorsMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const origin = req.headers.origin;
  const host = req.headers.host;

  // Strictly public, unauthenticated read-only SEO/PWA files only
  const isPublicReadOnlyStatic =
    req.method === 'GET' &&
    (req.path === '/manifest.json' ||
      req.path === '/manifest.webmanifest' ||
      req.path === '/manifest-partner.json' ||
      req.path === '/.well-known/assetlinks.json' ||
      req.path === '/robots.txt' ||
      req.path === '/sitemap.xml' ||
      req.path === '/sitemap-freight.xml');

  if (isPublicReadOnlyStatic) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return next();
  }

  if (origin) {
    if (isOriginAllowed(origin, host)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-zuggi-admin-token, x-zuggi-user-token, x-correlation-id'
      );
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      return next();
    }

    // Reject disallowed cross-origin preflight requests cleanly
    if (req.method === 'OPTIONS') {
      return res.status(403).json({
        success: false,
        message: 'Cross-origin request blocked by CORS policy.',
        correlationId: req.correlationId
      });
    }
  } else if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

// --- RATE LIMITERS FOR AUTHENTICATION ENDPOINTS ---

function createRateLimitHandler(message: string) {
  return (req: express.Request, res: express.Response) => {
    res.status(429).json({
      success: false,
      message,
      correlationId: req.correlationId
    });
  };
}

// Login endpoints: max 5 attempts per minute per IP
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many login attempts from this IP. Please wait 1 minute and try again.')
});

// Password / passcode reset endpoints: max 3 attempts per hour per IP
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password reset requests from this IP. Please try again in 1 hour.')
});

// OTP send/verify, signup passcode setup & account deletion: max 5 attempts per minute per IP
export const authActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many authentication requests from this IP. Please wait 1 minute and try again.')
});

// Conditional middleware for /api/auth/send-otp when purpose === 'reset_passcode' (3/hour)
export const conditionalResetOtpRateLimiter: express.RequestHandler = (req, res, next) => {
  if (String(req.body?.purpose || '').toLowerCase() === 'reset_passcode') {
    return passwordResetRateLimiter(req, res, next);
  }
  return authActionRateLimiter(req, res, next);
};
