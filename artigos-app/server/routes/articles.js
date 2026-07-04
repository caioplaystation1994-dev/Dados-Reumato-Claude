const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const db = require('../db');
const { UPLOAD_DIR } = require('../paths');

const router = express.Router();

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase() === '.pdf' ? '.pdf' : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Apenas arquivos PDF sao aceitos.'));
    }
    cb(null, true);
  },
});

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, filename, original_name, title, authors, year, disease, topics, summary, status, error, created_at
       FROM articles ORDER BY created_at DESC`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Artigo nao encontrado.' });
  res.json(row);
});

router.get('/:id/file', (req, res) => {
  const row = db.prepare('SELECT filename, original_name FROM articles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Artigo nao encontrado.' });
  const filePath = path.join(UPLOAD_DIR, row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo nao encontrado no servidor.' });
  res.download(filePath, row.original_name);
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

  let fullText = '';
  let status = 'pendente';
  let error = null;

  try {
    const buffer = fs.readFileSync(path.join(UPLOAD_DIR, req.file.filename));
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
    .run(req.file.filename, req.file.originalname, fullText, status, error);

  res.status(201).json({ id: info.lastInsertRowid, status });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT filename FROM articles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Artigo nao encontrado.' });

  const filePath = path.join(UPLOAD_DIR, row.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
