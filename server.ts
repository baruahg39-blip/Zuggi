import './server/env.js';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { cashfreeServer } from './server/cashfree.js';
import {
  escrowRouter,
  cashfreeEscrowWebhookHandler,
  startEscrowAutoReleaseWorker
} from './server/escrow.js';
import { businessRouter } from './server/business.js';
import { tripsRouter, anonymizeDriverDataByPhone } from './server/trips.js';
import {
  supabaseRouter,
  isSupabaseConfigured,
  findSupabaseUserByPhone,
  findSupabaseUserById,
  findSupabaseVehiclesByOwner,
  upsertSupabaseRecords,
  listSupabaseLoads,
  findSupabaseLoadById,
  findSupabaseBookingById,
  isPartnerRole,
  issueAdminSessionToken,
  verifyAdminTokenFromReq,
  issueUserSessionToken,
  verifyUserTokenFromReq,
  revokeTokenFromReq,
  revokeUserSessions,
  setUserSessionCookie,
  setAdminSessionCookie,
  clearSessionCookies,
  filterSelfUserFields,
  deleteAndAnonymizeUserDataInSupabase
} from './server/supabase.js';
import {
  SEO_CORRIDORS,
  SEO_VEHICLE_CATEGORIES,
  mergePublicFreightListings,
  sanitizePublicFreightListing,
  generateSiteSitemapXml,
  generateFreightOnlySitemapXml,
  resolveRouteSeo,
  injectSeoIntoHtml,
  type PublicFreightListing
} from './server/seo.js';
import {
  IS_PRODUCTION,
  validateEnvironmentConfig,
  correlationIdMiddleware,
  applySecurityHeaders,
  strictCorsMiddleware,
  globalErrorHandler,
  loginRateLimiter,
  passwordResetRateLimiter,
  authActionRateLimiter,
  conditionalResetOtpRateLimiter
} from './server/security.js';

// Refuse to start in production if critical environment variables or DB TLS checks fail
validateEnvironmentConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = IS_PRODUCTION ? (Number(process.env.PORT) || 3000) : 3000;

// Trust first reverse-proxy hop (Cloud Run / Nginx) for accurate per-IP rate limiting
app.set('trust proxy', 1);

// 1. Per-request correlation IDs & safe error sanitization
app.use(correlationIdMiddleware);

// 2. Security headers via Helmet (nosniff, HSTS 1yr, X-Frame-Options: DENY, strict CSP)
applySecurityHeaders(app);

// 3. Strict domain-restricted CORS policy (never wildcard * on APIs)
app.use(strictCorsMiddleware);

app.use(express.json({
  limit: '5mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Explicit, reliable endpoints for Web App Manifest with correct MIME type
const serveManifest = (fileName: string) => (req: express.Request, res: express.Response) => {
  const host = (req.headers.host || '').toLowerCase();
  const isPartnerHost = host.startsWith('partner.') || host.startsWith('driver.');
  const resolvedFile = fileName === 'manifest.json' && isPartnerHost ? 'manifest-partner.json' : fileName;
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(__dirname, 'public', resolvedFile));
};

app.get('/manifest.json', serveManifest('manifest.json'));
app.get('/manifest.webmanifest', serveManifest('manifest.json'));
app.get('/manifest-partner.json', serveManifest('manifest-partner.json'));

// Google Play Store Trusted Web Activity (TWA) Digital Asset Links for zuggi.in
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const packageName = process.env.ANDROID_TWA_PACKAGE_NAME || 'in.zuggi.partner';
  const fingerprintsRaw = process.env.ANDROID_TWA_SHA256_FINGERPRINT || '';
  const fingerprints = fingerprintsRaw
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints
      }
    }
  ]);
});

// Explicit endpoint for Service Worker with correct MIME type and scope header
app.get('/sw.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.resolve(__dirname, 'public', 'sw.js'));
});

// Serve public static assets (PWA icons, apple touch icon, SVG) while allowing dynamic /robots.txt and /sitemap*.xml routes
const publicStaticMiddleware = express.static(path.resolve(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json') || filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    }
  }
});
app.use((req, res, next) => {
  if (req.path === '/robots.txt' || req.path === '/sitemap.xml' || req.path === '/sitemap-freight.xml') {
    return next();
  }
  return publicStaticMiddleware(req, res, next);
});

function normalizeIndianE164(raw: unknown): string {
  const cleaned = String(raw || '').replace(/['"\s\-()]/g, '').trim();
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
  return '';
}

// Health check endpoint (boolean capability flags only — zero secrets or PII)
app.get('/api/health', (_req, res) => {
  const apiKey = (process.env.HTTPSMS_API_KEY || '').trim();
  const fromPhone = normalizeIndianE164(process.env.MY_JIO_PHONE_NUMBER || '');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Zuggi Freight Server',
    gateway: 'SIM / httpSMS',
    smsGatewayConfigured: Boolean(apiKey && fromPhone),
    supabaseConfigured: isSupabaseConfigured()
  });
});

// --- WEBSITE CONTACT / CALLBACK INQUIRY ENDPOINT ---
interface ContactInquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  topic: string;
  message: string;
  createdAt: string;
}

const contactInquiries: ContactInquiry[] = [];

app.post('/api/contact', (req, res) => {
  const { name, phone, email, topic, message } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').replace(/[^\d+]/g, '').trim();
  const cleanMessage = String(message || '').trim();

  if (cleanName.length < 2) {
    return res.status(400).json({ success: false, message: 'Please enter your full name.' });
  }
  if (cleanPhone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
  }
  if (cleanMessage.length < 5) {
    return res.status(400).json({ success: false, message: 'Please tell us briefly how we can help.' });
  }

  const refId = `ZUG-INQ-${Math.floor(100000 + Math.random() * 900000)}`;
  const inquiry: ContactInquiry = {
    id: refId,
    name: cleanName,
    phone: cleanPhone,
    email: String(email || '').trim() || undefined,
    topic: String(topic || 'General Freight Inquiry').trim(),
    message: cleanMessage,
    createdAt: new Date().toISOString()
  };

  contactInquiries.unshift(inquiry);
  if (contactInquiries.length > 200) contactInquiries.pop();

  return res.json({
    success: true,
    referenceId: refId,
    message: 'Thank you for reaching out to Zuggi. Our operations team will contact you shortly.'
  });
});

app.get('/api/contact', (req, res) => {
  if (!verifyAdminTokenFromReq(req)) {
    return res.status(403).json({ success: false, message: 'Admin authentication required to view inquiries.' });
  }
  return res.json({ success: true, count: contactInquiries.length, inquiries: contactInquiries.slice(0, 50) });
});

// --- TRIP ASSIGNMENT & LIVE VEHICLE TRACKING ROUTES ---
app.use('/trips', tripsRouter);
app.use('/api/trips', tripsRouter);

// --- SUPABASE DATABASE SYNC & BOOTSTRAP ROUTES ---
app.use('/api/db', supabaseRouter);

// --- HTTPSMS JIO GATEWAY OTP AUTHENTICATION ---

interface OtpRecord {
  otp: string;
  expiresAt: number;
  lastSentAt: number;
}

// In-memory OTP store
const otpStore = new Map<string, OtpRecord>();

// 1. Endpoint: Request & Send OTP via httpSMS Android Jio Gateway (Rate limited: 5/min/IP or 3/hr/IP for resets)
app.post('/api/auth/send-otp', conditionalResetOtpRateLimiter, async (req, res) => {
  try {
    let { phone } = req.body || {};

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    // Clean phone number (strip spaces, dashes, parentheses)
    phone = String(phone).replace(/[\s\-()]/g, '');

    // Format to E.164 standard with +91 if user entered 10 digits
    if (/^[6-9]\d{9}$/.test(phone)) {
      phone = `+91${phone}`;
    } else if (/^91[6-9]\d{9}$/.test(phone)) {
      phone = `+${phone}`;
    }

    if (!/^\+91[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number.'
      });
    }

    const now = Date.now();
    const existing = otpStore.get(phone);

    // Rate-limit: 60 seconds cooldown per phone number to protect SMS quota
    if (existing && now - existing.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`
      });
    }

    // Generate cryptographically secure 6-digit numeric OTP (zero hardcoded test codes)
    const otp = String(crypto.randomInt(100000, 1000000));
    const expiresAt = now + 10 * 60 * 1000; // 10-minute validity

    const apiKey = (process.env.HTTPSMS_API_KEY || '').trim();
    const rawFromPhone = (process.env.MY_JIO_PHONE_NUMBER || '').trim();
    const fromPhone = normalizeIndianE164(rawFromPhone);

    let smsDispatched = false;
    let gatewayFailureReason = '';

    if (apiKey && fromPhone) {
      try {
        const response = await fetch('https://api.httpsms.com/v1/messages/send', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            content: `Your Zuggi login OTP is: ${otp}. Valid for 10 minutes. Please do not share it with anyone.`,
            from: fromPhone,
            to: phone
          })
        });

        const result = await response.json().catch(() => ({}));
        const isSuccessStatus =
          response.ok &&
          result?.status !== 'error' &&
          (result?.status === 'success' || Boolean(result?.data?.id) || response.status === 200 || response.status === 201 || response.status === 202);

        if (isSuccessStatus) {
          smsDispatched = true;
        } else {
          gatewayFailureReason = String(result?.message || result?.status || `HTTP_${response.status}`).slice(0, 120);
          console.warn(
            `[httpSMS Gateway Notice] correlationId=${req.correlationId} status=${response.status} reason=${gatewayFailureReason}`
          );
        }
      } catch {
        gatewayFailureReason = 'network_unreachable';
        console.warn(`[httpSMS Gateway Network Notice] correlationId=${req.correlationId} SMS gateway unreachable.`);
      }
    } else if (IS_PRODUCTION) {
      gatewayFailureReason = !apiKey
        ? 'missing_httpsms_api_key'
        : !rawFromPhone
          ? 'missing_sender_phone'
          : 'invalid_sender_phone_format';
      console.warn(`[httpSMS Config Notice] correlationId=${req.correlationId} reason=${gatewayFailureReason}`);
    }

    if (smsDispatched) {
      otpStore.set(phone, {
        otp,
        expiresAt,
        lastSentAt: now
      });
      return res.json({
        success: true,
        deliveryMode: 'sms',
        message: 'OTP sent successfully to your mobile number.'
      });
    }

    if (IS_PRODUCTION) {
      // Do NOT record a 60s cooldown when SMS dispatch fails so users can retry right away
      return res.status(503).json({
        success: false,
        code: gatewayFailureReason || 'SMS_GATEWAY_UNAVAILABLE',
        message:
          'SMS delivery service is temporarily unavailable. Please try again shortly, or sign in with your Passcode if you already have an account.'
      });
    }

    // Non-production preview fallback when SMS gateway env vars are not configured or gateway returned an error
    otpStore.set(phone, {
      otp,
      expiresAt,
      lastSentAt: now
    });
    return res.json({
      success: true,
      deliveryMode: 'preview',
      message: `Preview verification OTP generated: ${otp}`,
      otp
    });
  } catch (error: any) {
    console.error(`[Send OTP Server Error] correlationId=${req.correlationId} code=${error?.code || 'unexpected_error'}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error sending OTP.'
    });
  }
});

