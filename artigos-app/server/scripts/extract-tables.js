// Wrapper Node para extract_tables.py (usa pdfplumber para detectar tabelas
// estruturadas dentro do PDF, algo que o pdftotext/pdf-parse nao fazem —
// eles so devolvem texto corrido). Usado tanto na ingestao de novos artigos
// (add-article.js) quanto no backfill retroativo dos ja existentes.

const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, 'extract_tables.py');

function extractTables(pdfPath) {
  try {
    const out = execFileSync('python3', [SCRIPT_PATH, pdfPath], {
      maxBuffer: 1024 * 1024 * 50,
      timeout: 60000,
    }).toString('utf-8');
    const parsed = JSON.parse(out);
    if (parsed && parsed.error) return [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

module.exports = { extractTables };
