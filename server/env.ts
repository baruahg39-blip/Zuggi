import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function stripSurroundingQuotes(raw: string): string {
  return raw.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function isUsableEnvValue(key: string, raw: string | undefined): boolean {
  const cleaned = stripSurroundingQuotes(raw || '');
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  if (
    lower.includes('your-project-id') ||
    lower.includes('your_supabase') ||
    lower.includes('your_') ||
    lower.includes('changeme') ||
    lower === 'todo' ||
    lower === 'placeholder' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === 'undefined'
  ) {
    return false;
  }
  if (key === 'SUPABASE_URL') {
    try {
      const parsed = new URL(cleaned);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return true;
}

// Sanitize literal surrounding quotes from injected runtime env vars
for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'HTTPSMS_API_KEY',
  'MY_JIO_PHONE_NUMBER',
  'GOOGLE_MAPS_API_KEY',
  'CASHFREE_APP_ID',
  'CASHFREE_SECRET_KEY'
]) {
  if (typeof process.env[key] === 'string') {
    process.env[key] = stripSurroundingQuotes(process.env[key]!);
  }
}

function loadEnvFileIntoEmptyVars(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      const cleanedFileVal = stripSurroundingQuotes(value || '');
      if (!cleanedFileVal) continue;
      if (!isUsableEnvValue(key, process.env[key]) && isUsableEnvValue(key, cleanedFileVal)) {
        process.env[key] = cleanedFileVal;
      }
    }
  } catch {
    dotenv.config({ path: filePath });
  }
}

// Load .env.local first, then .env (imported at the very top of server.ts before other modules)
loadEnvFileIntoEmptyVars(path.join(projectRoot, '.env.local'));
loadEnvFileIntoEmptyVars(path.join(projectRoot, '.env'));