// 2. Endpoint: Verify OTP (Rate limited: 5/min/IP)
app.post('/api/auth/verify-otp', loginRateLimiter, async (req, res) => {
  try {
    let { phone, otp } = req.body || {};

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP code are required.'
      });
    }

    phone = String(phone).replace(/[\s\-()]/g, '');
    if (/^[6-9]\d{9}$/.test(phone)) {
      phone = `+91${phone}`;
    } else if (/^91[6-9]\d{9}$/.test(phone)) {
      phone = `+${phone}`;
    }

    const cleanOtp = String(otp).trim();

    const issueVerifiedSession = async (verifiedPhone: string) => {
      const clean10 = normalizeTenDigitPhone(verifiedPhone);
      let resetToken = '';
      let existingUser: any = null;
      if (clean10) {
        otpVerifiedStore.set(clean10, Date.now() + OTP_VERIFIED_TTL_MS);
        resetToken = crypto.randomBytes(24).toString('hex');
        passcodeResetTokenStore.set(clean10, {
          token: resetToken,
          expiresAt: Date.now() + PASSCODE_RESET_TOKEN_TTL_MS
        });
        existingUser = passcodeUserStore.get(clean10) || (await findSupabaseUserByPhone(clean10)) || null;
        if (existingUser) {
          passcodeUserStore.set(clean10, existingUser);
        }
      }
      const sessionToken = existingUser ? issueUserSessionToken(existingUser) : undefined;
      if (sessionToken) {
        setUserSessionCookie(req, res, sessionToken);
      }
      return {
        success: true,
        verified: true,
        phone: verifiedPhone,
        resetToken,
        sessionToken,
        existingUser: sanitizeUserForClient(existingUser)
      };
    };

    const record = otpStore.get(phone);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No OTP requested for this phone number or it has expired.'
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({
        success: false,
        message: 'This OTP has expired. Please request a new one.'
      });
    }

    const expectedBuf = Buffer.from(record.otp);
    const providedBuf = Buffer.from(cleanOtp);
    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect OTP. Please check the digits and try again.'
      });
    }

    // OTP matched: remove it to prevent replay attacks and grant 15-minute passcode-setup / reset window
    otpStore.delete(phone);
    return res.json(await issueVerifiedSession(phone));
  } catch (error: any) {
    console.error(`[Verify OTP Server Error] correlationId=${req.correlationId} code=${error?.code || 'verify_otp_error'}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error verifying OTP.'
    });
  }
});

// --- PASSCODE AUTHENTICATION (No-OTP Returning Login for Shippers, Drivers & Vehicle Owners) ---

const OTP_VERIFIED_TTL_MS = 15 * 60 * 1000; // 15 minutes after OTP verify to complete profile + passcode
const PASSCODE_RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes single-use token for passcode reset
const otpVerifiedStore = new Map<string, number>(); // clean10 -> expiresAt
const passcodeResetTokenStore = new Map<string, { token: string; expiresAt: number }>(); // clean10 -> single-use reset token
const passcodeUserStore = new Map<string, any>(); // clean10 -> user record with passcodeHash
const passcodeAttemptStore = new Map<string, { count: number; lockUntil: number }>();

function normalizeTenDigitPhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length === 10 ? digits : '';
}

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPasscodeHash(passcode: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  try {
    const derived = crypto.scryptSync(passcode, salt, 32);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sanitizeUserForClient(user: any) {
  return filterSelfUserFields(user);
}

// Authenticated self-profile hydration (keeps PII out of localStorage and refreshes in-memory session token)
app.get('/api/auth/me', async (req, res) => {
  if (verifyAdminTokenFromReq(req)) {
    const ownerEmail = (process.env.SUPER_ADMIN_EMAIL || 'baruahg39@gmail.com').trim().toLowerCase();
    const freshAdminToken = issueAdminSessionToken(ownerEmail);
    setAdminSessionCookie(req, res, freshAdminToken);
    const adminUser = (await findSupabaseUserById('owner_baruahg39')) || {
      id: 'owner_baruahg39',
      name: 'G. Baruah (Platform Owner)',
      phone: '+91 94350 88219',
      email: ownerEmail,
      role: 'admin',
      businessName: 'Zuggi Technologies India',
      city: 'Guwahati',
      state: 'Assam',
      isVerified: true,
      createdAt: '2026-01-01T00:00:00Z'
    };
    return res.json({
      success: true,
      isAdmin: true,
      sessionToken: freshAdminToken,
      user: sanitizeUserForClient(adminUser)
    });
  }

  const session = verifyUserTokenFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const userRecord =
    (session.phone10 ? passcodeUserStore.get(session.phone10) : null) ||
    (session.userId ? await findSupabaseUserById(session.userId) : null) ||
    (session.phone10 ? await findSupabaseUserByPhone(session.phone10) : null);

  if (userRecord?.isBlocked) {
    clearSessionCookies(req, res);
    return res.status(403).json({
      success: false,
      message: `Account suspended: ${userRecord.blockedReason || 'Blocked by Super Admin'}.`
    });
  }

  const effectiveUser = userRecord || {
    id: session.userId,
    name: 'Zuggi Member',
    phone: session.phone10 ? `+91 ${session.phone10}` : '',
    role: session.role || 'customer',
    city: 'Guwahati',
    state: 'Assam',
    isVerified: session.role === 'customer',
    createdAt: new Date(session.issuedAt || Date.now()).toISOString()
  };

  const refreshedToken = issueUserSessionToken(effectiveUser);
  setUserSessionCookie(req, res, refreshedToken);
  return res.json({
    success: true,
    sessionToken: refreshedToken,
    user: sanitizeUserForClient(effectiveUser)
  });
});

// Authenticated logout: immediately blacklists caller's user/admin JWT on server & clears cookies
app.post('/api/auth/logout', (req, res) => {
  const revoked = revokeTokenFromReq(req);
  clearSessionCookies(req, res);
  return res.json({
    success: true,
    revoked,
    message: 'Session terminated securely.'
  });
});

// 3. Endpoint: Check if mobile number already has a registered account + passcode
// Field-filtered: never returns personal names or block reasons to unauthenticated callers
app.post('/api/auth/check-account', authActionRateLimiter, async (req, res) => {
  try {
    const clean10 = normalizeTenDigitPhone(req.body?.phone);
    if (!clean10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required.' });
    }

    let userRecord = passcodeUserStore.get(clean10) || null;
    if (!userRecord || !userRecord.passcodeHash) {
      const dbUser = await findSupabaseUserByPhone(clean10);
      if (dbUser) {
        userRecord = dbUser;
        passcodeUserStore.set(clean10, dbUser);
      }
    }

    if (!userRecord) {
      return res.json({
        success: true,
        exists: false,
        hasPasscode: false
      });
    }

    return res.json({
      success: true,
      exists: true,
      hasPasscode: Boolean(userRecord.passcodeHash || userRecord.hasPasscode),
      role: userRecord.role || 'customer',
      isBlocked: Boolean(userRecord.isBlocked)
    });
  } catch (err: any) {
    console.error(`[Check Account Error] correlationId=${req.correlationId}:`, err?.code || 'check_account_error');
    return res.status(500).json({ success: false, message: 'Failed to check account status.' });
  }
});

// 4. Endpoint: Set or Reset Login Passcode (requires recent OTP verification)
app.post('/api/auth/set-passcode', authActionRateLimiter, async (req, res) => {
  try {
    const { phone, passcode, userRecord } = req.body || {};
    const clean10 = normalizeTenDigitPhone(phone);
    const cleanPasscode = String(passcode || '').trim();

    if (!clean10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required.' });
    }
    if (!/^\d{4,6}$/.test(cleanPasscode)) {
      return res.status(400).json({
        success: false,
        message: 'Passcode must be 4 to 6 numeric digits.'
      });
    }

    const verifiedUntil = otpVerifiedStore.get(clean10) || 0;
    if (Date.now() > verifiedUntil) {
      return res.status(403).json({
        success: false,
        message: 'OTP verification expired. Please verify your mobile number via OTP first.'
      });
    }

    const existing = passcodeUserStore.get(clean10) || (await findSupabaseUserByPhone(clean10)) || {};
    const hashed = hashPasscode(cleanPasscode);
    const now = new Date().toISOString();

    const rawRole = String(userRecord?.role || existing?.role || 'customer').toLowerCase();
    // Never allow public onboarding/passcode setup to self-assign admin role
    const safeRole = rawRole === 'admin' ? (existing?.role === 'admin' ? 'admin' : 'customer') : rawRole;

    // CRITICAL: New drivers/owners/fleet partners MUST start unverified until Admin approves them on backend
    const authoritativeVerified = isPartnerRole(safeRole)
      ? existing?.isVerified === true
      : true;

    const mergedUser = {
      ...existing,
      ...(userRecord && typeof userRecord === 'object' ? userRecord : {}),
      id: (userRecord?.id || existing?.id || `usr_${clean10}`),
      role: safeRole,
      phone: `+91 ${clean10}`,
      isVerified: authoritativeVerified,
      isBlocked: Boolean(existing?.isBlocked),
      blockedReason: existing?.blockedReason,
      hasPasscode: true,
      passcodeHash: hashed,
      passcodeUpdatedAt: now
    };

    passcodeUserStore.set(clean10, mergedUser);
    passcodeAttemptStore.delete(clean10);
    await upsertSupabaseRecords('vs_users', [mergedUser], { isAdmin: false });

    const sessionToken = issueUserSessionToken(mergedUser);
    setUserSessionCookie(req, res, sessionToken);
    return res.json({
      success: true,
      message: 'Login passcode saved! You can now sign in without OTP.',
      sessionToken,
      user: sanitizeUserForClient(mergedUser)
    });
  } catch (err: any) {
    console.error(`[Set Passcode Error] correlationId=${req.correlationId}:`, err?.code || 'set_passcode_error');
    return res.status(500).json({ success: false, message: 'Failed to save login passcode.' });
  }
});

// 5. Endpoint: Sign In directly with Mobile Number + Passcode (No OTP required)
app.post('/api/auth/login-passcode', loginRateLimiter, async (req, res) => {
  try {
    const { phone, passcode } = req.body || {};
    const clean10 = normalizeTenDigitPhone(phone);
    const cleanPasscode = String(passcode || '').trim();

    if (!clean10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!/^\d{4,6}$/.test(cleanPasscode)) {
      return res.status(400).json({ success: false, message: 'Please enter your 4 to 6-digit numeric passcode.' });
    }

    // Brute-force protection (5 failed attempts -> 60s lock)
    const attempt = passcodeAttemptStore.get(clean10);
    if (attempt && attempt.lockUntil > Date.now()) {
      const waitSec = Math.ceil((attempt.lockUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many incorrect passcode attempts. Try again in ${waitSec}s or reset via OTP.`
      });
    }

    let userRecord = passcodeUserStore.get(clean10) || null;
    if (!userRecord || !userRecord.passcodeHash) {
      const dbUser = await findSupabaseUserByPhone(clean10);
      if (dbUser) {
        userRecord = dbUser;
        passcodeUserStore.set(clean10, dbUser);
      }
    }

    if (!userRecord || !userRecord.passcodeHash) {
      return res.status(404).json({
        success: false,
        code: 'NO_PASSCODE',
        message: 'No passcode found for this mobile number. Please verify once with OTP to set up your passcode.'
      });
    }

    if (userRecord.isBlocked) {
      return res.status(403).json({
        success: false,
        message: `Account suspended: ${userRecord.blockedReason || 'Blocked by Super Admin'}.`
      });
    }

    const matched = verifyPasscodeHash(cleanPasscode, userRecord.passcodeHash);
    if (!matched) {
      const nextCount = (attempt?.count || 0) + 1;
      const lockUntil = nextCount >= 5 ? Date.now() + 60 * 1000 : 0;
      passcodeAttemptStore.set(clean10, { count: nextCount >= 5 ? 0 : nextCount, lockUntil });
      return res.status(401).json({
        success: false,
        message:
          lockUntil > 0
            ? 'Too many incorrect passcode attempts. Locked for 60 seconds, or reset via OTP.'
            : `Incorrect passcode. ${5 - nextCount} attempt${5 - nextCount === 1 ? '' : 's'} remaining.`
      });
    }

    passcodeAttemptStore.delete(clean10);
    const sessionToken = issueUserSessionToken(userRecord);
    setUserSessionCookie(req, res, sessionToken);
    return res.json({
      success: true,
      sessionToken,
      user: sanitizeUserForClient(userRecord)
    });
  } catch (err: any) {
    console.error(`[Passcode Login Error] correlationId=${req.correlationId} code=${err?.code || 'login_passcode_error'}`);
    return res.status(500).json({ success: false, message: 'Internal server error verifying passcode.' });
  }
});

