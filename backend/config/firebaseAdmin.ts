const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let envJsonRaw =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  '';

console.log('Firebase ENV Loaded:', !!envJsonRaw);

let serviceAccount = null;

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function stripWrappingQuotes(str) {
  const s = String(str).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('`') && s.endsWith('`'))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// Clean env var for safer parsing
envJsonRaw = stripWrappingQuotes(envJsonRaw);

function base64ToJson(str) {
  try {
    let s = String(str).replace(/\s+/g, '');
    // Support URL-safe base64 and missing padding
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    const decoded = Buffer.from(s, 'base64').toString('utf8');
    return tryParseJson(decoded);
  } catch {
    return null;
  }
}

// 1) Try raw JSON from env
if (!serviceAccount && envJsonRaw) {
  serviceAccount = tryParseJson(envJsonRaw);
}

// 2) Try base64-decoded JSON if raw parse failed
if (!serviceAccount && envJsonRaw) {
  serviceAccount = base64ToJson(envJsonRaw);
  if (!serviceAccount) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON (base64 decode unsuccessful)');
  }
}

// 3) Fallback: read local ./serviceAccountKey.json
if (!serviceAccount) {
  const candidates = [
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const fileRaw = fs.readFileSync(p, 'utf8');
        serviceAccount = JSON.parse(fileRaw);
        break;
      } catch (e) {
        // continue
      }
    }
  }
}

// Normalize private_key newlines if present
if (serviceAccount && serviceAccount.private_key) {
  serviceAccount.private_key = String(serviceAccount.private_key)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
}

const hasRequiredFields =
  serviceAccount &&
  serviceAccount.type &&
  serviceAccount.project_id &&
  serviceAccount.private_key &&
  serviceAccount.client_email;

if (hasRequiredFields) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('🔥 Firebase Admin Initialized');
  } catch (e) {
    console.error('Firebase Admin initialization error:', e.message || e);
  }
} else {
  console.log('⚠️ Firebase Service Account missing or incomplete; notifications disabled');
}

module.exports = admin;

export {};
