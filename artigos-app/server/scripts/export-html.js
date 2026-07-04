// Uso interno (Claude Code): gera um unico arquivo HTML autocontido a partir
// do banco de dados, para o usuario poder abrir localmente sem precisar de
// servidor. Rodar sempre que novos artigos forem classificados.
//
// Uso: node server/scripts/export-html.js [caminho-de-saida.html]

const fs = require('fs');
const path = require('path');
const db = require('../db');

const outPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'organizador_artigos.html'));

const articles = db
  .prepare(
    `SELECT id, title, authors, year, disease, topics, summary, detailed_summary, full_text, status, original_name
     FROM articles ORDER BY created_at DESC`
  )
  .all();

const dataJson = JSON.stringify(articles).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Organizador de Artigos Científicos</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;color:#1a202c;font-size:14px}
header{background:#1a56a0;color:#fff;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.25);flex-wrap:wrap;gap:10px}
header h1{font-size:17px;font-weight:600}
nav button{background:rgba(255,255,255,.15);border:none;color:#fff;padding:7px 16px;border-radius:6px;cursor:pointer;margin-left:6px;font-size:13px;transition:.2s}
nav button.active,nav button:hover{background:rgba(255,255,255,.3)}

main{padding:20px 24px;max-width:960px;margin:0 auto}
.tab{display:none}
.tab.active{display:block}

.card{background:#fff;border-radius:10px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.card h2{font-size:15px;color:#1a56a0;margin-bottom:12px}
.hint{font-size:12px;color:#718096;margin-bottom:14px}

.lib-controls{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.lib-controls input,.lib-controls select{flex:1;min-width:180px;border:1px solid #cbd5e0;border-radius:8px;padding:9px 14px;font-size:13px}

.library-list{display:flex;flex-direction:column;gap:10px}
.article-card{padding:14px 16px;border-radius:8px;background:#f7faff;border:1px solid #e2e8f0;cursor:pointer;transition:.15s}
.article-card:hover{border-color:#1a56a0;box-shadow:0 1px 6px rgba(0,0,0,.08)}
.article-card .title{font-weight:700;font-size:13.5px;color:#1a202c;margin-bottom:4px}
.article-card .meta{font-size:11.5px;color:#718096;margin-bottom:6px}
.article-card .tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{background:#1a56a0;color:#fff;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:20px}
.tag.topic{background:#e2e8f0;color:#2d3748}
.empty-state{color:#a0aec0;text-align:center;padding:30px 0;font-size:13px}

.btn-primary{background:#1a56a0;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
.btn-primary:hover{background:#154180}
.btn-primary:disabled{opacity:.6;cursor:not-allowed}
.btn-secondary{background:#fff;color:#1a56a0;border:2px solid #1a56a0;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600}
.btn-danger{background:#e53e3e;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px}

.apikey-box{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.apikey-box input{flex:1;min-width:220px;border:1px solid #cbd5e0;border-radius:8px;padding:9px 14px;font-size:13px}
.apikey-saved{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:12.5px;color:#4a5568}

.ask-box{display:flex;gap:10px}
.ask-box input{flex:1;border:1px solid #cbd5e0;border-radius:8px;padding:10px 14px;font-size:13px}

.ask-history{margin-top:20px;display:flex;flex-direction:column;gap:16px}
.qa-item{border-radius:8px;overflow:hidden}
.qa-question{background:#1a56a0;color:#fff;padding:10px 14px;font-weight:600;font-size:13px;border-radius:8px 8px 0 0}
.qa-answer{background:#f7faff;padding:14px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;white-space:pre-wrap;line-height:1.5;font-size:13px}
.qa-sources{margin-top:10px;font-size:11.5px;color:#718096}
.qa-sources b{color:#4a5568}
.qa-loading{color:#a0aec0;font-style:italic}
.qa-error{color:#c53030}

.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;align-items:center;justify-content:center;padding:20px}
.modal-overlay.active{display:flex}
.modal{background:#fff;border-radius:10px;max-width:780px;width:100%;max-height:88vh;overflow-y:auto;padding:28px 32px;position:relative}
.modal-close{position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#718096}
.modal h3{color:#1a56a0;margin-bottom:8px;font-size:17px;line-height:1.35;padding-right:24px}
.modal .meta{font-size:12px;color:#718096;margin-bottom:12px}
.modal .tags{margin-bottom:6px}
.modal .section-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#4a5568;margin:14px 0 4px;letter-spacing:.4px}
.modal > p{font-size:13px;line-height:1.6;color:#2d3748}

.summary-sections{display:flex;flex-direction:column;gap:16px;margin-top:18px}
.summary-section{padding-bottom:2px}
.summary-section h4{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#1a56a0;margin-bottom:7px;padding-bottom:6px;border-bottom:2px solid #e8f0fc}
.summary-section p{font-size:13.5px;line-height:1.65;color:#2d3748;white-space:pre-wrap}
.summary-section.critical{background:#fffaf0;border:1px solid #f6ad55;border-radius:8px;padding:14px 16px}
.summary-section.critical h4{color:#c05621;border-bottom-color:#feebc8}

@media (max-width:600px){
  main{padding:14px}
  header{padding:12px 16px}
}
</style>
</head>
<body>
<header>
  <h1>📚 Organizador de Artigos Científicos</h1>
  <nav>
    <button class="tab-btn active" data-tab="library">Biblioteca</button>
    <button class="tab-btn" data-tab="ask">Perguntas</button>
  </nav>
</header>

<main>
  <section id="tab-library" class="tab active">
    <div class="card">
      <div class="lib-controls">
        <input type="text" id="searchBox" placeholder="Buscar por título, doença, tema...">
        <select id="diseaseFilter">
          <option value="">Todas as doenças/temas</option>
        </select>
      </div>
      <div id="libraryList" class="library-list"></div>
    </div>
  </section>

  <section id="tab-ask" class="tab">
    <div class="card">
      <h2>Pergunte sobre os artigos</h2>
      <p class="hint">A resposta é gerada com IA (Claude, Anthropic) com base apenas nos artigos desta biblioteca. Sua chave de API fica salva só no seu navegador (localStorage) e é usada apenas para chamar a API da Anthropic diretamente do seu computador.</p>

      <div id="apiKeyEntry" class="apikey-box">
        <input type="password" id="apiKeyInput" placeholder="Cole sua chave de API da Anthropic (sk-ant-...)">
        <button id="saveKeyBtn" class="btn-primary">Salvar chave</button>
      </div>
      <div id="apiKeySaved" class="apikey-saved" style="display:none">
        <span>✓ Chave de API salva neste navegador.</span>
        <button id="changeKeyBtn" class="btn-secondary">Trocar chave</button>
      </div>

      <div class="ask-box">
        <input type="text" id="questionInput" placeholder="Ex: Quais artigos falam sobre adesão ao tratamento na artrite reumatoide?">
        <button id="askBtn" class="btn-primary">Perguntar</button>
      </div>
      <div id="askHistory" class="ask-history"></div>
    </div>
  </section>
</main>

<div id="modalOverlay" class="modal-overlay">
  <div class="modal">
    <button id="modalClose" class="modal-close">&times;</button>
    <div id="modalBody"></div>
  </div>
</div>

<script>
const ARTICLES = ${dataJson};
const CLAUDE_MODEL = 'claude-sonnet-5';

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------- Library ----------
const searchBox = document.getElementById('searchBox');
const diseaseFilter = document.getElementById('diseaseFilter');
const libraryList = document.getElementById('libraryList');

function populateDiseaseFilter() {
  const diseases = [...new Set(ARTICLES.map((a) => a.disease).filter(Boolean))].sort();
  diseases.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    diseaseFilter.appendChild(opt);
  });
}

function normalizeText(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
}

function renderLibrary() {
  const term = normalizeText(searchBox.value.trim());
  const diseaseVal = diseaseFilter.value;

  const filtered = ARTICLES.filter((a) => {
    if (diseaseVal && a.disease !== diseaseVal) return false;
    if (!term) return true;
    const haystack = normalizeText([a.title, a.disease, a.topics, a.summary, a.full_text].join(' '));
    return haystack.includes(term);
  });

  libraryList.innerHTML = '';
  if (filtered.length === 0) {
    libraryList.innerHTML = '<div class="empty-state">Nenhum artigo encontrado.</div>';
    return;
  }

  filtered.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'article-card';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = a.title || a.original_name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const metaParts = [];
    if (a.authors) metaParts.push(a.authors);
    if (a.year) metaParts.push(a.year);
    metaParts.push(a.status === 'concluido' ? 'Classificado' : a.status === 'erro' ? 'Erro no processamento' : 'Aguardando classificação');
    meta.textContent = metaParts.join(' · ');

    const tags = document.createElement('div');
    tags.className = 'tags';
    if (a.disease) {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = a.disease;
      tags.appendChild(t);
    }
    (a.topics || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4).forEach((topic) => {
      const t = document.createElement('span');
      t.className = 'tag topic';
      t.textContent = topic;
      tags.appendChild(t);
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(tags);
    card.addEventListener('click', () => openModal(a.id));
    libraryList.appendChild(card);
  });
}

searchBox.addEventListener('input', renderLibrary);
diseaseFilter.addEventListener('change', renderLibrary);

// ---------- Modal ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

function closeModal() {
  modalOverlay.classList.remove('active');
  modalBody.innerHTML = '';
}

function renderSummaryBody(a) {
  let sections = null;
  if (a.detailed_summary) {
    try {
      const parsed = JSON.parse(a.detailed_summary);
      if (Array.isArray(parsed) && parsed.length > 0) sections = parsed;
    } catch (e) {
      sections = null;
    }
  }

  if (!sections) {
    return '<div class="section-label">Resumo</div><p>' + escapeHtml(a.summary || 'Sem resumo disponível.') + '</p>';
  }

  const isCritical = (heading) => /cr[ií]tic|limita[cç][aã]o|vi[eé]s|qualidade da evid[eê]ncia/i.test(heading || '');

  return '<div class="summary-sections">' + sections.map((s) =>
    '<div class="summary-section' + (isCritical(s.heading) ? ' critical' : '') + '">' +
      '<h4>' + escapeHtml(s.heading || '') + '</h4>' +
      '<p>' + escapeHtml(s.text || '') + '</p>' +
    '</div>'
  ).join('') + '</div>';
}

function openModal(id) {
  const a = ARTICLES.find((x) => x.id === id);
  if (!a) return;

  modalBody.innerHTML =
    '<h3>' + escapeHtml(a.title || a.original_name) + '</h3>' +
    '<div class="meta">' + escapeHtml([a.authors, a.year].filter(Boolean).join(' · ')) + '</div>' +
    '<div class="tags">' +
      (a.disease ? '<span class="tag">' + escapeHtml(a.disease) + '</span>' : '') +
      (a.topics || '').split(',').map((s) => s.trim()).filter(Boolean).map((t) => '<span class="tag topic">' + escapeHtml(t) + '</span>').join('') +
    '</div>' +
    renderSummaryBody(a);

  modalOverlay.classList.add('active');
}

// ---------- API key ----------
const apiKeyEntry = document.getElementById('apiKeyEntry');
const apiKeySaved = document.getElementById('apiKeySaved');
const apiKeyInput = document.getElementById('apiKeyInput');

function getApiKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

function refreshApiKeyUi() {
  if (getApiKey()) {
    apiKeyEntry.style.display = 'none';
    apiKeySaved.style.display = 'flex';
  } else {
    apiKeyEntry.style.display = 'flex';
    apiKeySaved.style.display = 'none';
  }
}

document.getElementById('saveKeyBtn').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem('anthropic_api_key', key);
  apiKeyInput.value = '';
  refreshApiKeyUi();
});

document.getElementById('changeKeyBtn').addEventListener('click', () => {
  localStorage.removeItem('anthropic_api_key');
  refreshApiKeyUi();
});

refreshApiKeyUi();

// ---------- Ask ----------
const STOPWORDS = new Set(['que','qual','quais','como','para','com','uma','um','dos','das','the','and','sobre','existe','existem','tem','foi','sao','ele','ela','isso','esse','essa','este','esta','nos','mais']);

function pickRelevantArticles(question) {
  const words = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .match(/[a-z0-9]{3,}/g) || [];
  const terms = [...new Set(words.filter((w) => !STOPWORDS.has(w)))];

  const usable = ARTICLES.filter((a) => a.full_text && a.full_text.trim());
  if (usable.length === 0) return [];
  if (terms.length === 0) return usable.slice(0, 6);

  const scored = usable.map((a) => {
    const haystack = [a.title, a.disease, a.topics, a.summary, a.full_text].join(' ').toLowerCase();
    let score = 0;
    terms.forEach((t) => { if (haystack.includes(t)) score++; });
    return { a, score };
  }).filter((x) => x.score > 0);

  scored.sort((x, y) => y.score - x.score);
  const top = scored.slice(0, 6).map((x) => x.a);
  return top.length > 0 ? top : usable.slice(0, 6);
}

function buildPrompt(question, articles) {
  const context = articles.map((a, i) => {
    const excerpt = (a.full_text || '').slice(0, 6000);
    return '[Artigo ' + (i + 1) + ']\\nTitulo: ' + (a.title || a.original_name) +
      '\\nDoenca/Tema: ' + (a.disease || 'ainda nao classificado') +
      '\\nTopicos: ' + (a.topics || 'ainda nao classificado') +
      '\\nResumo: ' + (a.summary || 'ainda nao classificado') +
      '\\nTrecho do texto:\\n"""\\n' + excerpt + '\\n"""';
  }).join('\\n\\n');

  return 'Voce e um assistente que responde perguntas com base APENAS nos artigos cientificos fornecidos abaixo. Nao use conhecimento externo alem do que estiver nos trechos. Se a informacao nao estiver nos artigos, diga claramente que nao encontrou a resposta nos artigos cadastrados.\\n\\n' +
    'Sempre que usar informacao de um artigo, cite-o pelo titulo entre colchetes, ex: [Titulo do artigo].\\n\\n' +
    'Artigos disponiveis:\\n\\n' + context + '\\n\\nPergunta do usuario: ' + question + '\\n\\nResponda em portugues, de forma clara e objetiva.';
}

async function askClaude(prompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data && data.error && data.error.message) || ('Erro HTTP ' + res.status));
  }
  return (data.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('');
}

const questionInput = document.getElementById('questionInput');
const askBtn = document.getElementById('askBtn');
const askHistory = document.getElementById('askHistory');

askBtn.addEventListener('click', ask);
questionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

async function ask() {
  const question = questionInput.value.trim();
  if (!question) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    alert('Cole sua chave de API da Anthropic acima e clique em "Salvar chave" antes de perguntar.');
    return;
  }

  questionInput.value = '';
  askBtn.disabled = true;

  const item = document.createElement('div');
  item.className = 'qa-item';
  item.innerHTML = '<div class="qa-question">' + escapeHtml(question) + '</div><div class="qa-answer qa-loading">Pensando...</div>';
  askHistory.prepend(item);
  const answerDiv = item.querySelector('.qa-answer');

  try {
    const relevant = pickRelevantArticles(question);
    if (relevant.length === 0) {
      answerDiv.classList.remove('qa-loading');
      answerDiv.textContent = 'Ainda nao ha artigos com texto disponivel na biblioteca para responder perguntas.';
      return;
    }
    const prompt = buildPrompt(question, relevant);
    const answer = await askClaude(prompt, apiKey);

    answerDiv.classList.remove('qa-loading');
    answerDiv.textContent = answer;

    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'qa-sources';
    sourcesDiv.innerHTML = '<b>Artigos consultados:</b> ' + relevant.map((a) => escapeHtml(a.title || a.original_name)).join('; ');
    item.appendChild(sourcesDiv);
  } catch (err) {
    answerDiv.classList.remove('qa-loading');
    answerDiv.classList.add('qa-error');
    answerDiv.textContent = 'Erro: ' + err.message;
  } finally {
    askBtn.disabled = false;
  }
}

// ---------- Init ----------
populateDiseaseFilter();
renderLibrary();
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log(`Gerado: ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${articles.length} artigos)`);