// 6. Endpoint: Reset Forgotten Passcode (Rate limited: 3 attempts/hour/IP)
app.post('/api/auth/reset-passcode', passwordResetRateLimiter, async (req, res) => {
  try {
    const { phone, newPasscode, resetToken, userRecord } = req.body || {};
    const clean10 = normalizeTenDigitPhone(phone);
    const cleanPasscode = String(newPasscode || '').trim();
    const providedToken = String(resetToken || '').trim();

    if (!clean10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required.' });
    }
    if (!/^\d{4,6}$/.test(cleanPasscode)) {
      return res.status(400).json({ success: false, message: 'New passcode must be 4 to 6 numeric digits.' });
    }

    // Strictly require the cryptographically random, single-use, 10-minute resetToken bound to clean10
    const storedTokenRecord = passcodeResetTokenStore.get(clean10);
    let tokenAuthorized = false;
    if (storedTokenRecord && Date.now() <= storedTokenRecord.expiresAt && providedToken) {
      const a = Buffer.from(storedTokenRecord.token);
      const b = Buffer.from(providedToken);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        tokenAuthorized = true;
      }
    }

    if (!tokenAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired reset token. Please verify your mobile number via OTP to obtain a fresh reset token.'
      });
    }

    const existing = passcodeUserStore.get(clean10) || (await findSupabaseUserByPhone(clean10)) || null;
    if (!existing && (!userRecord || !userRecord.name)) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No registered account found for this mobile number. Please register as a new user.'
      });
    }

    if (existing?.isBlocked || userRecord?.isBlocked) {
      return res.status(403).json({
        success: false,
        message: `Account suspended: ${existing?.blockedReason || userRecord?.blockedReason || 'Blocked by Super Admin'}.`
      });
    }

    const hashed = hashPasscode(cleanPasscode);
    const now = new Date().toISOString();
    const mergedUser = {
      ...(existing || {}),
      ...(userRecord && typeof userRecord === 'object' ? userRecord : {}),
      id: existing?.id || userRecord?.id || `usr_${clean10}`,
      name: existing?.name || userRecord?.name || 'Zuggi Member',
      phone: `+91 ${clean10}`,
      role: existing?.role || (userRecord?.role === 'admin' ? 'customer' : userRecord?.role) || 'customer',
      hasPasscode: true,
      passcodeHash: hashed,
      passcodeUpdatedAt: now
    };

    // Consume single-use reset token, revoke all previous sessions, and clear brute-force lockout
    passcodeResetTokenStore.delete(clean10);
    otpVerifiedStore.delete(clean10);
    passcodeAttemptStore.delete(clean10);
    revokeUserSessions(mergedUser.id, clean10);
    passcodeUserStore.set(clean10, mergedUser);
    await upsertSupabaseRecords('vs_users', [mergedUser]);

    const sessionToken = issueUserSessionToken(mergedUser);
    setUserSessionCookie(req, res, sessionToken);
    return res.json({
      success: true,
      message: 'Passcode reset successfully! You can now sign in with your new passcode.',
      sessionToken,
      user: sanitizeUserForClient(mergedUser)
    });
  } catch (err: any) {
    console.error(`[Reset Passcode Error] correlationId=${req.correlationId} code=${err?.code || 'reset_passcode_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to reset passcode. Please try again.' });
  }
});

// --- ACCOUNT & PERSONAL DATA DELETION / ANONYMIZATION ENDPOINT ---
// Stores only hashed phone reference (zero plaintext PII in deletion audit trail)
const accountDeletionRequests: Array<{
  id: string;
  phoneHash: string;
  source: string;
  erasedImmediately: boolean;
  requestedAt: string;
}> = [];

app.post('/api/auth/request-account-deletion', authActionRateLimiter, async (req, res) => {
  const { phone, resetToken, source } = req.body || {};
  const callerSession = verifyUserTokenFromReq(req);
  const digits = String(phone || callerSession?.phone10 || '').replace(/\D/g, '');
  const clean10 = digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10);

  if (clean10.length !== 10 && !callerSession?.userId) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid 10-digit registered mobile number.'
    });
  }

  // Require proof of account ownership (either active user session token OR verified OTP reset token)
  const ownsViaSession = Boolean(
    callerSession && (!clean10 || !callerSession.phone10 || callerSession.phone10 === clean10)
  );
  let ownsViaOtp = false;
  if (clean10) {
    const storedTokenRecord = passcodeResetTokenStore.get(clean10);
    const providedToken = String(resetToken || '').trim();
    if (storedTokenRecord && Date.now() <= storedTokenRecord.expiresAt && providedToken) {
      const a = Buffer.from(storedTokenRecord.token);
      const b = Buffer.from(providedToken);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        ownsViaOtp = true;
      }
    }
    if (!ownsViaOtp && Date.now() <= (otpVerifiedStore.get(clean10) || 0)) {
      ownsViaOtp = true;
    }
  }

  if (!ownsViaSession && !ownsViaOtp) {
    return res.status(401).json({
      success: false,
      code: 'OTP_VERIFICATION_REQUIRED',
      message: 'Please verify ownership of your mobile number via OTP (or sign in) before deleting your account.'
    });
  }

  const refId = `DEL-ZUG-${Date.now().toString().slice(-6)}`;
  const targetUserId = callerSession?.userId || passcodeUserStore.get(clean10)?.id;
  const phoneHash = clean10
    ? crypto.createHash('sha256').update(`zuggi_del:${clean10}`).digest('hex').slice(0, 16)
    : 'session_only';

  // 1. Immediately purge server-side auth stores & active sessions
  if (clean10) {
    passcodeUserStore.delete(clean10);
    passcodeResetTokenStore.delete(clean10);
    passcodeAttemptStore.delete(clean10);
    otpVerifiedStore.delete(clean10);
    otpStore.delete(`+91${clean10}`);

    // 2. Purge matching contact inquiries & trip/driver phone records
    for (let i = contactInquiries.length - 1; i >= 0; i--) {
      if (contactInquiries[i].phone.replace(/\D/g, '').endsWith(clean10)) {
        contactInquiries.splice(i, 1);
      }
    }
    anonymizeDriverDataByPhone(clean10);
  }
  revokeUserSessions(targetUserId, clean10);

  // 3. Permanently delete user & vehicles and anonymize personal fields in Supabase
  const dbErasure = await deleteAndAnonymizeUserDataInSupabase(clean10, targetUserId);

  accountDeletionRequests.unshift({
    id: refId,
    phoneHash,
    source: String(source || 'web_delete_account').trim().slice(0, 60),
    erasedImmediately: true,
    requestedAt: new Date().toISOString()
  });

  return res.json({
    success: true,
    referenceId: refId,
    erasedImmediately: true,
    summary: dbErasure,
    message:
      'Your Zuggi account has been deleted immediately. Personal profile, login credentials, vehicles, and contact records have been erased or anonymized (statutory GST/tax invoice amounts remain archived per Indian law).'
  });
});

// 7. Endpoint: Super Admin First-Run Setup & In-Memory Session Bearer Token
const adminLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();
let claimedAdminPasscodeHash: string | null = null;

async function resolveClaimedAdminPasscodeHash(): Promise<string | null> {
  if (claimedAdminPasscodeHash) return claimedAdminPasscodeHash;
  const ownerDoc = await findSupabaseUserById('owner_baruahg39');
  if (ownerDoc && typeof ownerDoc.adminPasscodeHash === 'string' && ownerDoc.adminPasscodeHash.startsWith('scrypt:')) {
    claimedAdminPasscodeHash = ownerDoc.adminPasscodeHash;
    return claimedAdminPasscodeHash;
  }
  return null;
}

app.get('/api/auth/admin-status', async (_req, res) => {
  const configured = Boolean((process.env.ZUGGI_ADMIN_PASSCODE || '').trim());
  const claimed = Boolean(await resolveClaimedAdminPasscodeHash());
  return res.json({
    success: true,
    configured,
    claimed,
    requiresSetup: !configured && !claimed
  });
});

app.post('/api/auth/admin-claim', loginRateLimiter, async (req, res) => {
  const configuredPasscode = (process.env.ZUGGI_ADMIN_PASSCODE || '').trim();
  const existingClaim = await resolveClaimedAdminPasscodeHash();

  if (configuredPasscode || existingClaim) {
    return res.status(409).json({
      success: false,
      message: 'Super Admin credential is already configured. Please sign in with your passcode.'
    });
  }

  const { email, passcode } = req.body || {};
  const ownerEmail = (process.env.SUPER_ADMIN_EMAIL || 'baruahg39@gmail.com').trim().toLowerCase();
  const providedEmail = String(email || '').trim().toLowerCase();
  const providedPasscode = String(passcode || '').trim();

  if (providedEmail !== ownerEmail) {
    return res.status(403).json({ success: false, message: 'Unauthorized admin identity.' });
  }
  if (providedPasscode.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Please choose a Super Admin passcode of at least 8 characters.'
    });
  }

  const hashed = hashPasscode(providedPasscode);
  claimedAdminPasscodeHash = hashed;

  // Persist hashed admin credential if Supabase is configured (non-blocking if unconfigured)
  const existingOwner = (await findSupabaseUserById('owner_baruahg39')) || {
    id: 'owner_baruahg39',
    name: 'G. Baruah (Platform Owner)',
    email: ownerEmail,
    role: 'admin',
    isVerified: true,
    createdAt: '2026-01-01T00:00:00Z'
  };
  await upsertSupabaseRecords(
    'vs_users',
    [
      {
        ...existingOwner,
        role: 'admin',
        email: ownerEmail,
        isVerified: true,
        adminPasscodeHash: hashed,
        adminPasscodeUpdatedAt: new Date().toISOString()
      }
    ],
    { isAdmin: true }
  );

  const token = issueAdminSessionToken(ownerEmail);
  setAdminSessionCookie(req, res, token);
  return res.json({ success: true, token });
});

app.post('/api/auth/admin-session', loginRateLimiter, async (req, res) => {
  const clientKey = String(req.ip || req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const attemptState = adminLoginAttempts.get(clientKey);
  if (attemptState && attemptState.lockedUntil > Date.now()) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed admin login attempts. Please try again in 10 minutes.'
    });
  }

  const recordFailure = () => {
    const prev = adminLoginAttempts.get(clientKey) || { count: 0, lockedUntil: 0 };
    const nextCount = prev.count + 1;
    adminLoginAttempts.set(clientKey, {
      count: nextCount,
      lockedUntil: nextCount >= 5 ? Date.now() + 10 * 60 * 1000 : 0
    });
  };

  const { email, passcode } = req.body || {};
  const ownerEmail = (process.env.SUPER_ADMIN_EMAIL || 'baruahg39@gmail.com').trim().toLowerCase();
  const providedEmail = String(email || '').trim().toLowerCase();
  const providedPasscode = String(passcode || '').trim();
  const configuredPasscode = (process.env.ZUGGI_ADMIN_PASSCODE || '').trim();

  if (providedEmail !== ownerEmail) {
    recordFailure();
    return res.status(403).json({ success: false, message: 'Unauthorized admin identity.' });
  }

  if (!providedPasscode) {
    recordFailure();
    return res.status(401).json({ success: false, message: 'Admin credential required.' });
  }

  if (configuredPasscode) {
    const a = Buffer.from(providedPasscode);
    const b = Buffer.from(configuredPasscode);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      recordFailure();
      return res.status(401).json({ success: false, message: 'Invalid admin passcode.' });
    }
  } else {
    const claimedHash = await resolveClaimedAdminPasscodeHash();
    if (!claimedHash) {
      return res.status(409).json({
        success: false,
        code: 'ADMIN_SETUP_REQUIRED',
        message: 'Super Admin passcode is not initialized yet. Complete first-run setup or configure ZUGGI_ADMIN_PASSCODE.'
      });
    }
    if (!verifyPasscodeHash(providedPasscode, claimedHash)) {
      recordFailure();
      return res.status(401).json({ success: false, message: 'Invalid admin passcode.' });
    }
  }

  adminLoginAttempts.delete(clientKey);
  const token = issueAdminSessionToken(ownerEmail);
  setAdminSessionCookie(req, res, token);
  return res.json({ success: true, token });
});

// 8. Endpoint: Authoritative Partner Verification Status (Auth + Ownership Verified — No IDOR)
app.get('/api/partner/verification-status', async (req, res) => {
  try {
    const isAdmin = verifyAdminTokenFromReq(req);
    const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;

    if (!isAdmin && !callerSession) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to check partner verification status.'
      });
    }

    const requestedUserId = String(req.query.userId || '').trim();
    const requestedClean10 = normalizeTenDigitPhone(String(req.query.phone || ''));

    // Non-admin callers may ONLY query their own verification status
    if (!isAdmin && callerSession) {
      const idMismatch = Boolean(requestedUserId && callerSession.userId && requestedUserId !== callerSession.userId);
      const phoneMismatch = Boolean(requestedClean10 && callerSession.phone10 && requestedClean10 !== callerSession.phone10);
      if (idMismatch || phoneMismatch) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You may only access your own verification status.'
        });
      }
    }

    const userId = isAdmin ? requestedUserId : (callerSession?.userId || requestedUserId);
    const clean10 = isAdmin ? requestedClean10 : (callerSession?.phone10 || requestedClean10);

    if (!userId && !clean10) {
      return res.status(400).json({ success: false, message: 'userId or phone is required.' });
    }

    let userRecord: any = clean10 ? passcodeUserStore.get(clean10) || null : null;
    const dbById = userId ? await findSupabaseUserById(userId) : null;
    const dbByPhone = !dbById && clean10 ? await findSupabaseUserByPhone(clean10) : null;
    const authoritativeUser = dbById || dbByPhone || userRecord;

    if (!authoritativeUser) {
      return res.json({
        success: true,
        found: false,
        isVerified: false,
        isBlocked: false,
        verifiedVehicleCount: 0,
        totalVehicleCount: 0,
        status: 'PENDING_APPROVAL'
      });
    }

    if (clean10 && dbById) {
      passcodeUserStore.set(clean10, { ...(userRecord || {}), ...dbById });
    }

    const vehicles = await findSupabaseVehiclesByOwner(String(authoritativeUser.id || userId));
    const verifiedVehicles = vehicles.filter((v: any) => v.verificationStatus === 'verified' && !v.isBlocked);
    const isVerified = authoritativeUser.isVerified === true;
    const isBlocked = Boolean(authoritativeUser.isBlocked);

    return res.json({
      success: true,
      found: true,
      userId: authoritativeUser.id,
      isVerified,
      isBlocked,
      blockedReason: authoritativeUser.blockedReason || undefined,
      verifiedVehicleCount: verifiedVehicles.length,
      totalVehicleCount: vehicles.length,
      vehicles: vehicles.map((v: any) => ({
        id: v.id,
        registrationNumber: v.registrationNumber,
        verificationStatus: v.verificationStatus || 'pending',
        isBlocked: Boolean(v.isBlocked)
      })),
      status: isBlocked ? 'SUSPENDED' : isVerified ? 'APPROVED' : 'PENDING_APPROVAL'
    });
  } catch (err: any) {
    console.error(`[Partner Verification Status Error] correlationId=${req.correlationId} code=${err?.code || 'status_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to check verification status.' });
  }
});

