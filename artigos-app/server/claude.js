const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY nao configurada. Defina essa variavel de ambiente para habilitar a classificacao e as perguntas.');
  }
  return new Anthropic({ apiKey });
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Resposta da IA nao continha JSON valido.');
  return JSON.parse(match[0]);
}

async function classifyArticle(fullText, originalName) {
  const client = getClient();
  const excerpt = fullText.slice(0, 15000);

  const prompt = `Voce e um assistente que organiza artigos cientificos de medicina (com foco em reumatologia, mas podem ser de outras areas).
Leia o trecho do artigo abaixo (extraido de um PDF chamado "${originalName}") e responda APENAS com um objeto JSON, sem nenhum texto antes ou depois, no formato:

{
  "title": "titulo do artigo (ou o melhor titulo que voce conseguir identificar)",
  "authors": "autores principais separados por virgula, ou string vazia se nao identificar",
  "year": "ano de publicacao, ou string vazia se nao identificar",
  "disease": "a doenca/condicao clinica principal do artigo (ex: Artrite Reumatoide, Lupus Eritematoso Sistemico, Espondilite Anquilosante, Osteoartrite, Fibromialgia, Sindrome de Sjogren, Vasculite, etc). Use 'Nao especificado' se nao for um artigo clinico sobre uma doenca especifica.",
  "topics": ["lista", "de", "3 a 6 temas/palavras-chave relevantes", "ex: adesao ao tratamento, biologicos, diagnostico, qualidade de vida, escores de atividade de doenca"],
  "summary": "um resumo objetivo do artigo em portugues, com 3 a 5 frases, cobrindo objetivo, metodo e principal conclusao"
}

Trecho do artigo:
"""
${excerpt}
"""`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const parsed = extractJson(text);

  return {
    title: parsed.title || originalName,
    authors: parsed.authors || '',
    year: parsed.year || '',
    disease: parsed.disease || 'Nao especificado',
    topics: Array.isArray(parsed.topics) ? parsed.topics.join(', ') : (parsed.topics || ''),
    summary: parsed.summary || '',
  };
}

async function answerQuestion(question, articles) {
  const client = getClient();

  const context = articles
    .map((a, i) => {
      const excerpt = (a.full_text || '').slice(0, 6000);
      return `[Artigo ${i + 1}] (id=${a.id})
Titulo: ${a.title}
Doenca/Tema: ${a.disease}
Topicos: ${a.topics}
Resumo: ${a.summary}
Trecho do texto:
"""
${excerpt}
"""`;
    })
    .join('\n\n');

  const prompt = `Voce e um assistente que responde perguntas com base APENAS nos artigos cientificos fornecidos abaixo. Nao use conhecimento externo alem do que estiver nos trechos. Se a informacao nao estiver nos artigos, diga claramente que nao encontrou a resposta nos artigos cadastrados.

Sempre que usar informacao de um artigo, cite-o pelo titulo entre colchetes, ex: [Titulo do artigo].

Artigos disponiveis:

${context}

Pergunta do usuario: ${question}

Responda em portugues, de forma clara e objetiva.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

module.exports = { classifyArticle, answerQuestion };
