const { createWorker } = require('tesseract.js');

// Date patterns commonly found on food labels
const DATE_PATTERNS = [
  // Keywords + date: "Best by 03/2026", "Use by 15/03/26", "Exp: 2026-03-15"
  /(?:best\s*(?:before|by)|use\s*by|exp(?:iry|ires)?\.?|bb\.?|sell\s*by)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{2,4}(?:[\/\-\.]\d{2,4})?)/gi,
  // YYYY-MM-DD
  /\b(20\d{2}[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01]))\b/g,
  // DD/MM/YYYY or DD.MM.YYYY
  /\b((0[1-9]|[12]\d|3[01])[\/\-\.](0[1-9]|1[0-2])[\/\-\.](20\d{2}))\b/g,
  // MM/YYYY standalone
  /\b((0[1-9]|1[0-2])[\/\-](20\d{2}))\b/g,
];

function parseRawDate(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/(?:best\s*(?:before|by)|use\s*by|exp(?:iry|ires)?\.?|bb\.?|sell\s*by)\s*[:\-]?\s*/gi, '')
    .trim();
  const parts = cleaned.split(/[\/\-\.\s]+/).map(p => parseInt(p, 10)).filter(n => !isNaN(n) && n > 0);
  const currentYear = new Date().getFullYear();

  if (parts.length === 2) {
    let [a, b] = parts;
    let month, year;
    if (b > 31) { month = a; year = b; }
    else if (a > 12) { month = b; year = a; }
    else { month = a; year = b; }
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && year >= currentYear) {
      const d = new Date(year, month, 0); // last day of month
      return d.toISOString().split('T')[0];
    }
  } else if (parts.length === 3) {
    let [a, b, c] = parts;
    if (c < 100) c += 2000;
    if (a > 1000) {
      // YYYY-MM-DD
      const d = new Date(a, b - 1, c);
      if (!isNaN(d.getTime()) && a >= currentYear) return d.toISOString().split('T')[0];
    } else {
      // DD/MM/YYYY
      const d = new Date(c, b - 1, a);
      if (!isNaN(d.getTime()) && c >= currentYear) return d.toISOString().split('T')[0];
    }
  }
  return null;
}

function extractExpiryFromText(text) {
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const raw = m[1] || m[0];
      const parsed = parseRawDate(raw);
      if (parsed) return parsed;
    }
  }
  return null;
}

async function extractExpiryFromImage(imageBuffer) {
  try {
    const worker = await createWorker('eng', 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();
    const expiryDate = extractExpiryFromText(text || '');
    return { text: text || '', expiryDate };
  } catch (err) {
    console.error('Tesseract OCR error:', err.message);
    return { text: '', expiryDate: null };
  }
}

module.exports = { extractExpiryFromImage, extractExpiryFromText };
