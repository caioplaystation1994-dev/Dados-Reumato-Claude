// Uso interno (Claude Code): ingere um PDF diretamente no banco, sem passar pelo servidor HTTP.
// Extrai o texto e cria o registro com status 'pendente', aguardando classificacao manual.
//
// Uso: node server/scripts/add-article.js <caminho-do-pdf> [nome-original]

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const pdfParse = require('pdf-parse');

const db = require('../db');
const { UPLOAD_DIR } = require('../paths');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// pdftotext (sem -layout) segue a ordem de leitura do fluxo de texto do PDF,
// o que funciona bem tanto para paginas de coluna unica quanto para artigos
// de duas colunas (o modo -layout tenta preservar a posicao 2D exata e acaba
// entrelacando as duas colunas na mesma linha). Tabelas ficam com uma
// celula por linha (sem alinhamento), mas isso ainda e mais legivel que a
// extracao do pdf-parse, que colava os valores das celulas sem espaco.
// pdf-parse fica como fallback caso o binario pdftotext nao esteja
// disponivel ou falhe em algum PDF especifico.
function extractWithPdftotext(pdfPath) {
  return execFileSync('pdftotext', [pdfPath, '-'], { maxBuffer: 1024 * 1024 * 100 }).toString('utf-8');
}

async function extractWithPdfParse(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
}

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
    fullText = extractWithPdftotext(destPath);
  } catch (err) {
    try {
      fullText = await extractWithPdfParse(destPath);
    } catch (err2) {
      status = 'erro';
      error = String(err2.message || err2);
    }
  }

  if (status !== 'erro' && !fullText.trim()) {
    status = 'erro';
    error = 'Nao foi possivel extrair texto do PDF (pode ser uma imagem digitalizada sem OCR).';
  }

  const info = db
    .prepare(`INSERT INTO articles (filename, original_name, full_text, status, error) VALUES (?, ?, ?, ?, ?)`)
    .run(destFilename, originalName, fullText, status, error);

  console.log(JSON.stringify({ id: info.lastInsertRowid, status, originalName }, null, 2));
}

main();
