// The values below are the school edition's. Another edition replaces them in edition.json
// (googleClientId, scriptUrl, firebase) — edit edition.json there, not this file, so
// `git merge` from the school repo never conflicts here.
import overrides from '../edition.json';

// ═══════════════════════════════════════════════════════════════
// TEACHER SETUP  ← Edit this one line before distributing.
// Paste your deployed Apps Script URL. Leave '' for offline mode.
// ═══════════════════════════════════════════════════════════════
export const GOOGLE_CLIENT_ID = overrides.googleClientId ?? '501163435800-agtmqo92jg3b61tj6dafk0u73qergc0h.apps.googleusercontent.com';

export const SCRIPT_URL = overrides.scriptUrl ?? 'https://script.google.com/macros/s/AKfycbwpp0IvmQjrv0O8MZ6XSX3SQDfJIIii4RsidX5IvaPDaKyJ5x0QLhbdKPle4TX4BKhsmQ/exec';

// e.g. 'https://script.google.com/macros/s/AKfy.../exec'

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — FIREBASE  (real-time 1v1 + Battle Royale)
// ═══════════════════════════════════════════════════════════════
export const FB_CFG = overrides.firebase ?? {
  apiKey:'AIzaSyCtCCkevo5cz0zFRLgfh1ixPZpUHf7mKz4',
  authDomain:'thai-typing.firebaseapp.com',
  databaseURL:'https://thai-typing-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:'thai-typing',
  storageBucket:'thai-typing.firebasestorage.app',
  messagingSenderId:'501163435800',
  appId:'1:501163435800:web:bfc8b7d56b7ce5bf51206d',
};
