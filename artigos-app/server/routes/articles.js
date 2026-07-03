const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const db = require('../db');
const { classifyArticle } = require('../claude');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
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

  const insert = db.prepare(
    `INSERT INTO articles (filename, original_name, status) VALUES (?, ?, 'processando')`
  );
  const info = insert.run(req.file.filename, req.file.originalname);
  const articleId = info.lastInsertRowid;

  res.status(202).json({ id: articleId, status: 'processando' });

  try {
    const buffer = fs.readFileSync(path.join(UPLOAD_DIR, req.file.filename));
    const parsed = await pdfParse(buffer);
    const fullText = parsed.text || '';

    if (!fullText.trim()) {
      throw new Error('Nao foi possivel extrair texto do PDF (pode ser uma imagem digitalizada sem OCR).');
    }

    const classification = await classifyArticle(fullText, req.file.originalname);

    db.prepare(
      `UPDATE articles SET title = ?, authors = ?, year = ?, disease = ?, topics = ?, summary = ?, full_text = ?, status = 'concluido', error = NULL WHERE id = ?`
    ).run(
      classification.title,
      classification.authors,
      classification.year,
      classification.disease,
      classification.topics,
      classification.summary,
      fullText,
      articleId
    );
  } catch (err) {
    db.prepare(`UPDATE articles SET status = 'erro', error = ? WHERE id = ?`).run(String(err.message || err), articleId);
  }
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