// 9. Endpoint: Admin Partner / Vehicle Approval (Backend Source of Truth)
app.post('/api/admin/partners/verify', async (req, res) => {
  if (!verifyAdminTokenFromReq(req)) {
    return res.status(403).json({
      success: false,
      message: 'Admin authentication required to approve or revoke partner verification.'
    });
  }

  try {
    const { userId, phone, approved, notes, vehicleId } = req.body || {};
    const clean10 = normalizeTenDigitPhone(phone);
    const isApproved = Boolean(approved);

    let targetUser =
      (userId ? await findSupabaseUserById(String(userId)) : null) ||
      (clean10 ? await findSupabaseUserByPhone(clean10) : null) ||
      (clean10 ? passcodeUserStore.get(clean10) : null);

    if (!targetUser && !vehicleId) {
      return res.status(404).json({ success: false, message: 'Partner account not found on backend.' });
    }

    if (targetUser) {
      const updatedUser = {
        ...targetUser,
        isVerified: isApproved,
        verifiedAt: isApproved ? new Date().toISOString() : undefined,
        verificationNotes: notes ? String(notes).slice(0, 400) : undefined
      };
      const targetPhone10 = normalizeTenDigitPhone(updatedUser.phone || phone);
      if (targetPhone10) {
        const memPrev = passcodeUserStore.get(targetPhone10) || {};
        passcodeUserStore.set(targetPhone10, { ...memPrev, ...updatedUser });
      }
      await upsertSupabaseRecords('vs_users', [updatedUser], { isAdmin: true });

      // Update partner vehicles in Supabase as well
      const ownerVehicles = await findSupabaseVehiclesByOwner(String(updatedUser.id));
      const vehiclesToUpdate = vehicleId
        ? ownerVehicles.filter((v: any) => v.id === vehicleId)
        : ownerVehicles;

      if (vehiclesToUpdate.length > 0) {
        const nextVehicles = vehiclesToUpdate.map((v: any) => ({
          ...v,
          verificationStatus: isApproved ? 'verified' : 'pending',
          isOnline: isApproved ? v.isOnline : false,
          isAvailable: isApproved ? true : false
        }));
        await upsertSupabaseRecords('vs_vehicles', nextVehicles, { isAdmin: true });
      }

      return res.json({
        success: true,
        isVerified: isApproved,
        user: sanitizeUserForClient(updatedUser),
        message: isApproved
          ? 'Partner approved on backend! Driver/Owner can now bid on and accept loads.'
          : 'Partner verification revoked. Load access locked until re-approved.'
      });
    }

    return res.json({ success: true, isVerified: isApproved });
  } catch (err: any) {
    console.error(`[Admin Partner Verify Error] correlationId=${req.correlationId} code=${err?.code || 'partner_verify_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to update partner verification.' });
  }
});

// --- API Endpoint: Real-time Northeast India Logistics Intelligence & Fuel Trends ---
interface CachedIntelligence {
  content: string;
  sources: Array<{ title: string; uri: string }>;
  timestamp: string;
  isLiveGrounded: boolean;
}

let cachedIntelligence: CachedIntelligence | null = null;
let lastCacheTimestamp = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15-minute TTL

const REGIONAL_BENCHMARK_INTELLIGENCE: CachedIntelligence = {
  content: `### ⛽ Northeast India Commercial Fuel Prices
- **Guwahati (Assam):** Diesel: ₹90.35/L | Petrol: ₹98.20/L (Stable)
- **Shillong (Meghalaya):** Diesel: ₹87.80/L | Petrol: ₹96.40/L (Lower tax slab)
- **Dimapur (Nagaland):** Diesel: ₹91.10/L | Petrol: ₹99.15/L
- **Silchar (Barak Valley):** Diesel: ₹90.85/L | Petrol: ₹98.90/L
- **Dibrugarh (Upper Assam):** Diesel: ₹90.60/L | Petrol: ₹98.45/L

### 🛣️ Corridor & Highway Freight Status
- **NH-27 East-West Corridor (Guwahati - Nagaon - Dergaon):** Clear 4-lane freight transit with smooth Fastag movement at Dergaon and Raha toll plazas.
- **NH-37 Upper Assam (Jorhat to Dibrugarh):** High-volume tea cargo transport towards Inland Container Depot (ICD) Amingaon; weighbridges operational.
- **Barak Valley Gateway (Guwahati to Silchar via Meghalaya):** Standard transit; hill curves operating smoothly.
- **Assam-Nagaland Border (NH-29 Dimapur):** Active commercial check-gates; commercial e-Way bills validated swiftly.

### 📦 Key Logistics Industry Developments
- Additional container rakes scheduled from ICD Amingaon connecting Northeast tea & FMCG manufacturers directly to Kolkata and Haldia ports.
- Goods Transport Agencies reporting steady backhaul freight availability for agricultural spices, cement, and timber consignments across Kamrup Metro and Cachar hubs.`,
  sources: [
    { title: 'Indian Oil Fuel Price Tracker', uri: 'https://iocl.com' },
    { title: 'National Highways Authority of India (NHAI)', uri: 'https://nhai.gov.in' },
    { title: 'Inland Container Depot Amingaon Logistics Portal', uri: 'https://concorindia.co.in' },
    { title: 'Ministry of Road Transport & Highways (MoRTH)', uri: 'https://morth.nic.in' }
  ],
  timestamp: new Date().toISOString(),
  isLiveGrounded: false
};

app.get('/api/logistics-intelligence', async (req, res) => {
  const isForceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  if (cachedIntelligence && !isForceRefresh && (now - lastCacheTimestamp < CACHE_DURATION_MS)) {
    return res.json({
      success: true,
      data: cachedIntelligence
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    cachedIntelligence = {
      ...REGIONAL_BENCHMARK_INTELLIGENCE,
      timestamp: new Date().toISOString()
    };
    lastCacheTimestamp = now;
    return res.json({
      success: true,
      data: cachedIntelligence
    });
  }

  try {
    const ai = new GoogleGenAI();
    const prompt = `You are a commercial freight and logistics intelligence analyst for Northeast India (Assam, Meghalaya, Nagaland, Tripura, Arunachal Pradesh, Manipur, Mizoram).
Search the web for today's latest logistics news, freight corridor status, and fuel price trends (Diesel & Petrol in Guwahati, Shillong, Dimapur, Silchar, Dibrugarh).

Provide a concise, highly practical briefing for shippers and commercial truck owners:
1. Current Diesel & Petrol price trends across key Northeast commercial hubs.
2. Highway status on major freight corridors (NH-27 East-West corridor, NH-37 Upper Assam, NH-29 Dimapur corridor, Barak Valley route).
3. Commercial transport & freight market updates (tea consignments, FMCG movement, ICD Amingaon rail-container connectivity, Mandi supply flows).
4. Practical advisory for fleet operators and transporters.

Use markdown with clean headings and bullet points.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Web Source',
        uri: chunk.web?.uri
      }));

    cachedIntelligence = {
      content: text,
      sources,
      timestamp: new Date().toISOString(),
      isLiveGrounded: true
    };
    lastCacheTimestamp = Date.now();

    res.json({
      success: true,
      data: cachedIntelligence
    });
  } catch (_error: any) {
    cachedIntelligence = {
      ...REGIONAL_BENCHMARK_INTELLIGENCE,
      timestamp: new Date().toISOString()
    };
    lastCacheTimestamp = Date.now();

    res.json({
      success: true,
      data: cachedIntelligence
    });
  }
});

