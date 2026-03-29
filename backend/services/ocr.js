const { createWorker } = require('tesseract.js');

const MONTH_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const MONTH_PATTERN = Object.keys(MONTH_MAP).join('|');

// Labels that indicate an EXPIRY date
const EXPIRY_LABEL_RE = /(?:exp(?:iry|ires?|\.)?|best\s*(?:before|by)|use\s*(?:by|before)|bb\.?|sell\s*by|use\s*before|expiry\s*date|best\s*before\s*date)/i;

// Labels that indicate a MANUFACTURING / production date (to deprioritize)
const MFG_LABEL_RE = /(?:mfg|mfd|manufactured|manufacture|production|prod\.?|packed\s*on|packed\s*date|mfg\.?\s*date)/i;

/**
 * Parse a date value from parts (day optional, month, year)
 * Returns ISO string "YYYY-MM-DD" or null
 */
function buildDate(day, month, year) {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  const maxDay = new Date(year, month, 0).getDate();
  const d = day && day >= 1 && day <= maxDay ? day : maxDay; // default to last day of month
  const date = new Date(year, month - 1, d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Extract all candidate dates from raw OCR text.
 * Returns array of { isoDate, label: 'expiry'|'mfg'|'unknown', raw }
 */
function extractAllDates(text) {
  const results = [];
  const lines = text.split(/\n/);

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const isExpiryLine = EXPIRY_LABEL_RE.test(lineLower);
    const isMfgLine = MFG_LABEL_RE.test(lineLower);
    const label = isExpiryLine ? 'expiry' : isMfgLine ? 'mfg' : 'unknown';

    // Pattern 1: "4 Mar 2030" or "14 January 2026" or "Mar 2030"
    const monthWordFull = new RegExp(
      `\\b(\\d{1,2})?\\s*(${MONTH_PATTERN})\\s+(\\d{4})\\b`,
      'gi'
    );
    let m;
    while ((m = monthWordFull.exec(line)) !== null) {
      const day = m[1] ? parseInt(m[1], 10) : null;
      const month = MONTH_MAP[m[2].toLowerCase()];
      const year = parseInt(m[3], 10);
      const isoDate = buildDate(day, month, year);
      if (isoDate) results.push({ isoDate, label, raw: m[0] });
    }

    // Pattern 2: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const ddmmyyyy = /\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2})\b/g;
    while ((m = ddmmyyyy.exec(line)) !== null) {
      const isoDate = buildDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      if (isoDate) results.push({ isoDate, label, raw: m[0] });
    }

    // Pattern 3: YYYY-MM-DD
    const yyyymmdd = /\b(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b/g;
    while ((m = yyyymmdd.exec(line)) !== null) {
      const isoDate = buildDate(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10));
      if (isoDate) results.push({ isoDate, label, raw: m[0] });
    }

    // Pattern 4: MM/YYYY standalone (no day component)
    const mmyyyy = /\b(0?[1-9]|1[0-2])[\/\-](20\d{2})\b/g;
    while ((m = mmyyyy.exec(line)) !== null) {
      const isoDate = buildDate(null, parseInt(m[1], 10), parseInt(m[2], 10));
      if (isoDate) results.push({ isoDate, label, raw: m[0] });
    }
  }

  // Deduplicate by isoDate+label
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.isoDate}|${r.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pick the best expiry date from candidate list.
 * Priority: expiry-labeled > unknown > (never mfg-only).
 * Among same priority, pick latest valid future date.
 */
function pickBestExpiryDate(candidates) {
  const today = new Date().toISOString().split('T')[0];

  // Only future or present dates
  const future = candidates.filter(c => c.isoDate >= today && c.label !== 'mfg');

  if (future.length === 0) return null;

  // Prefer expiry-labeled
  const expiryLabeled = future.filter(c => c.label === 'expiry');
  const pool = expiryLabeled.length > 0 ? expiryLabeled : future;

  // Pick the latest date
  pool.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  return pool[0].isoDate;
}

async function extractExpiryFromImage(imageBuffer) {
  try {
    const worker = await createWorker('eng', 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();

    const rawText = text || '';
    const candidates = extractAllDates(rawText);
    const expiryDate = pickBestExpiryDate(candidates);

    return { text: rawText, expiryDate };
  } catch (err) {
    console.error('Tesseract OCR error:', err.message);
    return { text: '', expiryDate: null };
  }
}

module.exports = { extractExpiryFromImage, extractAllDates, pickBestExpiryDate };
