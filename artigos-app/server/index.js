require('dotenv').config();
const path = require('path');
const express = require('express');

const articlesRouter = require('./routes/articles');
const askRouter = require('./routes/ask');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/articles', articlesRouter);
app.use('/api/ask', askRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Organizador de artigos rodando em http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('AVISO: ANTHROPIC_API_KEY nao esta definida. Classificacao e perguntas nao vao funcionar ate voce configurar essa variavel de ambiente.');
  }
});