// --- CASHFREE PAYMENTS EASY SPLIT SECURE SERVER ENDPOINTS ---

const PLATFORM_COMMISSION_RATE = 0.05; // 5% platform commission
const GST_ON_COMMISSION_RATE = 0.18; // 18% GST on platform commission (SAC 9965)

interface ServerPaymentOrderRecord {
  orderId: string;
  bookingId?: string;
  stage: 'advance_90' | 'balance_10';
  ownerUserId: string;
  expectedAmountInr: number;
  commissionInr: number;
  gstOnCommissionInr: number;
  driverNetPayoutInr: number;
  driverVendorId?: string;
  status: 'ACTIVE' | 'PAID' | 'FAILED';
  verifiedByGateway: boolean;
  createdAt: string;
  paidAt?: string;
}

const serverPaymentOrders = new Map<string, ServerPaymentOrderRecord>();

function computeServerSideEscrowBreakdown(baseFreightInr: number, stage: 'advance_90' | 'balance_10') {
  const stageRatio = stage === 'advance_90' ? 0.9 : 0.1;
  const stageGrossInr = Math.round(baseFreightInr * stageRatio);
  const commissionInr = Math.round(stageGrossInr * PLATFORM_COMMISSION_RATE);
  const gstOnCommissionInr = Math.round(commissionInr * GST_ON_COMMISSION_RATE);
  const driverNetPayoutInr = Math.max(0, stageGrossInr - commissionInr - gstOnCommissionInr);
  return { stageGrossInr, commissionInr, gstOnCommissionInr, driverNetPayoutInr };
}

app.get('/api/payments/cashfree/config', (_req, res) => {
  res.json({
    success: true,
    isConfigured: cashfreeServer.isConfigured(),
    environment: cashfreeServer.getEnvironment(),
    merchantType: 'Marketplace Easy Split',
    commissionRatePct: 5
  });
});

