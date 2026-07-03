const express = require('express');
const db = require('../db');
const { answerQuestion } = require('../claude');

const router = express.Router();

const STOPWORDS = new Set([
  'que', 'qual', 'quais', 'como', 'para', 'com', 'uma', 'um', 'dos', 'das',
  'the', 'and', 'sobre', 'existe', 'existem', 'tem', 'tem', 'foi', 'sao',
  'sao', 'ele', 'ela', 'isso', 'esse', 'essa', 'este', 'esta', 'nos', 'mais',
]);

function buildFtsQuery(question) {
  const words = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]{3,}/g) || [];

  const terms = [...new Set(words.filter((w) => !STOPWORDS.has(w)))];
  if (terms.length === 0) return null;

  return terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
}

router.post('/', async (req, res) => {
  const question = (req.body && req.body.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Envie uma pergunta no campo "question".' });

  const total = db
    .prepare(`SELECT COUNT(*) as c FROM articles WHERE full_text IS NOT NULL AND full_text != ''`)
    .get().c;
  if (total === 0) {
    return res.json({
      answer: 'Ainda nao ha artigos com texto extraido na biblioteca. Faca upload de artigos antes de perguntar.',
      sources: [],
    });
  }

  let candidates;
  const ftsQuery = buildFtsQuery(question);

  if (ftsQuery) {
    try {
      candidates = db
        .prepare(
          `SELECT a.id, COALESCE(a.title, a.original_name) as title, a.disease, a.topics, a.summary, a.full_text
           FROM articles_fts f
           JOIN articles a ON a.id = f.rowid
           WHERE articles_fts MATCH ? AND a.full_text IS NOT NULL AND a.full_text != ''
           ORDER BY rank
           LIMIT 6`
        )
        .all(ftsQuery);
    } catch (e) {
      candidates = [];
    }
  } else {
    candidates = [];
  }

  if (candidates.length === 0) {
    candidates = db
      .prepare(
        `SELECT id, COALESCE(title, original_name) as title, disease, topics, summary, full_text FROM articles
         WHERE full_text IS NOT NULL AND full_text != '' ORDER BY created_at DESC LIMIT 6`
      )
      .all();
  }

  try {
    const answer = await answerQuestion(question, candidates);
    res.json({
      answer,
      sources: candidates.map((c) => ({ id: c.id, title: c.title, disease: c.disease })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

module.exports = router;
