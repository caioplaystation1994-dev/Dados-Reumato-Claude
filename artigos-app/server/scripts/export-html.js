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
    `SELECT id, title, authors, year, disease, topics, summary, detailed_summary, full_text, status, original_name,
     secondary_diseases, subtopic, evidence_level, clinical_applicability
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

.lib-controls{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.lib-controls input,.lib-controls select{flex:1;min-width:180px;border:1px solid #cbd5e0;border-radius:8px;padding:9px 14px;font-size:13px}
.result-count{font-size:12px;color:#718096;margin-bottom:10px}

.library-list{display:flex;flex-direction:column;gap:10px}
.article-card{position:relative;padding:14px 16px;border-radius:8px;background:#f7faff;border:1px solid #e2e8f0;cursor:pointer;transition:.15s}
.article-card:hover{border-color:#1a56a0;box-shadow:0 1px 6px rgba(0,0,0,.08)}
.article-card .title{font-weight:700;font-size:13.5px;color:#1a202c;margin-bottom:4px}
.article-card .tldr{font-size:12px;color:#4a5568;font-style:italic;margin-bottom:6px;line-height:1.4}
.article-card .meta{font-size:11.5px;color:#718096;margin-bottom:6px}
.article-card .tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{background:#1a56a0;color:#fff;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:20px}
.tag.topic{background:#e2e8f0;color:#2d3748}
.empty-state{color:#a0aec0;text-align:center;padding:30px 0;font-size:13px}
mark{background:#fef08a;color:inherit;padding:0 1px;border-radius:2px}

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

.section-nav{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px;position:sticky;top:0;background:#fff;padding:8px 0;z-index:5}
.section-nav-btn{background:#f0f4f8;border:1px solid #cbd5e0;color:#2d3748;font-size:11px;padding:4px 10px;border-radius:20px;cursor:pointer;white-space:nowrap;transition:.15s}
.section-nav-btn:hover{background:#e2e8f0;border-color:#1a56a0}

.summary-sections{display:flex;flex-direction:column;gap:16px;margin-top:8px}
.summary-section{padding-bottom:2px;scroll-margin-top:44px}
.summary-section h4{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#1a56a0;margin-bottom:7px;padding-bottom:6px;border-bottom:2px solid #e8f0fc}
.summary-section p{font-size:13.5px;line-height:1.65;color:#2d3748;white-space:pre-wrap}
.summary-section.critical{background:#fffaf0;border:1px solid #f6ad55;border-radius:8px;padding:14px 16px}
.summary-section.critical h4{color:#c05621;border-bottom-color:#feebc8}
.summary-section.relevance{background:#f0fff4;border:1px solid #68d391;border-radius:8px;padding:14px 16px}
.summary-section.relevance h4{color:#276749;border-bottom-color:#c6f6d5}

.tag.secondary{background:#dbeafe;color:#1e3a8a}
.tag.evidence{background:#5b21b6;color:#fff}
.tag.evidence.ev-strong{background:#2f855a}
.tag.evidence.ev-moderate{background:#2b6cb0}
.tag.evidence.ev-narrative{background:#805ad5}
.tag.applicability{background:#e6fffa;color:#065f46;border:1px solid #b2f5ea}
.tag.muted{background:#edf2f7;color:#718096;font-weight:600}
.subtopic-breadcrumb{font-size:11.5px;color:#4a5568;margin-bottom:6px}
.subtopic-breadcrumb b{color:#1a56a0}

.article-card .title{padding-right:54px}
.card-actions{position:absolute;top:12px;right:14px;display:flex;gap:2px}
.icon-btn{background:none;border:none;cursor:pointer;font-size:16px;line-height:1;padding:3px 5px;border-radius:4px;color:#a0aec0}
.icon-btn:hover{background:#e2e8f0}
.icon-btn.fav-active{color:#d69e2e}
.modal-actions{display:flex;gap:10px;margin:8px 0 14px}

.lib-controls select{min-width:150px}
.lib-toggle{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#4a5568;padding:9px 4px;white-space:nowrap}
.lib-toggle input{width:auto}

.collections-popover{display:none;position:absolute;background:#fff;border:1px solid #cbd5e0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:10px;z-index:300;min-width:200px}
.collections-popover.active{display:block}
.collections-popover .coll-item{display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:12.5px;cursor:pointer;border-radius:4px}
.collections-popover .coll-item:hover{background:#f7faff}
.collections-popover .coll-new{display:flex;gap:6px;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px}
.collections-popover .coll-new input{flex:1;border:1px solid #cbd5e0;border-radius:6px;padding:5px 8px;font-size:12px}
.collections-popover .coll-new button{border:none;background:#1a56a0;color:#fff;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}

.related-box{margin-top:22px;border-top:1px solid #e2e8f0;padding-top:14px}
.related-box .section-label{margin-bottom:8px}
.related-list{display:flex;flex-direction:column;gap:6px}
.related-item{cursor:pointer;padding:6px 10px;background:#f7faff;border-radius:6px;border:1px solid #e2e8f0}
.related-item:hover{border-color:#1a56a0}
.related-title{font-size:12.5px;color:#1a56a0;font-weight:600}
.related-reason{font-size:11px;color:#718096;margin-top:2px}

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
        <select id="evidenceFilter">
          <option value="">Todos os níveis de evidência</option>
        </select>
        <select id="applicabilityFilter">
          <option value="">Toda aplicabilidade clínica</option>
        </select>
        <select id="collectionFilter">
          <option value="">Todas as coleções</option>
        </select>
        <select id="sortSelect">
          <option value="recent">Mais recentes</option>
          <option value="title">Título (A-Z)</option>
          <option value="year_desc">Ano (mais recente)</option>
          <option value="year_asc">Ano (mais antigo)</option>
          <option value="evidence">Força da evidência</option>
        </select>
        <label class="lib-toggle"><input type="checkbox" id="favFilter"> ★ Só favoritos</label>
      </div>
      <div id="resultCount" class="result-count"></div>
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

<div id="collectionsPopover" class="collections-popover">
  <div id="collectionsList"></div>
  <div class="coll-new">
    <input type="text" id="newCollectionInput" placeholder="Nova coleção...">
    <button id="newCollectionBtn">Criar</button>
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

// ---------- Favoritos e Coleções (localStorage) ----------
function parseArr(str) {
  if (!str) return [];
  try {
    const p = JSON.parse(str);
    return Array.isArray(p) ? p : [];
  } catch (e) {
    return [];
  }
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('organizador_favorites') || '[]');
  } catch (e) {
    return [];
  }
}
function saveFavorites(list) { localStorage.setItem('organizador_favorites', JSON.stringify(list)); }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx === -1) favs.push(id); else favs.splice(idx, 1);
  saveFavorites(favs);
}

function getCollections() {
  try {
    return JSON.parse(localStorage.getItem('organizador_collections') || '{}');
  } catch (e) {
    return {};
  }
}
function saveCollections(obj) { localStorage.setItem('organizador_collections', JSON.stringify(obj)); }
function createCollection(name) {
  const coll = getCollections();
  if (!coll[name]) { coll[name] = []; saveCollections(coll); }
}
function toggleArticleInCollection(name, id) {
  const coll = getCollections();
  if (!coll[name]) coll[name] = [];
  const idx = coll[name].indexOf(id);
  if (idx === -1) coll[name].push(id); else coll[name].splice(idx, 1);
  saveCollections(coll);
}

// ---------- Library ----------
const searchBox = document.getElementById('searchBox');
const diseaseFilter = document.getElementById('diseaseFilter');
const evidenceFilter = document.getElementById('evidenceFilter');
const applicabilityFilter = document.getElementById('applicabilityFilter');
const collectionFilter = document.getElementById('collectionFilter');
const favFilter = document.getElementById('favFilter');
const sortSelect = document.getElementById('sortSelect');
const resultCount = document.getElementById('resultCount');
const libraryList = document.getElementById('libraryList');

function populateFilters() {
  const diseases = new Set();
  const evidences = new Set();
  const applicabilities = new Set();
  ARTICLES.forEach((a) => {
    if (a.disease) diseases.add(a.disease);
    parseArr(a.secondary_diseases).forEach((d) => diseases.add(d));
    if (a.evidence_level) evidences.add(a.evidence_level);
    parseArr(a.clinical_applicability).forEach((c) => applicabilities.add(c));
  });
  [...diseases].sort().forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    diseaseFilter.appendChild(opt);
  });
  [...evidences].sort().forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    evidenceFilter.appendChild(opt);
  });
  [...applicabilities].sort().forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    applicabilityFilter.appendChild(opt);
  });
  populateCollectionFilter();
}

function populateCollectionFilter() {
  const collections = getCollections();
  const current = collectionFilter.value;
  collectionFilter.innerHTML = '<option value="">Todas as coleções</option>';
  Object.keys(collections).sort().forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name + ' (' + collections[name].length + ')';
    collectionFilter.appendChild(opt);
  });
  if ([...collectionFilter.options].some((o) => o.value === current)) collectionFilter.value = current;
}

function normalizeText(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
}

function buildBreadcrumb(a) {
  if (!a.subtopic) return '';
  return '<div class="subtopic-breadcrumb"><b>' + escapeHtml(a.disease || '') + '</b> › ' + escapeHtml(a.subtopic) + '</div>';
}

const EVIDENCE_RANK = {
  'Ensaio Clínico Randomizado': 0,
  'Revisão Sistemática/Metanálise': 1,
  'Estudo de Coorte/Observacional': 2,
  'Revisão Narrativa': 3,
  'Protocolo de Estudo': 4,
  'Bula/Documento Regulatório': 5,
};

function evidenceClass(level) {
  if (!level) return '';
  if (/Ensaio Cl[ií]nico Randomizado|Revis[aã]o Sistem[aá]tica/i.test(level)) return 'ev-strong';
  if (/Coorte|Observacional/i.test(level)) return 'ev-moderate';
  return 'ev-narrative';
}

function tldr(str, maxLen) {
  if (!str) return '';
  maxLen = maxLen || 200;
  const match = str.match(/^[\\s\\S]*?[.!?](?=\\s|$)/);
  let s = (match ? match[0] : str).trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim() + '…';
  return s;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}

function highlightMatches(safeHtml, rawTerm) {
  if (!rawTerm) return safeHtml;
  try {
    const re = new RegExp('(' + escapeRegex(rawTerm) + ')', 'gi');
    return safeHtml.replace(re, '<mark>$1</mark>');
  } catch (e) {
    return safeHtml;
  }
}

function slugify(str, idx) {
  return 'sec-' + idx + '-' + (str || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildTagsHtml(a, opts) {
  opts = opts || {};
  let html = '';
  if (a.disease) html += '<span class="tag">' + escapeHtml(a.disease) + '</span>';
  if (a.evidence_level) html += '<span class="tag evidence ' + evidenceClass(a.evidence_level) + '">' + escapeHtml(a.evidence_level) + '</span>';
  if (opts.compact) {
    const secCount = parseArr(a.secondary_diseases).length;
    if (secCount > 0) html += '<span class="tag muted">+' + secCount + ' doença' + (secCount > 1 ? 's' : '') + '</span>';
    return html;
  }
  parseArr(a.secondary_diseases).forEach((d) => { html += '<span class="tag secondary">' + escapeHtml(d) + '</span>'; });
  parseArr(a.clinical_applicability).forEach((c) => { html += '<span class="tag applicability">' + escapeHtml(c) + '</span>'; });
  const topics = (a.topics || '').split(',').map((s) => s.trim()).filter(Boolean);
  topics.forEach((t) => { html += '<span class="tag topic">' + escapeHtml(t) + '</span>'; });
  return html;
}

function sortArticles(list, sortVal) {
  const sorted = list.slice();
  if (sortVal === 'title') {
    sorted.sort((x, y) => (x.title || x.original_name || '').localeCompare(y.title || y.original_name || '', 'pt'));
  } else if (sortVal === 'year_desc') {
    sorted.sort((x, y) => (parseInt(y.year, 10) || 0) - (parseInt(x.year, 10) || 0));
  } else if (sortVal === 'year_asc') {
    sorted.sort((x, y) => (parseInt(x.year, 10) || 0) - (parseInt(y.year, 10) || 0));
  } else if (sortVal === 'evidence') {
    sorted.sort((x, y) => {
      const rx = x.evidence_level in EVIDENCE_RANK ? EVIDENCE_RANK[x.evidence_level] : 99;
      const ry = y.evidence_level in EVIDENCE_RANK ? EVIDENCE_RANK[y.evidence_level] : 99;
      return rx - ry;
    });
  }
  return sorted;
}

function renderLibrary() {
  const rawTerm = searchBox.value.trim();
  const term = normalizeText(rawTerm);
  const diseaseVal = diseaseFilter.value;
  const evidenceVal = evidenceFilter.value;
  const applicabilityVal = applicabilityFilter.value;
  const collectionVal = collectionFilter.value;
  const favOnly = favFilter.checked;
  const collections = getCollections();

  const filtered = ARTICLES.filter((a) => {
    const allDiseases = [a.disease, ...parseArr(a.secondary_diseases)];
    if (diseaseVal && !allDiseases.includes(diseaseVal)) return false;
    if (evidenceVal && a.evidence_level !== evidenceVal) return false;
    if (applicabilityVal && !parseArr(a.clinical_applicability).includes(applicabilityVal)) return false;
    if (collectionVal && !(collections[collectionVal] || []).includes(a.id)) return false;
    if (favOnly && !isFavorite(a.id)) return false;
    if (!term) return true;
    const haystack = normalizeText([
      a.title, a.disease, a.topics, a.summary, a.full_text, a.subtopic,
      parseArr(a.secondary_diseases).join(' '), parseArr(a.clinical_applicability).join(' '),
    ].join(' '));
    return haystack.includes(term);
  });

  resultCount.textContent = filtered.length === ARTICLES.length
    ? filtered.length + ' artigo' + (filtered.length !== 1 ? 's' : '')
    : filtered.length + ' de ' + ARTICLES.length + ' artigos';

  if (filtered.length === 0) {
    libraryList.innerHTML = '<div class="empty-state">Nenhum artigo encontrado.</div>';
    return;
  }

  const sorted = sortArticles(filtered, sortSelect.value);

  libraryList.innerHTML = sorted.map((a) => {
    const metaParts = [];
    if (a.authors) metaParts.push(a.authors);
    if (a.year) metaParts.push(a.year);
    metaParts.push(a.status === 'concluido' ? 'Classificado' : a.status === 'erro' ? 'Erro no processamento' : 'Aguardando classificação');

    return '<div class="article-card" data-id="' + a.id + '">' +
      '<div class="card-actions">' +
        '<button class="icon-btn fav-btn' + (isFavorite(a.id) ? ' fav-active' : '') + '" data-id="' + a.id + '" title="Favoritar">' + (isFavorite(a.id) ? '★' : '☆') + '</button>' +
        '<button class="icon-btn coll-btn" data-id="' + a.id + '" title="Adicionar à coleção">📁</button>' +
      '</div>' +
      '<div class="title">' + highlightMatches(escapeHtml(a.title || a.original_name), rawTerm) + '</div>' +
      (a.summary ? '<div class="tldr">' + highlightMatches(escapeHtml(tldr(a.summary)), rawTerm) + '</div>' : '') +
      buildBreadcrumb(a) +
      '<div class="meta">' + escapeHtml(metaParts.join(' · ')) + '</div>' +
      '<div class="tags">' + buildTagsHtml(a, { compact: true }) + '</div>' +
    '</div>';
  }).join('');

  libraryList.querySelectorAll('.article-card').forEach((card) => {
    card.addEventListener('click', () => openModal(Number(card.dataset.id)));
  });
  libraryList.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(Number(btn.dataset.id)); renderLibrary(); });
  });
  libraryList.querySelectorAll('.coll-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openCollectionsPopover(Number(btn.dataset.id), btn); });
  });
}

searchBox.addEventListener('input', renderLibrary);
diseaseFilter.addEventListener('change', renderLibrary);
evidenceFilter.addEventListener('change', renderLibrary);
applicabilityFilter.addEventListener('change', renderLibrary);
collectionFilter.addEventListener('change', renderLibrary);
favFilter.addEventListener('change', renderLibrary);
sortSelect.addEventListener('change', renderLibrary);

// ---------- Popover de coleções ----------
const collectionsPopover = document.getElementById('collectionsPopover');
const collectionsList = document.getElementById('collectionsList');
const newCollectionInput = document.getElementById('newCollectionInput');
let popoverArticleId = null;

function renderCollectionsPopoverList() {
  const collections = getCollections();
  const names = Object.keys(collections).sort();
  if (names.length === 0) {
    collectionsList.innerHTML = '<div style="font-size:12px;color:#a0aec0;padding:4px">Nenhuma coleção ainda.</div>';
    return;
  }
  collectionsList.innerHTML = names.map((name) => {
    const checked = collections[name].includes(popoverArticleId);
    return '<label class="coll-item"><input type="checkbox" class="coll-check" data-name="' + escapeHtml(name) + '" ' + (checked ? 'checked' : '') + '> ' + escapeHtml(name) + ' (' + collections[name].length + ')</label>';
  }).join('');
  collectionsList.querySelectorAll('.coll-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      toggleArticleInCollection(cb.dataset.name, popoverArticleId);
      renderCollectionsPopoverList();
      populateCollectionFilter();
      renderLibrary();
    });
  });
}

function openCollectionsPopover(articleId, anchorEl) {
  popoverArticleId = articleId;
  renderCollectionsPopoverList();
  const rect = anchorEl.getBoundingClientRect();
  collectionsPopover.style.top = (window.scrollY + rect.bottom + 4) + 'px';
  collectionsPopover.style.left = Math.max(8, window.scrollX + rect.left - 150) + 'px';
  collectionsPopover.classList.add('active');
}

function closeCollectionsPopover() {
  collectionsPopover.classList.remove('active');
  popoverArticleId = null;
}

document.addEventListener('click', (e) => {
  if (collectionsPopover.classList.contains('active') && !collectionsPopover.contains(e.target) && !e.target.classList.contains('coll-btn')) {
    closeCollectionsPopover();
  }
});

document.getElementById('newCollectionBtn').addEventListener('click', () => {
  const name = newCollectionInput.value.trim();
  if (!name) return;
  createCollection(name);
  if (popoverArticleId != null) toggleArticleInCollection(name, popoverArticleId);
  newCollectionInput.value = '';
  renderCollectionsPopoverList();
  populateCollectionFilter();
  renderLibrary();
});
newCollectionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('newCollectionBtn').click(); });

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
  const isRelevance = (heading) => /relev[aâ]ncia cl[ií]nica/i.test(heading || '');

  const ids = sections.map((s, i) => slugify(s.heading, i));

  const nav = sections.length > 1
    ? '<div class="section-nav">' + sections.map((s, i) =>
        '<button type="button" class="section-nav-btn" data-target="' + ids[i] + '">' + escapeHtml(s.heading || ('Seção ' + (i + 1))) + '</button>'
      ).join('') + '</div>'
    : '';

  const body = '<div class="summary-sections">' + sections.map((s, i) =>
    '<div class="summary-section' + (isCritical(s.heading) ? ' critical' : '') + (isRelevance(s.heading) ? ' relevance' : '') + '" id="' + ids[i] + '">' +
      '<h4>' + escapeHtml(s.heading || '') + '</h4>' +
      '<p>' + escapeHtml(s.text || '') + '</p>' +
    '</div>'
  ).join('') + '</div>';

  return nav + body;
}

function computeRelatedArticles(a) {
  const aDiseases = new Set([a.disease, ...parseArr(a.secondary_diseases)].filter(Boolean));
  const aTopics = new Set((a.topics || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));

  const scored = ARTICLES.filter((x) => x.id !== a.id).map((x) => {
    let score = 0;
    const reasons = [];
    const xDiseases = new Set([x.disease, ...parseArr(x.secondary_diseases)].filter(Boolean));
    let sharedDiseases = 0;
    xDiseases.forEach((d) => { if (aDiseases.has(d)) { score += 3; sharedDiseases++; } });
    if (sharedDiseases > 0) reasons.push(sharedDiseases > 1 ? 'mesma doença/tema (' + sharedDiseases + ')' : 'mesma doença/tema');

    if (a.subtopic && x.subtopic && a.subtopic === x.subtopic) {
      score += 2;
      reasons.push('mesmo subtema');
    }

    let sharedTopics = 0;
    (x.topics || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).forEach((t) => { if (aTopics.has(t)) sharedTopics++; });
    if (sharedTopics > 0) {
      score += sharedTopics;
      reasons.push(sharedTopics + ' tópico' + (sharedTopics > 1 ? 's' : '') + ' em comum');
    }

    return { x, score, reason: reasons.join(' · ') };
  }).filter((s) => s.score > 0);

  scored.sort((p, q) => q.score - p.score);
  return scored.slice(0, 5);
}

function renderRelatedBox(a) {
  const related = computeRelatedArticles(a);
  if (related.length === 0) return '';
  return '<div class="related-box"><div class="section-label">Artigos Relacionados</div><div class="related-list">' +
    related.map((r) => '<div class="related-item" data-id="' + r.x.id + '">' +
      '<div class="related-title">' + escapeHtml(r.x.title || r.x.original_name) + '</div>' +
      (r.reason ? '<div class="related-reason">' + escapeHtml(r.reason) + '</div>' : '') +
    '</div>').join('') +
    '</div></div>';
}

function openModal(id) {
  const a = ARTICLES.find((x) => x.id === id);
  if (!a) return;

  modalBody.innerHTML =
    '<h3>' + escapeHtml(a.title || a.original_name) + '</h3>' +
    '<div class="meta">' + escapeHtml([a.authors, a.year].filter(Boolean).join(' · ')) + '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn-secondary fav-btn" data-id="' + a.id + '">' + (isFavorite(a.id) ? '★ Favorito' : '☆ Favoritar') + '</button>' +
      '<button class="btn-secondary coll-btn" data-id="' + a.id + '">📁 Coleções</button>' +
    '</div>' +
    buildBreadcrumb(a) +
    '<div class="tags">' + buildTagsHtml(a, { compact: false }) + '</div>' +
    renderSummaryBody(a) +
    renderRelatedBox(a);

  modalBody.querySelector('.fav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(a.id);
    openModal(a.id);
    renderLibrary();
  });
  modalBody.querySelector('.coll-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openCollectionsPopover(a.id, e.currentTarget);
  });
  modalBody.querySelectorAll('.related-item').forEach((el) => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
  modalBody.querySelectorAll('.section-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

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
populateFilters();
renderLibrary();
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log(`Gerado: ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${articles.length} artigos)`);