app.post('/api/payments/cashfree/create-order', async (req, res) => {
  try {
    const isAdmin = verifyAdminTokenFromReq(req);
    const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;
    if (!isAdmin && !callerSession) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to initiate a payment order.'
      });
    }

    const { orderId, bookingId, stage, orderAmount, customerDetails, orderNote } = req.body || {};

    if (!orderId || !customerDetails) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: orderId and customerDetails are mandatory.'
      });
    }

    const cleanOrderId = String(orderId).trim().slice(0, 64);
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(cleanOrderId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId format.' });
    }

    const resolvedStage: 'advance_90' | 'balance_10' =
      stage === 'balance_10' || cleanOrderId.includes('balance_10') ? 'balance_10' : 'advance_90';

    let authoritativeAmount = 0;
    let authoritativeDriverVendorId: string | undefined;
    let breakdown = { stageGrossInr: 0, commissionInr: 0, gstOnCommissionInr: 0, driverNetPayoutInr: 0 };

    // Always derive authoritative price, tax, and split from server-side booking record when available
    const cleanBookingId = bookingId ? String(bookingId).trim() : '';
    const dbBooking = cleanBookingId ? await findSupabaseBookingById(cleanBookingId) : null;

    if (dbBooking) {
      if (!isAdmin && callerSession && String(dbBooking.customerId || '') !== callerSession.userId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You may only initiate payments for your own booking.'
        });
      }
      const totalAgreed = Number(dbBooking.totalAgreedAmountInr || 0);
      if (!Number.isFinite(totalAgreed) || totalAgreed < 100) {
        return res.status(400).json({ success: false, message: 'Booking freight amount is invalid.' });
      }
      breakdown = computeServerSideEscrowBreakdown(totalAgreed, resolvedStage);
      authoritativeAmount = breakdown.stageGrossInr;

      // Reject tampered client amounts
      if (orderAmount !== undefined && Math.abs(Number(orderAmount) - authoritativeAmount) > 1) {
        return res.status(400).json({
          success: false,
          code: 'PRICE_MISMATCH',
          message: 'Submitted payment amount does not match server-calculated booking total.'
        });
      }

      if (dbBooking.driverId || dbBooking.transporterId) {
        const payeeId = String(dbBooking.driverId || dbBooking.transporterId).replace(/[^a-zA-Z0-9_-]/g, '_');
        authoritativeDriverVendorId = `vnd_${payeeId}`;
      }
    } else {
      // Production requires an authoritative booking record; non-production enforces strict bounds & server-side split math
      if (IS_PRODUCTION) {
        return res.status(400).json({
          success: false,
          message: 'Valid server-registered bookingId is required to create a payment order in production.'
        });
      }
      const submittedAmount = Math.round(Number(orderAmount));
      if (!Number.isFinite(submittedAmount) || submittedAmount < 100 || submittedAmount > 5_000_000) {
        return res.status(400).json({
          success: false,
          message: 'Order amount must be between ₹100 and ₹50,00,000.'
        });
      }
      const commissionInr = Math.round(submittedAmount * PLATFORM_COMMISSION_RATE);
      const gstOnCommissionInr = Math.round(commissionInr * GST_ON_COMMISSION_RATE);
      const driverNetPayoutInr = Math.max(0, submittedAmount - commissionInr - gstOnCommissionInr);
      breakdown = { stageGrossInr: submittedAmount, commissionInr, gstOnCommissionInr, driverNetPayoutInr };
      authoritativeAmount = submittedAmount;
    }

    const ownerUserId = isAdmin
      ? String(customerDetails.customer_id || 'owner_baruahg39')
      : callerSession!.userId;

    // Data minimization: bind customer_id to authenticated identity
    const minimalCustomerDetails = {
      customer_id: ownerUserId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50),
      customer_name: String(customerDetails.customer_name || 'Zuggi Customer').trim().slice(0, 100),
      customer_email: String(customerDetails.customer_email || 'customer@zuggi.in').trim().slice(0, 100),
      customer_phone: String(customerDetails.customer_phone || callerSession?.phone10 || '').replace(/\D/g, '').slice(-10)
    };

    // Never trust client-supplied orderSplits: compute splits strictly server-side
    const serverCalculatedSplits =
      authoritativeDriverVendorId && breakdown.driverNetPayoutInr > 0
        ? [{ vendor_id: authoritativeDriverVendorId, amount: breakdown.driverNetPayoutInr }]
        : undefined;

    const orderResponse = await cashfreeServer.createOrder({
      orderId: cleanOrderId,
      orderAmount: authoritativeAmount,
      customerDetails: minimalCustomerDetails,
      orderNote: String(orderNote || `Zuggi Escrow (${resolvedStage})`).slice(0, 120),
      orderSplits: serverCalculatedSplits
    });

    serverPaymentOrders.set(cleanOrderId, {
      orderId: cleanOrderId,
      bookingId: cleanBookingId || undefined,
      stage: resolvedStage,
      ownerUserId,
      expectedAmountInr: authoritativeAmount,
      commissionInr: breakdown.commissionInr,
      gstOnCommissionInr: breakdown.gstOnCommissionInr,
      driverNetPayoutInr: breakdown.driverNetPayoutInr,
      driverVendorId: authoritativeDriverVendorId,
      status: 'ACTIVE',
      verifiedByGateway: false,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        ...orderResponse,
        serverCalculated: {
          orderAmountInr: authoritativeAmount,
          commissionInr: breakdown.commissionInr,
          gstOnCommissionInr: breakdown.gstOnCommissionInr,
          driverNetPayoutInr: breakdown.driverNetPayoutInr
        }
      }
    });
  } catch (error: any) {
    console.error(`[Create Cashfree Order Error] correlationId=${req.correlationId} code=${error?.code || 'order_error'}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error creating payment order.'
    });
  }
});

app.post('/api/payments/cashfree/verify-order', async (req, res) => {
  try {
    const isAdmin = verifyAdminTokenFromReq(req);
    const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;
    if (!isAdmin && !callerSession) {
      return res.status(401).json({ success: false, message: 'Authentication required to verify a payment order.' });
    }

    const cleanOrderId = String(req.body?.orderId || '').trim().slice(0, 64);
    if (!cleanOrderId || !/^[a-zA-Z0-9_-]{3,64}$/.test(cleanOrderId)) {
      return res.status(400).json({ success: false, message: 'Valid orderId is required.' });
    }

    const trackedOrder = serverPaymentOrders.get(cleanOrderId);
    if (trackedOrder && !isAdmin && callerSession && trackedOrder.ownerUserId !== callerSession.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You may only verify your own payment orders.'
      });
    }

    // If webhook already verified payment server-side, return authoritative PAID record
    if (trackedOrder?.status === 'PAID' && trackedOrder.verifiedByGateway) {
      return res.json({
        success: true,
        data: {
          order_id: cleanOrderId,
          order_status: 'PAID',
          verified: true,
          order_amount: trackedOrder.expectedAmountInr,
          paid_at: trackedOrder.paidAt
        }
      });
    }

    const orderData: any = await cashfreeServer.getOrder(cleanOrderId);
    const gatewayPaid =
      orderData?.order_status === 'PAID' &&
      orderData?.verified === true &&
      (!trackedOrder || Math.abs(Number(orderData?.order_amount ?? trackedOrder.expectedAmountInr) - trackedOrder.expectedAmountInr) <= 1);

    if (gatewayPaid && trackedOrder) {
      trackedOrder.status = 'PAID';
      trackedOrder.verifiedByGateway = true;
      trackedOrder.paidAt = new Date().toISOString();
    }

    res.json({
      success: true,
      data: {
        ...orderData,
        verified: gatewayPaid
      }
    });
  } catch (error: any) {
    console.error(`[Verify Cashfree Order Error] correlationId=${req.correlationId} code=${error?.code || 'verify_error'}`);
    res.status(500).json({ success: false, message: 'Failed to verify payment order.' });
  }
});

app.get('/api/payments/cashfree/order-status/:orderId', (req, res) => {
  const isAdmin = verifyAdminTokenFromReq(req);
  const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;
  if (!isAdmin && !callerSession) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const cleanOrderId = String(req.params.orderId || '').trim();
  const trackedOrder = serverPaymentOrders.get(cleanOrderId);
  if (!trackedOrder) {
    return res.status(404).json({ success: false, message: 'Payment order not found.' });
  }
  if (!isAdmin && callerSession && trackedOrder.ownerUserId !== callerSession.userId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Order belongs to another user.' });
  }
  return res.json({
    success: true,
    orderId: trackedOrder.orderId,
    status: trackedOrder.status,
    verifiedPaid: trackedOrder.status === 'PAID' && trackedOrder.verifiedByGateway,
    expectedAmountInr: trackedOrder.expectedAmountInr
  });
});

app.post('/api/payments/cashfree/register-vendor', async (req, res) => {
  try {
    const isAdmin = verifyAdminTokenFromReq(req);
    const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;
    if (!isAdmin && !callerSession) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to register payout vendor details.'
      });
    }

    const { vendor_id, name, email, phone, bank_account_number, bank_ifsc, upi_vpa, pan, verify_account } = req.body || {};

    if (!vendor_id || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'vendor_id, name, email, and phone are required for vendor registration.'
      });
    }

    const cleanVendorId = String(vendor_id).trim().slice(0, 50);
    // Prevent IDOR payout hijacking: non-admin drivers can only register/update their own vendor ID
    if (!isAdmin && callerSession) {
      const expectedVendorId = `vnd_${callerSession.userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (cleanVendorId !== expectedVendorId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You may only update payout details for your own partner account.'
        });
      }
    }

    // Data minimization: forward only either bank details OR UPI VPA (never redundant payout fields)
    const hasBank = Boolean(bank_account_number && bank_ifsc);
    const vendorResponse = await cashfreeServer.registerVendor({
      vendor_id: cleanVendorId,
      name: String(name).trim().slice(0, 100),
      email: String(email).trim().slice(0, 100),
      phone: String(phone).replace(/\D/g, '').slice(-10),
      bank_account_number: hasBank ? String(bank_account_number).replace(/\s+/g, '') : undefined,
      bank_ifsc: hasBank ? String(bank_ifsc).trim().toUpperCase() : undefined,
      upi_vpa: !hasBank && upi_vpa ? String(upi_vpa).trim() : undefined,
      pan: pan ? String(pan).trim().toUpperCase().slice(0, 10) : undefined,
      verify_account: verify_account !== false
    });

    res.json({ success: true, data: vendorResponse });
  } catch (error: any) {
    console.error(`[Register Cashfree Vendor Error] correlationId=${req.correlationId} code=${error?.code || 'vendor_error'}`);
    res.status(500).json({ success: false, message: 'Failed to register payout vendor.' });
  }
});

app.post('/api/payments/cashfree/webhook', (req, res) => {
  try {
    const signature = (req.headers['x-webhook-signature'] as string) || '';
    const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const isValid = cashfreeServer.verifyWebhook(signature, timestamp, rawBody);
    if (!isValid) {
      console.warn(`[Cashfree Webhook Rejected] correlationId=${req.correlationId} invalid_signature_or_timestamp`);
      return res.status(401).json({ success: false, message: 'Invalid webhook signature or expired timestamp.' });
    }

    const event = req.body || {};
    const eventType = String(event?.type || '');
    const orderId = String(event?.data?.order?.order_id || '').trim();
    const paidAmount = Number(event?.data?.order?.order_amount || event?.data?.payment?.payment_amount || 0);
    const paymentStatus = String(event?.data?.payment?.payment_status || event?.data?.order?.order_status || '').toUpperCase();

    if (orderId && (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || paymentStatus === 'SUCCESS' || paymentStatus === 'PAID')) {
      const tracked = serverPaymentOrders.get(orderId);
      if (tracked) {
        if (paidAmount > 0 && Math.abs(paidAmount - tracked.expectedAmountInr) <= 1) {
          tracked.status = 'PAID';
          tracked.verifiedByGateway = true;
          tracked.paidAt = new Date().toISOString();
        } else {
          tracked.status = 'FAILED';
          tracked.verifiedByGateway = false;
        }
      }
    }

    res.status(200).json({ success: true, received: true });
  } catch (err: any) {
    console.error(`[Cashfree Webhook Error] correlationId=${req.correlationId}:`, err?.code || 'webhook_error');
    res.status(500).json({ success: false, message: 'Failed to process payment webhook.' });
  }
});

// --- 70% LOADING ADVANCE + 30% POD BALANCE CASHFREE EASY SPLIT ESCROW ENGINE ---
app.post('/api/webhooks/cashfree', cashfreeEscrowWebhookHandler);
app.use('/api', escrowRouter);
app.use('/api', businessRouter);

// --- OPENSTREETMAP FREE ROUTING & GEOCODING PROXY (Photon + Nominatim + OSRM) ---
// 100% free, zero API keys required.

const DEFAULT_ASSAM_CENTER = { lat: 26.1445, lng: 91.7362 };

app.get('/api/config/maps', (_req, res) => {
  res.json({
    provider: 'openstreetmap',
    tilesUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    requiresApiKey: false,
    configured: true
  });
});

// Known Northeast Logistics Hubs for offline coordinate fallback
const NE_LOGISTICS_HUBS = [
  { city: 'Guwahati', lat: 26.1445, lng: 91.7362, pincode: '781028', address: 'Beltola Wholesale Transport Yard, GS Road, Guwahati', state: 'Assam' },
  { city: 'Nagaon', lat: 26.3475, lng: 92.6845, pincode: '782001', address: 'Haibargaon Freight Transit Hub, Nagaon', state: 'Assam' },
  { city: 'Jorhat', lat: 26.7509, lng: 94.2037, pincode: '785001', address: 'Gar-Ali Commercial Transport Hub, Jorhat', state: 'Assam' },
  { city: 'Dibrugarh', lat: 27.4728, lng: 94.9120, pincode: '786001', address: 'Chowkidingee Transport Hub, Dibrugarh', state: 'Assam' },
  { city: 'Tinsukia', lat: 27.4922, lng: 95.3468, pincode: '786125', address: 'Bordoloi Nagar Industrial Yard, Tinsukia', state: 'Assam' },
  { city: 'Silchar', lat: 24.8333, lng: 92.7789, pincode: '788001', address: 'Tarapur Railway Yard & Transport Corridor, Silchar', state: 'Assam' },
  { city: 'Tezpur', lat: 26.6528, lng: 92.7926, pincode: '784001', address: 'Mission Chariali Truck Terminal, Tezpur', state: 'Assam' },
  { city: 'Bongaigaon', lat: 26.5024, lng: 90.5432, pincode: '783380', address: 'Dhaligaon Industrial Corridor, Bongaigaon', state: 'Assam' },
  { city: 'Dimapur', lat: 25.9095, lng: 93.7265, pincode: '797112', address: 'Purana Bazar Logistics Depot, Dimapur', state: 'Nagaland' },
  { city: 'Shillong', lat: 25.5788, lng: 91.8933, pincode: '793001', address: 'Mawblei Goods Depot, Shillong', state: 'Meghalaya' },
  { city: 'Agartala', lat: 23.8315, lng: 91.2868, pincode: '799001', address: 'Badharghat Transport Hub, Agartala', state: 'Tripura' },
  { city: 'Kolkata', lat: 22.5726, lng: 88.3639, pincode: '700001', address: 'Kolkata Port Logistics Depot, Strand Road, Kolkata', state: 'West Bengal' },
  { city: 'Siliguri', lat: 26.7271, lng: 88.3953, pincode: '734001', address: 'Sevoke Road Freight Terminal, Siliguri', state: 'West Bengal' }
];

