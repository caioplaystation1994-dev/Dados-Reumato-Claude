// Uso interno (Claude Code): ingere um PDF diretamente no banco, sem passar pelo servidor HTTP.
// Extrai o texto e cria o registro com status 'pendente', aguardando classificacao manual.
//
// Uso: node server/scripts/add-article.js <caminho-do-pdf> [nome-original]

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');

const db = require('../db');
const { UPLOAD_DIR } = require('../paths');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function main() {
  const [srcPath, originalNameArg] = process.argv.slice(2);
  if (!srcPath) {
    console.error('Uso: node server/scripts/add-article.js <caminho-do-pdf> [nome-original]');
    process.exit(1);
  }

  const absSrc = path.resolve(srcPath);
  if (!fs.existsSync(absSrc)) {
    console.error(`Arquivo nao encontrado: ${absSrc}`);
    process.exit(1);
  }

  const originalName = originalNameArg || path.basename(absSrc);
  const destFilename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`;
  const destPath = path.join(UPLOAD_DIR, destFilename);
  fs.copyFileSync(absSrc, destPath);

  let fullText = '';
  let status = 'pendente';
  let error = null;

  try {
    const buffer = fs.readFileSync(destPath);
    const parsed = await pdfParse(buffer);
    fullText = parsed.text || '';
    if (!fullText.trim()) {
      throw new Error('Nao foi possivel extrair texto do PDF (pode ser uma imagem digitalizada sem OCR).');
    }
  } catch (err) {
    status = 'erro';
    error = String(err.message || err);
  }

  const info = db
    .prepare(`INSERT INTO articles (filename, original_name, full_text, status, error) VALUES (?, ?, ?, ?, ?)`)
    .run(destFilename, originalName, fullText, status, error);

  console.log(JSON.stringify({ id: info.lastInsertRowid, status, originalName }, null, 2));
}

main();
