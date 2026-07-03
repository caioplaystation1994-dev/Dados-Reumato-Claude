const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY nao configurada. Defina essa variavel de ambiente para habilitar as perguntas.');
  }
  return new Anthropic({ apiKey });
}

async function answerQuestion(question, articles) {
  const client = getClient();

  const context = articles
    .map((a, i) => {
      const excerpt = (a.full_text || '').slice(0, 6000);
      return `[Artigo ${i + 1}] (id=${a.id})
Titulo: ${a.title}
Doenca/Tema: ${a.disease || 'ainda nao classificado'}
Topicos: ${a.topics || 'ainda nao classificado'}
Resumo: ${a.summary || 'ainda nao classificado'}
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

module.exports = { answerQuestion };