function findNearestHub(lat: number, lng: number) {
  let nearest = NE_LOGISTICS_HUBS[0];
  let minDistance = Infinity;
  for (const hub of NE_LOGISTICS_HUBS) {
    const d = Math.hypot(hub.lat - lat, hub.lng - lng);
    if (d < minDistance) {
      minDistance = d;
      nearest = hub;
    }
  }
  return nearest;
}

function haversineStraightKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// 0. Endpoint: Free Address Autocomplete via Photon (biased to Guwahati, Assam) with Nominatim fallback
app.get('/api/maps/autocomplete', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 140);
    if (q.length < 2) {
      return res.json({ success: true, source: 'photon', results: [] });
    }

    const biasLat = Number.isFinite(Number(req.query.lat)) ? Number(req.query.lat) : DEFAULT_ASSAM_CENTER.lat;
    const biasLon = Number.isFinite(Number(req.query.lon)) ? Number(req.query.lon) : DEFAULT_ASSAM_CENTER.lng;
    const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 6));

    // Primary: Photon API biased toward Northeast India / Assam
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${biasLat}&lon=${biasLon}&limit=${limit}`;
      const pRes = await fetch(photonUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ZuggiFreight/1.0 (https://zuggi.in)'
        },
        signal: AbortSignal.timeout(5500)
      });

      if (pRes.ok) {
        const data: any = await pRes.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        const results = features
          .map((f: any) => {
            const coords = f?.geometry?.coordinates;
            const props = f?.properties || {};
            const lng = Number(coords?.[0]);
            const lat = Number(coords?.[1]);
            if (!isValidLatLng(lat, lng)) return null;

            const name = props.name || props.street || '';
            const locality = props.locality || props.district || props.suburb || '';
            const city = props.city || props.town || props.village || props.county || locality || name || '';
            const state = props.state || 'Assam';
            const pincode = props.postcode || '';
            const country = props.country || 'India';

            const parts = [name, props.street, locality, city, state, pincode, country].filter(
              (p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx
            );
            const labelParts = [name || locality, city, state].filter(
              (p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx
            );

            return {
              label: labelParts.join(', ') || parts.slice(0, 3).join(', '),
              address: parts.join(', '),
              city: city || name || 'Assam',
              district: props.county || props.district || city || '',
              state,
              pincode,
              countryCode: String(props.countrycode || '').toLowerCase(),
              lat,
              lng
            };
          })
          .filter(Boolean);

        // Prefer Indian locations when available
        const indian = results.filter((r: any) => !r.countryCode || r.countryCode === 'in');
        const finalResults = indian.length > 0 ? indian : results;
        if (finalResults.length > 0) {
          return res.json({ success: true, source: 'photon', results: finalResults.slice(0, limit) });
        }
      }
    } catch {
      console.warn('[Autocomplete Notice] Photon unreachable, trying Nominatim fallback.');
    }

    // Fallback: Nominatim search scoped to India
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=${limit}&q=${encodeURIComponent(q)}`;
      const nRes = await fetch(nomUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ZuggiFreight/1.0 (https://zuggi.in)'
        },
        signal: AbortSignal.timeout(5500)
      });

      if (nRes.ok) {
        const items: any[] = await nRes.json();
        const results = (Array.isArray(items) ? items : [])
          .map((item: any) => {
            const lat = Number(item.lat);
            const lng = Number(item.lon);
            if (!isValidLatLng(lat, lng)) return null;
            const addr = item.address || {};
            const city =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.state_district ||
              addr.county ||
              String(item.display_name || '').split(',')[0]?.trim() ||
              '';
            const state = addr.state || 'Assam';
            const labelParts = [addr.road || addr.neighbourhood || addr.suburb, city, state].filter(
              (p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx
            );
            return {
              label:
                labelParts.length >= 2
                  ? labelParts.join(', ')
                  : String(item.display_name || '').split(',').slice(0, 3).map((s: string) => s.trim()).join(', '),
              address: String(item.display_name || ''),
              city,
              district: addr.state_district || addr.county || city,
              state,
              pincode: addr.postcode || '',
              lat,
              lng
            };
          })
          .filter(Boolean);

        return res.json({ success: true, source: 'nominatim', results });
      }
    } catch {
      console.warn('[Autocomplete Notice] Nominatim fallback also unreachable.');
    }

    // Final local NE hubs filter fallback
    const lowerQ = q.toLowerCase();
    const matchedHubs = NE_LOGISTICS_HUBS.filter(
      (h) => h.city.toLowerCase().includes(lowerQ) || h.address.toLowerCase().includes(lowerQ) || h.state.toLowerCase().includes(lowerQ)
    ).map((h) => ({
      label: `${h.city}, ${h.state}`,
      address: h.address,
      city: h.city,
      district: h.city,
      state: h.state,
      pincode: h.pincode,
      lat: h.lat,
      lng: h.lng
    }));

    return res.json({ success: true, source: 'local_hubs', results: matchedHubs });
  } catch (error: any) {
    console.error('[Autocomplete Error]', error?.code || 'autocomplete_error');
    res.status(500).json({ success: false, message: 'Address search service unavailable.' });
  }
});

// 1. Endpoint: Free Reverse Geocode via Nominatim (Coordinates -> Structured Address)
app.get('/api/maps/reverse-geocode', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng query params are required.' });
    }

    const nearest = findNearestHub(lat, lng);

    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
      const osmRes = await fetch(osmUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ZuggiFreight/1.0 (https://zuggi.in)'
        },
        signal: AbortSignal.timeout(5500)
      });
      if (osmRes.ok) {
        const osm: any = await osmRes.json();
        const addr = osm?.address || {};
        const road = addr.road || addr.pedestrian || addr.highway || addr.industrial || '';
        const area =
          addr.suburb || addr.neighbourhood || addr.locality || addr.quarter || addr.village || addr.hamlet || '';
        const city =
          addr.city || addr.town || addr.village || addr.county || addr.state_district || nearest.city;
        const state = addr.state || nearest.state;
        const pincode = addr.postcode || '';
        const formatted_address =
          osm?.display_name ||
          [road, area, city, state, pincode].filter(Boolean).join(', ');
        if (formatted_address) {
          return res.json({
            success: true,
            source: 'nominatim',
            lat,
            lng,
            formatted_address,
            street: road || area || city,
            area: area || city,
            city,
            pincode,
            state
          });
        }
      }
    } catch {
      console.warn('[Reverse Geocode OSM Notice] Fallback invoked.');
    }

    // Final coordinate fallback if Nominatim is temporarily offline
    return res.json({
      success: true,
      source: 'coordinate_fallback',
      lat,
      lng,
      formatted_address: `${nearest.city} Area (${lat.toFixed(4)}, ${lng.toFixed(4)}), ${nearest.state}`,
      street: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      area: nearest.city,
      city: nearest.city,
      pincode: nearest.pincode,
      state: nearest.state
    });
  } catch (error: any) {
    console.error('[Reverse Geocode Error]', error?.code || 'geocode_error');
    res.status(500).json({ success: false, message: 'Geocoding service unavailable.' });
  }
});

// 2. Endpoint: Free Road Distance, ETA & GeoJSON Route Polyline via OSRM (with 1.3x Haversine fallback)
app.post('/api/maps/compute-route', async (req, res) => {
  try {
    const { origin, destination } = req.body || {};
    const origLat = Number(origin?.lat);
    const origLng = Number(origin?.lng);
    const destLat = Number(destination?.lat);
    const destLng = Number(destination?.lng);

    if (!isValidLatLng(origLat, origLng) || !isValidLatLng(destLat, destLng)) {
      return res.status(400).json({ success: false, message: 'Valid origin and destination coordinates required.' });
    }

    // Primary: Public OSRM driving route API with full GeoJSON road geometry
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ZuggiFreight/1.0 (https://zuggi.in)'
        },
        signal: AbortSignal.timeout(7000)
      });

      if (osrmRes.ok) {
        const data: any = await osrmRes.json();
        const route = data?.routes?.[0];
        if (route && Number.isFinite(route.distance)) {
          const distanceKm = Math.max(1, Math.round((Number(route.distance) / 1000) * 10) / 10);
          // Commercial freight vehicles travel slightly slower than passenger cars on NE highways;
          // use OSRM driving duration with a realistic minimum floor for heavy trucks
          const rawDurationMins = Math.round(Number(route.duration || 0) / 60);
          const durationMins = Math.max(5, rawDurationMins || Math.round((distanceKm / 45) * 60));

          const rawCoords: Array<[number, number]> = Array.isArray(route.geometry?.coordinates)
            ? route.geometry.coordinates
            : [];
          // Convert GeoJSON [lng, lat] -> Leaflet [lat, lng]
          const routeCoordinates: Array<[number, number]> = rawCoords
            .filter((pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
            .map((pt) => [pt[1], pt[0]]);

          const legSummary = route.legs?.[0]?.summary || 'National Highway Commercial Corridor';

          return res.json({
            success: true,
            source: 'osrm',
            distance_km: distanceKm,
            duration_mins: durationMins,
            route_coordinates: routeCoordinates,
            polyline: '',
            description: `OSRM Road Route via ${legSummary}`
          });
        }
      }
    } catch {
      console.warn('[OSRM Compute Route Notice] OSRM unreachable, using 1.3x Haversine fallback.');
    }

    // Graceful Haversine straight-line fallback multiplier (1.3x) ONLY if OSRM is unreachable
    const straightKm = haversineStraightKm(origLat, origLng, destLat, destLng);
    const highwayKm = Math.max(1, Math.round(straightKm * 1.3 * 10) / 10);
    const durationMins = Math.max(5, Math.round((highwayKm / 44) * 60));

    return res.json({
      success: true,
      source: 'haversine_fallback',
      distance_km: highwayKm,
      duration_mins: durationMins,
      route_coordinates: [
        [origLat, origLng],
        [destLat, destLng]
      ],
      polyline: '',
      description: 'Estimated Highway Corridor (1.3x Haversine fallback)'
    });
  } catch (error: any) {
    console.error('[Compute Route Error]', error?.code || 'route_error');
    res.status(500).json({ success: false, message: 'Routing computation failed.' });
  }
});

