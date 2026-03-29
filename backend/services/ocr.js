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
const EXPIRY_LABEL_RE = /(?:exp(?:iry|ires?|\.)?|best\s*(?:before|by)|use\s*(?:by|before)|bb\.?|sell\s*by|expiry\s*date|best\s*before\s*date)/i;

// Labels that indicate a MANUFACTURING / production date (to deprioritize)
const MFG_LABEL_RE = /(?:mfg|mfd|manufactured|manufacture|production|prod\.?|packed\s*on|packed\s*date|mfg\.?\s*date)/i;

/**
 * Build a validated ISO date string from components.
 *
 * @param {number|null} day      - exact day, or null if not specified
 * @param {number}      month    - 1–12
 * @param {number}      year     - 2-digit (→ 20xx) or 4-digit
 * @param {boolean}     firstDay - when day is null: true → 1st of month, false → last day
 */
function buildDate(day, month, year, firstDay = false) {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  let d;
  if (day != null) {
    if (day < 1 || day > lastDay) return null; // day out of range
    d = day;
  } else {
    d = firstDay ? 1 : lastDay;
  }
  const date = new Date(year, month - 1, d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Parse compact 6-digit (MMDDYY) or 8-digit (MMDDYYYY) numeric string.
 * Returns ISO date string or null.
 */
function parseCompactNumeric(digits) {
  if (digits.length === 8) {
    const mm   = parseInt(digits.slice(0, 2), 10);
    const dd   = parseInt(digits.slice(2, 4), 10);
    const yyyy = parseInt(digits.slice(4, 8), 10);
    return buildDate(dd, mm, yyyy);
  }
  if (digits.length === 6) {
    const mm = parseInt(digits.slice(0, 2), 10);
    const dd = parseInt(digits.slice(2, 4), 10);
    const yy = parseInt(digits.slice(4, 6), 10);
    return buildDate(dd, mm, 2000 + yy);
  }
  return null;
}

/**
 * Determine the expiry/mfg label for a given line, also checking the
 * previous line — handles cases where the label is on one line and the
 * date is on the next (e.g. "EXP\n04/14/2027").
 */
function resolveLabel(line, prevLine) {
  const combined = `${prevLine || ''} ${line}`.toLowerCase();
  if (EXPIRY_LABEL_RE.test(combined)) return 'expiry';
  if (MFG_LABEL_RE.test(combined))   return 'mfg';
  return 'unknown';
}

/**
 * Extract all candidate dates from raw OCR text.
 * Returns array of { isoDate, label: 'expiry'|'mfg'|'unknown', raw }
 */
function extractAllDates(text) {
  const results = [];
  const lines = text.split(/\n/);

  const push = (isoDate, label, raw) => {
    if (isoDate) results.push({ isoDate, label, raw });
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line    = lines[lineIdx];
    const prevLine = lineIdx > 0 ? lines[lineIdx - 1] : '';
    const label   = resolveLabel(line, prevLine);

    let m;

    // ── Pattern 1a: "04 Mar 2030" or "4 January 2026"  (DD MMM YYYY)
    const withDay = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`, 'gi');
    while ((m = withDay.exec(line)) !== null) {
      push(
        buildDate(parseInt(m[1], 10), MONTH_MAP[m[2].toLowerCase()], parseInt(m[3], 10)),
        label, m[0]
      );
    }

    // ── Pattern 1b: "Mar 2030" / "March 2026"  (MMM YYYY → 1st of month per spec)
    //    Skip when immediately preceded by a digit (already caught by 1a).
    const monthOnly = new RegExp(`(${MONTH_PATTERN})\\s+(\\d{4})\\b`, 'gi');
    while ((m = monthOnly.exec(line)) !== null) {
      const charBefore = line[m.index - 1];
      if (charBefore && /\d/.test(charBefore)) continue; // part of a DD MMM match
      push(
        buildDate(null, MONTH_MAP[m[1].toLowerCase()], parseInt(m[2], 10), true /* firstDay */),
        label, m[0]
      );
    }

    // ── Pattern 2: MM/DD/YYYY  (US format — month first)
    const mmddyyyy = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/g;
    while ((m = mmddyyyy.exec(line)) !== null) {
      push(buildDate(parseInt(m[2], 10), parseInt(m[1], 10), parseInt(m[3], 10)), label, m[0]);
    }

    // ── Pattern 3: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY  (European / international)
    const ddmmyyyy = /\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2})\b/g;
    while ((m = ddmmyyyy.exec(line)) !== null) {
      push(buildDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)), label, m[0]);
    }

    // ── Pattern 4: YYYY-MM-DD  (ISO 8601)
    const yyyymmdd = /\b(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b/g;
    while ((m = yyyymmdd.exec(line)) !== null) {
      push(buildDate(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10)), label, m[0]);
    }

    // ── Pattern 5: MM/YYYY standalone → last day of month
    const mmyyyy = /\b(0?[1-9]|1[0-2])[\/\-](20\d{2})\b/g;
    while ((m = mmyyyy.exec(line)) !== null) {
      push(buildDate(null, parseInt(m[1], 10), parseInt(m[2], 10), false), label, m[0]);
    }

    // ── Pattern 6: Compact MMDDYYYY (8 digits) or MMDDYY (6 digits)
    //    Only when NOT surrounded by other digits.
    const compact = /(?<!\d)(\d{8}|\d{6})(?!\d)/g;
    while ((m = compact.exec(line)) !== null) {
      push(parseCompactNumeric(m[1]), label, m[1]);
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
 * Priority: expiry-labeled > unknown-labeled  (mfg never used).
 * Within same priority, choose the latest valid future date.
 */
function pickBestExpiryDate(candidates) {
  const today = new Date().toISOString().split('T')[0];

  const future = candidates.filter(c => c.isoDate >= today && c.label !== 'mfg');
  if (future.length === 0) return null;

  const expiryLabeled = future.filter(c => c.label === 'expiry');
  const pool = expiryLabeled.length > 0 ? expiryLabeled : future;

  pool.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  return pool[0].isoDate;
}

async function extractExpiryFromImage(imageBuffer) {
  try {
    const worker = await createWorker('eng', 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();

    const rawText  = text || '';
    const candidates = extractAllDates(rawText);
    const expiryDate = pickBestExpiryDate(candidates);

    return { text: rawText, expiryDate };
  } catch (err) {
    console.error('Tesseract OCR error:', err.message);
    return { text: '', expiryDate: null };
  }
}

module.exports = { extractExpiryFromImage, extractAllDates, pickBestExpiryDate };