// 3. Endpoint: Free Live Route ETA & Remaining Road Distance via OSRM (with 1.3x Haversine fallback)
app.post('/api/maps/route-matrix', async (req, res) => {
  try {
    const { origin, destination } = req.body || {};
    const origLat = Number(origin?.lat);
    const origLng = Number(origin?.lng);
    const destLat = Number(destination?.lat);
    const destLng = Number(destination?.lng);

    if (!isValidLatLng(origLat, origLng) || !isValidLatLng(destLat, destLng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid origin and destination coordinates (lat/lng) are required.'
      });
    }

    // Primary: Public OSRM routing API for exact road distance & transit duration
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=false`;
      const osrmRes = await fetch(osrmUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ZuggiFreight/1.0 (https://zuggi.in)'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (osrmRes.ok) {
        const data: any = await osrmRes.json();
        const route = data?.routes?.[0];
        if (route && Number.isFinite(route.distance)) {
          const distanceMeters = Math.max(0, Math.round(Number(route.distance)));
          const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
          const durationSeconds = distanceMeters <= 250 ? 0 : Math.max(60, Math.round(Number(route.duration) || 0));
          const calculatedAt = new Date().toISOString();
          const etaIso = new Date(Date.now() + durationSeconds * 1000).toISOString();

          return res.json({
            success: true,
            source: 'osrm_route',
            distanceMeters,
            distanceKm,
            durationSeconds,
            staticDurationSeconds: durationSeconds,
            trafficDelayMinutes: 0,
            trafficCondition: 'clear',
            etaIso,
            calculatedAt
          });
        }
      }
    } catch {
      console.warn('[OSRM Route Matrix Notice] OSRM unreachable, using 1.3x Haversine fallback.');
    }

    // Graceful Haversine straight-line fallback multiplier (1.3x) ONLY if OSRM is unreachable
    const straightKm = haversineStraightKm(origLat, origLng, destLat, destLng);
    const distanceMeters = Math.max(0, Math.round(straightKm * 1000 * 1.3));
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationSeconds = distanceMeters <= 250 ? 0 : Math.max(60, Math.round((distanceKm / 44) * 3600));
    const calculatedAt = new Date().toISOString();
    const etaIso = new Date(Date.now() + durationSeconds * 1000).toISOString();

    return res.json({
      success: true,
      source: 'gps_estimate',
      distanceMeters,
      distanceKm,
      durationSeconds,
      staticDurationSeconds: durationSeconds,
      trafficDelayMinutes: 0,
      trafficCondition: 'clear',
      etaIso,
      calculatedAt
    });
  } catch (error: any) {
    console.error('[Route Matrix Error]', error?.code || 'route_matrix_error');
    res.status(500).json({ success: false, message: 'Route matrix computation failed.' });
  }
});

// --- PUBLIC FREIGHT CATALOG & SEO CRAWLER ENDPOINTS ---
// Canonical domain is strictly locked to https://zuggi.in (overridable only via PRIMARY_DOMAIN)
// so preview/staging hosts never leak non-canonical URLs into sitemaps or <link rel="canonical">.
const CANONICAL_BASE_URL = (
  process.env.PRIMARY_DOMAIN
    ? `https://${process.env.PRIMARY_DOMAIN.replace(/^https?:\/\//, '')}`
    : 'https://zuggi.in'
).replace(/\/$/, '');

async function fetchPublicFreightCatalog(): Promise<PublicFreightListing[]> {
  const dbRows = await listSupabaseLoads(300);
  return mergePublicFreightListings(dbRows);
}

app.get('/api/public/freight', async (_req, res) => {
  try {
    const listings = await fetchPublicFreightCatalog();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json({
      success: true,
      count: listings.length,
      listings,
      corridors: SEO_CORRIDORS,
      vehicles: SEO_VEHICLE_CATEGORIES
    });
  } catch (err: any) {
    console.error('[Public Freight Catalog Error]', err?.code || 'catalog_error');
    return res.status(500).json({ success: false, message: 'Failed to load public freight catalog.' });
  }
});

app.get('/api/public/freight/:loadId', async (req, res) => {
  try {
    const loadId = String(req.params.loadId || '').trim();
    const dbRow = await findSupabaseLoadById(loadId);
    const catalog = await fetchPublicFreightCatalog();
    const listing =
      (dbRow ? sanitizePublicFreightListing(dbRow.data, dbRow.updated_at) : null) ||
      catalog.find((l) => l.id === loadId) ||
      null;

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Freight listing not found' });
    }
    const related = catalog.filter((l) => l.id !== listing.id).slice(0, 6);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json({ success: true, listing, related });
  } catch (err: any) {
    console.error('[Public Freight Item Error]', err?.code || 'catalog_item_error');
    return res.status(500).json({ success: false, message: 'Failed to fetch freight listing.' });
  }
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      'Allow: /sitemap.xml',
      'Allow: /sitemap-freight.xml',
      'Allow: /truck-booking-guwahati',
      'Allow: /truck-transport-assam',
      'Allow: /truck-hire-guwahati-dibrugarh',
      'Allow: /northeast-india-transport',
      'Allow: /online-freight-booking',
      'Allow: /truck-loads',
      'Allow: /logistics-companies-assam',
      'Allow: /freight',
      'Allow: /freight/',
      'Allow: /corridors',
      'Allow: /corridors/',
      'Allow: /fleet',
      'Allow: /fleet/',
      'Allow: /about',
      'Allow: /contact',
      'Allow: /partner',
      'Disallow: /api/',
      'Disallow: /trips/',
      'Disallow: /track/',
      '',
      `Sitemap: ${CANONICAL_BASE_URL}/sitemap.xml`,
      `Sitemap: ${CANONICAL_BASE_URL}/sitemap-freight.xml`
    ].join('\n')
  );
});

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const listings = await fetchPublicFreightCatalog();
    const xml = generateSiteSitemapXml(CANONICAL_BASE_URL, listings);
    res.type('application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=1800');
    res.send(xml);
  } catch {
    console.error('[Sitemap Generator Error] Fallback sitemap served.');
    const fallbackXml = generateSiteSitemapXml(CANONICAL_BASE_URL, mergePublicFreightListings([]));
    res.type('application/xml; charset=utf-8');
    res.send(fallbackXml);
  }
});

app.get('/sitemap-freight.xml', async (_req, res) => {
  try {
    const listings = await fetchPublicFreightCatalog();
    const xml = generateFreightOnlySitemapXml(CANONICAL_BASE_URL, listings);
    res.type('application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200');
    res.send(xml);
  } catch {
    console.error('[Freight Sitemap Error] Fallback freight sitemap served.');
    const fallbackXml = generateFreightOnlySitemapXml(CANONICAL_BASE_URL, mergePublicFreightListings([]));
    res.type('application/xml; charset=utf-8');
    res.send(fallbackXml);
  }
});

function getRequestPathname(req: express.Request): string {
  return (req.originalUrl || req.url || req.path || '/').split('?')[0] || '/';
}

function isHtmlPageRequest(req: express.Request): boolean {
  if (req.method !== 'GET') return false;
  const pathname = getRequestPathname(req);
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/trips/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/@')
  ) {
    return false;
  }
  // Ignore static files with extensions (e.g., .js, .css, .png, .svg, .json, .xml, .txt, .ico)
  const lastSegment = pathname.split('/').pop() || '';
  if (lastSegment.includes('.')) return false;
  return true;
}

function applyPartnerManifestIfNeeded(req: express.Request, html: string): string {
  const pathname = getRequestPathname(req);
  const host = (req.headers.host || '').toLowerCase();
  const isPartnerRequest =
    pathname === '/partner' ||
    pathname.startsWith('/partner/') ||
    host.startsWith('partner.') ||
    host.startsWith('driver.');

  if (!isPartnerRequest) return html;

  return html
    .replace(
      /<link\s+rel=["']manifest["']\s+href=["']\/manifest\.json["']\s*\/?>/i,
      '<link rel="manifest" href="/manifest-partner.json" />'
    )
    .replace(
      /<meta\s+name=["']apple-mobile-web-app-title["']\s+content=["'][^"']*["']\s*\/?>/i,
      '<meta name="apple-mobile-web-app-title" content="Zuggi Partner" />'
    );
}

// Mount Vite or serve static files with dynamic server-side SEO & JSON-LD injection
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    if (!isHtmlPageRequest(req)) return next();
    try {
      const rawTemplate = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      const listings = await fetchPublicFreightCatalog();
      const seo = resolveRouteSeo(getRequestPathname(req), CANONICAL_BASE_URL, listings);
      const seoInjected = applyPartnerManifestIfNeeded(req, injectSeoIntoHtml(rawTemplate, seo));
      const html = await vite.transformIndexHtml(req.originalUrl, seoInjected);
      const status = seo.httpStatus || 200;
      if (status === 404) {
        res.setHeader('Cache-Control', 'no-store');
      }
      res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
} else {
  const distDir = path.resolve(__dirname, 'dist');
  const distIndexPath = path.join(distDir, 'index.html');
  const cachedDistHtml = fs.existsSync(distIndexPath) ? fs.readFileSync(distIndexPath, 'utf-8') : '';

  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      maxAge: '1y',
      immutable: true
    })
  );
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1h'
    })
  );
  app.get('*', async (req, res) => {
    try {
      const template = cachedDistHtml || fs.readFileSync(distIndexPath, 'utf-8');
      const listings = await fetchPublicFreightCatalog();
      const seo = resolveRouteSeo(getRequestPathname(req), CANONICAL_BASE_URL, listings);
      const html = applyPartnerManifestIfNeeded(req, injectSeoIntoHtml(template, seo));
      const status = seo.httpStatus || 200;
      res.status(status);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        status === 404 ? 'no-store' : 'public, max-age=300, stale-while-revalidate=600'
      );
      return res.send(html);
    } catch (err: any) {
      console.error(`[SSR SEO Render Fallback] correlationId=${req.correlationId} code=${err?.code || 'ssr_error'}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.sendFile(distIndexPath);
    }
  });
}

// Global error-handling middleware: returns generic message + correlationId (never stack traces or internals)
app.use(globalErrorHandler);

app.listen(port, '0.0.0.0', () => {
  startEscrowAutoReleaseWorker();
  console.info(`Zuggi Freight Server listening on port ${port} (${IS_PRODUCTION ? 'production' : 'development'})`);
});