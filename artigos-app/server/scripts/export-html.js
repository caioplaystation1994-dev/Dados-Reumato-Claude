// Uso interno (Claude Code): gera um unico arquivo HTML autocontido a partir
// do banco de dados, para o usuario poder abrir localmente sem precisar de
// servidor. Rodar sempre que novos artigos forem classificados.
//
// Uso: node server/scripts/export-html.js [caminho-de-saida.html] [--embed-pdfs]
//
// Por padrao os PDFs originais sao copiados para uma pasta "pdfs/" ao lado
// do HTML (arquivo principal leve). Com --embed-pdfs, os PDFs sao embutidos
// em base64 dentro do proprio HTML (arquivo unico e portatil, porem muito
// maior — pode passar de 100MB com a biblioteca atual).

const fs = require('fs');
const path = require('path');
const db = require('../db');
const { UPLOAD_DIR } = require('../paths');

const embedPdfs = process.argv.includes('--embed-pdfs');
const positional = process.argv.slice(2).filter((a) => a !== '--embed-pdfs');
const outPath = path.resolve(positional[0] || path.join(__dirname, '..', '..', '..', 'organizador_artigos.html'));

const articles = db
  .prepare(
    `SELECT id, title, authors, year, disease, topics, summary, detailed_summary, full_text, status, original_name,
     secondary_diseases, subtopic, evidence_level, clinical_applicability, filename
     FROM articles ORDER BY created_at DESC`
  )
  .all();

let pdfsCopied = 0;
let pdfsDir = null;

if (embedPdfs) {
  // Embute cada PDF original em base64 diretamente nos dados do artigo,
  // tornando o HTML totalmente autocontido e portatil (sem depender de
  // uma pasta externa), ao custo de um arquivo final muito maior.
  articles.forEach((a) => {
    a.has_pdf = false;
    a.pdf_data = null;
    if (!a.filename) return;
    const src = path.join(UPLOAD_DIR, a.filename);
    try {
      a.pdf_data = fs.readFileSync(src).toString('base64');
      a.has_pdf = true;
      pdfsCopied++;
    } catch (e) {
      // PDF original ausente; o botao "Ver PDF" nao sera exibido para este artigo.
    }
    delete a.filename;
  });
} else {
  // Copia os PDFs originais para uma pasta "pdfs/" ao lado do HTML gerado,
  // renomeados por ID, para permitir um link "Ver PDF original" sem inflar
  // o HTML em si.
  pdfsDir = path.join(path.dirname(outPath), 'pdfs');
  fs.mkdirSync(pdfsDir, { recursive: true });
  articles.forEach((a) => {
    a.has_pdf = false;
    if (!a.filename) return;
    const src = path.join(UPLOAD_DIR, a.filename);
    const dest = path.join(pdfsDir, a.id + '.pdf');
    try {
      fs.copyFileSync(src, dest);
      a.has_pdf = true;
      pdfsCopied++;
    } catch (e) {
      // PDF original ausente; o botao "Ver PDF" nao sera exibido para este artigo.
    }
    delete a.filename;
  });
}

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
.ask-panel{margin-top:4px}
.smart-result-item{cursor:pointer;transition:.15s}
.smart-result-item:hover{opacity:.85}
.smart-chunk-heading{font-size:11px;font-weight:700;text-transform:uppercase;color:#4a5568;margin:8px 0 4px}
.smart-chunk-text{margin-bottom:4px}

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

.view-toggle{display:flex;gap:6px;margin-bottom:12px}
.view-btn{background:#fff;border:1px solid #cbd5e0;color:#4a5568;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:600}
.view-btn.active{background:#1a56a0;color:#fff;border-color:#1a56a0}

.multiselect-btn{flex:1;min-width:180px;border:1px solid #cbd5e0;border-radius:8px;padding:9px 14px;font-size:13px;background:#fff;text-align:left;cursor:pointer;color:#2d3748}
.multiselect-btn:hover{border-color:#1a56a0}
.multiselect-popover{display:none;position:absolute;background:#fff;border:1px solid #cbd5e0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:10px;z-index:300;min-width:240px;max-height:280px;overflow-y:auto}
.multiselect-popover.active{display:block}
.ms-item{display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:12.5px;cursor:pointer;border-radius:4px}
.ms-item:hover{background:#f7faff}
.multiselect-actions{border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;text-align:right}

.tree-disease{margin-bottom:8px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:4px 12px}
.tree-disease-summary{cursor:pointer;font-weight:700;font-size:13.5px;color:#1a56a0;padding:10px 0}
.tree-subtopic{margin:4px 0 8px 16px}
.tree-subtopic-summary{cursor:pointer;font-weight:600;font-size:12.5px;color:#2d3748;padding:6px 0}
.tree-count{color:#a0aec0;font-weight:400}
.tree-articles{display:flex;flex-direction:column;gap:2px;margin:4px 0 8px 16px}
.tree-article-row{font-size:12.5px;color:#2d3748;padding:6px 10px;border-radius:6px;cursor:pointer;background:#f7faff}
.tree-article-row:hover{background:#e8f0fc}
.tree-year{color:#a0aec0}

.disease-view-picker{margin-bottom:14px}
.disease-view-picker select{width:100%;border:1px solid #cbd5e0;border-radius:8px;padding:10px 14px;font-size:13.5px;font-weight:600;color:#2d3748;background:#fff}
.dv-header{font-size:14px;color:#2d3748;margin-bottom:8px}
.dv-sources{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}
.dv-source-chip{font-size:11px;color:#1a56a0;background:#eef4fd;border:1px solid #d6e6fb;border-radius:12px;padding:4px 10px;cursor:pointer}
.dv-source-chip:hover{background:#e0edfc}
.dv-section{margin-bottom:20px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
.dv-section-title{font-size:13.5px;font-weight:700;color:#1a56a0;margin-bottom:10px}
.dv-entry{padding:10px 0;border-top:1px solid #eef1f5}
.dv-entry:first-child{border-top:none;padding-top:0}
.dv-entry-source{font-size:11.5px;color:#718096;margin-bottom:4px;cursor:pointer}
.dv-entry-source:hover{color:#1a56a0;text-decoration:underline}
.dv-entry-text{font-size:13px;color:#2d3748;line-height:1.55}
.dv-empty{font-size:12.5px;color:#a0aec0;font-style:italic}

.list-sentinel{text-align:center;color:#a0aec0;font-size:12px;padding:14px 0}

.fulltext-toggle-row{margin-top:18px;display:flex;justify-content:center}
.fulltext-section{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px}
.fulltext-empty{color:#a0aec0;font-size:13px;text-align:center;padding:16px 0}
.fulltext-meta{font-size:11.5px;color:#718096;margin-bottom:10px}
.fulltext-search{display:flex;align-items:center;gap:6px;margin-bottom:12px;position:sticky;top:0;background:#fff;padding:6px 0;z-index:5}
.fulltext-search input{flex:1;border:1px solid #cbd5e0;border-radius:6px;padding:6px 10px;font-size:12.5px}
.fulltext-count{font-size:11.5px;color:#718096;min-width:38px;text-align:center}
.fulltext-content{font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.75;color:#2d3748;white-space:pre-wrap;max-height:55vh;overflow-y:auto;padding:4px 2px}
.ft-mark{background:#fef08a}
.ft-mark-active{background:#f6ad55}

.pdf-actions{margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pdf-viewer{margin-top:12px;display:none}
.pdf-viewer.active{display:block}
.pdf-viewer iframe{width:100%;height:65vh;border:1px solid #e2e8f0;border-radius:8px}
.pdf-hint{font-size:11px;color:#a0aec0}

.dose-table{margin-top:10px;background:#fff8ed;border:1px solid #f6d9a8;border-radius:8px;padding:10px 12px}
.dose-table-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#b7791f;margin-bottom:6px}
.dose-table-row{font-size:12.5px;color:#4a3210;line-height:1.5;padding:3px 0;border-top:1px solid #f6e6c8}
.dose-table-row:first-child{border-top:none}
.dose-table-row b{color:#975a16}

.acronym{border-bottom:1px dashed #1a56a0;cursor:pointer;color:inherit}
.acronym:hover{background:#eef4fd}
.acronym-tooltip{display:none;position:absolute;background:#1a202c;color:#fff;font-size:12px;line-height:1.4;padding:8px 12px;border-radius:6px;max-width:280px;z-index:400;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.acronym-tooltip.active{display:block}
.acronym-tooltip b{color:#90cdf4}

.dv-timeline{margin-bottom:20px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
.dv-timeline-title{font-size:13.5px;font-weight:700;color:#1a56a0;margin-bottom:10px}
.dv-timeline-track{display:flex;gap:20px;overflow-x:auto;padding:12px 4px 4px;border-top:2px solid #e2e8f0}
.dv-timeline-year{min-width:150px;flex-shrink:0;position:relative}
.dv-timeline-year::before{content:'';position:absolute;top:-18px;left:0;width:10px;height:10px;border-radius:50%;background:#1a56a0}
.dv-timeline-year-label{font-weight:700;font-size:13px;color:#1a56a0;margin-bottom:6px}
.dv-timeline-item{font-size:11.5px;color:#2d3748;background:#f7faff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;margin-bottom:5px;cursor:pointer}
.dv-timeline-item:hover{border-color:#1a56a0}

.dv-related{margin-bottom:20px;background:#f7faff;border:1px solid #d6e6fb;border-radius:10px;padding:12px 16px}
.dv-related-title{font-size:12.5px;font-weight:700;color:#1a56a0;margin-bottom:8px}
.dv-related-chip{display:inline-block;background:#fff;border:1px solid #cbd5e0;color:#2d3748;font-size:11.5px;padding:4px 10px;border-radius:14px;margin:0 6px 6px 0;cursor:pointer}
.dv-related-chip:hover{border-color:#1a56a0;color:#1a56a0}

.dv-consistency{margin-bottom:20px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
.dv-consistency-title{font-size:13.5px;font-weight:700;color:#1a56a0;margin-bottom:8px}
.dv-consistency-box{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.dv-consistency-box input{flex:1;min-width:200px;border:1px solid #cbd5e0;border-radius:8px;padding:8px 12px;font-size:12.5px}
.dv-consistency-result{font-size:13px;line-height:1.6;color:#2d3748;white-space:pre-wrap;background:#f7faff;border-radius:8px;padding:12px 14px;margin-top:8px}
.dv-consistency-hint{font-size:11.5px;color:#718096}

.symptom-result-group{margin-bottom:16px}
.symptom-result-disease{font-size:12.5px;font-weight:700;color:#1a56a0;margin-bottom:6px}

.cite-link{color:#1a56a0;font-weight:600;cursor:pointer;text-decoration:underline dotted}
.cite-link:hover{color:#154180}
.qa-sources-item{display:inline-block;margin-right:8px;padding:2px 8px;border-radius:10px;font-size:11px;background:#edf2f7;color:#718096}
.qa-sources-item.cited{background:#dbeafe;color:#1a56a0;font-weight:600}
.qa-cache-badge{display:inline-block;font-size:10.5px;color:#975a16;background:#fff8ed;border:1px solid #f6d9a8;border-radius:10px;padding:1px 8px;margin-left:8px}
.qa-related{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}
.qa-related-chip{background:#eef4fd;color:#1a56a0;border:1px solid #d6e6fb;border-radius:14px;font-size:11.5px;padding:4px 10px;cursor:pointer}
.qa-related-chip:hover{background:#e0edfc}

body.compact-mode .modal{padding:16px 18px;max-width:680px}
body.compact-mode .modal h3{font-size:15px}
body.compact-mode .summary-sections{gap:10px}
body.compact-mode .summary-section h4{font-size:11px;margin-bottom:5px;padding-bottom:4px}
body.compact-mode .summary-section p{font-size:12.5px;line-height:1.5}
body.compact-mode .article-card{padding:10px 12px}
body.compact-mode .article-card .title{font-size:12.5px}
body.compact-mode main{padding:12px}
body.compact-mode .card{padding:14px 16px}

.list-viewport{position:relative}
.list-spacer{width:100%}

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
    <button type="button" id="compactModeBtn" title="Alterna um modo de leitura mais compacto, melhor para telas pequenas">📱 Compacto</button>
  </nav>
</header>

<main>
  <section id="tab-library" class="tab active">
    <div class="card">
      <div class="view-toggle">
        <button type="button" id="viewListBtn" class="view-btn active">☰ Lista</button>
        <button type="button" id="viewTreeBtn" class="view-btn">🌳 Árvore (Doença › Subtema)</button>
        <button type="button" id="viewDiseaseBtn" class="view-btn">📋 Por Doença</button>
      </div>
      <div id="diseaseView" class="disease-view" style="display:none">
        <div class="disease-view-picker">
          <select id="diseaseViewSelect"><option value="">Selecione uma doença/tema...</option></select>
        </div>
        <div id="diseaseViewContent"></div>
      </div>
      <div class="lib-controls">
        <input type="text" id="searchBox" placeholder="Buscar por título, doença, tema...">
        <button type="button" id="diseaseFilterBtn" class="multiselect-btn">Todas as doenças/temas</button>
        <button type="button" id="evidenceFilterBtn" class="multiselect-btn">Todos os níveis de evidência</button>
        <button type="button" id="applicabilityFilterBtn" class="multiselect-btn">Toda aplicabilidade clínica</button>
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
      <div class="view-toggle">
        <button type="button" id="modeSmartBtn" class="view-btn active">🔍 Busca Inteligente (sem IA)</button>
        <button type="button" id="modeAiBtn" class="view-btn">🤖 Perguntar com IA (Claude)</button>
        <button type="button" id="modeSymptomBtn" class="view-btn">🩺 Diferencial por Sintoma</button>
      </div>

      <div id="smartSearchPanel" class="ask-panel">
        <p class="hint">Localiza os trechos mais relevantes da sua biblioteca para a pergunta, sem usar IA nem chave de API — funciona totalmente offline, direto no seu navegador.</p>
        <div class="ask-box">
          <input type="text" id="smartQuestionInput" placeholder="Ex: Quais artigos falam sobre adesão ao tratamento na artrite reumatoide?">
          <button id="smartSearchBtn" class="btn-primary">Buscar</button>
        </div>
        <div id="smartResults" class="ask-history"></div>
      </div>

      <div id="symptomPanel" class="ask-panel" style="display:none">
        <p class="hint">Digite um sintoma ou achado (ex.: "proteinúria", "rash malar", "dor articular") para ver em quais artigos da biblioteca ele aparece documentado nas seções de Diagnóstico Diferencial e Investigação, agrupado por doença/tema.</p>
        <div class="ask-box">
          <input type="text" id="symptomInput" placeholder="Ex: proteinúria, rash malar, dor articular...">
          <button id="symptomSearchBtn" class="btn-primary">Buscar diferenciais</button>
        </div>
        <div id="symptomResults" class="ask-history"></div>
      </div>

      <div id="aiPanel" class="ask-panel" style="display:none">
        <h2>Pergunte sobre os artigos</h2>
        <p class="hint">A resposta é gerada com IA (Claude, Anthropic) com base apenas nos artigos desta biblioteca. Sua chave de API fica salva só no seu navegador (localStorage) e é usada apenas para chamar a API da Anthropic diretamente do seu computador. Perguntas de seguimento continuam a mesma conversa — clique em "Nova conversa" para recomeçar do zero.</p>

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
          <button id="newConversationBtn" class="btn-secondary" title="Começar uma nova conversa do zero">🆕 Nova conversa</button>
        </div>
        <div id="askHistory" class="ask-history"></div>
      </div>
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

<div id="multiselectPopover" class="multiselect-popover">
  <div id="multiselectList"></div>
  <div class="multiselect-actions">
    <button type="button" id="multiselectClear" class="btn-secondary" style="padding:4px 10px;font-size:11.5px">Limpar seleção</button>
  </div>
</div>

<div id="acronymTooltip" class="acronym-tooltip"></div>

<script>
const ARTICLES = ${dataJson};
const CLAUDE_MODEL = 'claude-sonnet-5';

// ---------- Modo de leitura compacto ----------
const compactModeBtn = document.getElementById('compactModeBtn');
function applyCompactMode(on) {
  document.body.classList.toggle('compact-mode', on);
  compactModeBtn.classList.toggle('active', on);
}
applyCompactMode(localStorage.getItem('organizador_compact_mode') === '1');
compactModeBtn.addEventListener('click', () => {
  const on = !document.body.classList.contains('compact-mode');
  applyCompactMode(on);
  localStorage.setItem('organizador_compact_mode', on ? '1' : '0');
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'library') renderVirtualList(true);
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
const collectionFilter = document.getElementById('collectionFilter');
const favFilter = document.getElementById('favFilter');
const sortSelect = document.getElementById('sortSelect');
const resultCount = document.getElementById('resultCount');
const libraryList = document.getElementById('libraryList');
const viewListBtn = document.getElementById('viewListBtn');
const viewTreeBtn = document.getElementById('viewTreeBtn');
const viewDiseaseBtn = document.getElementById('viewDiseaseBtn');
const diseaseView = document.getElementById('diseaseView');
const diseaseViewSelect = document.getElementById('diseaseViewSelect');
const diseaseViewContent = document.getElementById('diseaseViewContent');
const libControlsEl = document.querySelector('.lib-controls');

let viewMode = 'list';
let currentSorted = [];

// ---------- Filtros multi-seleção (doença, evidência, aplicabilidade) ----------
const filterState = { disease: new Set(), evidence: new Set(), applicability: new Set() };
const multiselectPopover = document.getElementById('multiselectPopover');
const multiselectList = document.getElementById('multiselectList');
let activeMultiselect = null;

function optionsForFilterKey(key) {
  const set = new Set();
  ARTICLES.forEach((a) => {
    if (key === 'disease') {
      if (a.disease) set.add(a.disease);
      parseArr(a.secondary_diseases).forEach((d) => set.add(d));
    } else if (key === 'evidence') {
      if (a.evidence_level) set.add(a.evidence_level);
    } else if (key === 'applicability') {
      parseArr(a.clinical_applicability).forEach((c) => set.add(c));
    }
  });
  return [...set].sort();
}

function multiselectButtonLabel(key, allLabel) {
  const n = filterState[key].size;
  return n === 0 ? allLabel : n + ' selecionada' + (n > 1 ? 's' : '');
}

function updateMultiselectButtons() {
  document.getElementById('diseaseFilterBtn').textContent = multiselectButtonLabel('disease', 'Todas as doenças/temas');
  document.getElementById('evidenceFilterBtn').textContent = multiselectButtonLabel('evidence', 'Todos os níveis de evidência');
  document.getElementById('applicabilityFilterBtn').textContent = multiselectButtonLabel('applicability', 'Toda aplicabilidade clínica');
}

function openMultiselect(key, anchorEl) {
  activeMultiselect = key;
  const opts = optionsForFilterKey(key);
  const selected = filterState[key];
  multiselectList.innerHTML = opts.length
    ? opts.map((o) => '<label class="ms-item"><input type="checkbox" class="ms-check" value="' + escapeHtml(o) + '" ' + (selected.has(o) ? 'checked' : '') + '> ' + escapeHtml(o) + '</label>').join('')
    : '<div style="font-size:12px;color:#a0aec0;padding:4px">Nenhuma opção.</div>';

  multiselectList.querySelectorAll('.ms-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) filterState[activeMultiselect].add(cb.value);
      else filterState[activeMultiselect].delete(cb.value);
      updateMultiselectButtons();
      renderLibrary();
    });
  });

  const rect = anchorEl.getBoundingClientRect();
  multiselectPopover.style.top = (window.scrollY + rect.bottom + 4) + 'px';
  multiselectPopover.style.left = Math.max(8, window.scrollX + rect.left) + 'px';
  multiselectPopover.classList.add('active');
}

function closeMultiselect() {
  multiselectPopover.classList.remove('active');
  activeMultiselect = null;
}

document.getElementById('diseaseFilterBtn').addEventListener('click', (e) => { e.stopPropagation(); openMultiselect('disease', e.currentTarget); });
document.getElementById('evidenceFilterBtn').addEventListener('click', (e) => { e.stopPropagation(); openMultiselect('evidence', e.currentTarget); });
document.getElementById('applicabilityFilterBtn').addEventListener('click', (e) => { e.stopPropagation(); openMultiselect('applicability', e.currentTarget); });
document.getElementById('multiselectClear').addEventListener('click', () => {
  if (!activeMultiselect) return;
  filterState[activeMultiselect].clear();
  updateMultiselectButtons();
  openMultiselect(activeMultiselect, document.getElementById(activeMultiselect + 'FilterBtn'));
  renderLibrary();
});
document.addEventListener('click', (e) => {
  if (multiselectPopover.classList.contains('active') && !multiselectPopover.contains(e.target) && !e.target.classList.contains('multiselect-btn')) {
    closeMultiselect();
  }
});

function setViewMode(mode) {
  viewMode = mode;
  viewListBtn.classList.toggle('active', mode === 'list');
  viewTreeBtn.classList.toggle('active', mode === 'tree');
  viewDiseaseBtn.classList.toggle('active', mode === 'disease');
  renderLibrary();
}
viewListBtn.addEventListener('click', () => setViewMode('list'));
viewTreeBtn.addEventListener('click', () => setViewMode('tree'));
viewDiseaseBtn.addEventListener('click', () => setViewMode('disease'));

function populateFilters() {
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

function cardHtml(a, rawTerm) {
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
}

function attachCardHandlers() {
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

// ---------- Virtualização da lista (renderiza só os cards visíveis, para escalar a bibliotecas muito grandes) ----------
const ITEM_HEIGHT_ESTIMATE = 140;
const OVERSCAN_PX = 700;
let vListStart = -1;
let vListEnd = -1;
let vListScrollScheduled = false;
const tabLibraryEl = document.getElementById('tab-library');

function renderVirtualList(force) {
  if (viewMode !== 'list' || currentSorted.length === 0) return;
  if (!tabLibraryEl.classList.contains('active')) return;

  const containerRect = libraryList.getBoundingClientRect();
  const scrolledPast = Math.max(0, -containerRect.top);
  const viewportHeight = window.innerHeight;
  const visibleStart = Math.max(0, scrolledPast - OVERSCAN_PX);
  const visibleEnd = scrolledPast + viewportHeight + OVERSCAN_PX;
  const startIndex = Math.max(0, Math.floor(visibleStart / ITEM_HEIGHT_ESTIMATE));
  const endIndex = Math.min(currentSorted.length, Math.ceil(visibleEnd / ITEM_HEIGHT_ESTIMATE));

  if (!force && startIndex === vListStart && endIndex === vListEnd) return;
  vListStart = startIndex;
  vListEnd = endIndex;

  const rawTerm = searchBox.value.trim();
  const topSpacer = startIndex * ITEM_HEIGHT_ESTIMATE;
  const bottomSpacer = (currentSorted.length - endIndex) * ITEM_HEIGHT_ESTIMATE;
  const slice = currentSorted.slice(startIndex, endIndex);

  libraryList.innerHTML =
    '<div class="list-spacer" style="height:' + topSpacer + 'px"></div>' +
    slice.map((a) => cardHtml(a, rawTerm)).join('') +
    '<div class="list-spacer" style="height:' + bottomSpacer + 'px"></div>';

  attachCardHandlers();
}

function onVirtualScroll() {
  if (vListScrollScheduled) return;
  vListScrollScheduled = true;
  requestAnimationFrame(() => {
    vListScrollScheduled = false;
    renderVirtualList(false);
  });
}
window.addEventListener('scroll', onVirtualScroll, { passive: true });
window.addEventListener('resize', onVirtualScroll);

function renderTree(list) {
  const byDisease = new Map();
  list.forEach((a) => {
    const d = a.disease || 'Sem categoria';
    if (!byDisease.has(d)) byDisease.set(d, new Map());
    const bySub = byDisease.get(d);
    const s = a.subtopic || 'Geral';
    if (!bySub.has(s)) bySub.set(s, []);
    bySub.get(s).push(a);
  });

  const diseases = [...byDisease.keys()].sort();
  libraryList.innerHTML = diseases.map((d) => {
    const subMap = byDisease.get(d);
    const total = [...subMap.values()].reduce((sum, arr) => sum + arr.length, 0);
    const subtopics = [...subMap.keys()].sort();
    return '<details class="tree-disease" open>' +
      '<summary class="tree-disease-summary">' + escapeHtml(d) + ' <span class="tree-count">(' + total + ')</span></summary>' +
      subtopics.map((s) => {
        const arts = subMap.get(s);
        return '<details class="tree-subtopic">' +
          '<summary class="tree-subtopic-summary">' + escapeHtml(s) + ' <span class="tree-count">(' + arts.length + ')</span></summary>' +
          '<div class="tree-articles">' +
            arts.map((a) => '<div class="tree-article-row" data-id="' + a.id + '">' + escapeHtml(a.title || a.original_name) + (a.year ? ' <span class="tree-year">· ' + escapeHtml(a.year) + '</span>' : '') + '</div>').join('') +
          '</div>' +
        '</details>';
      }).join('') +
    '</details>';
  }).join('');

  libraryList.querySelectorAll('.tree-article-row').forEach((row) => {
    row.addEventListener('click', () => openModal(Number(row.dataset.id)));
  });
}

// ---------- Extração de doses (blocos visuais destacados) ----------
const DOSE_RE = /(\\d+(?:[.,]\\d+)?(?:\\s*(?:-|–|a)\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:mg|g|mcg|µg|UI|ui)(?:\\/kg)?(?:\\/(?:dia|semana|m[eê]s|dose|m2|m²|dL|dl))?)/g;

function extractDoseSentences(text) {
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\\s+/);
  const found = [];
  sentences.forEach((s) => {
    DOSE_RE.lastIndex = 0;
    if (DOSE_RE.test(s)) {
      const trimmed = s.trim();
      if (trimmed.length > 8 && trimmed.length < 320) found.push(trimmed);
    }
  });
  return found.slice(0, 8);
}

function renderDoseTable(text) {
  const sentences = extractDoseSentences(text);
  if (sentences.length === 0) return '';
  const rows = sentences.map((s) => {
    DOSE_RE.lastIndex = 0;
    return '<div class="dose-table-row">' + escapeHtml(s).replace(DOSE_RE, '<b>$1</b>') + '</div>';
  }).join('');
  return '<div class="dose-table"><div class="dose-table-title">💊 Doses mencionadas nesta seção</div>' + rows + '</div>';
}

// ---------- Glossário de siglas clicável ----------
const ACRONYM_GLOSSARY = {
  'AR': 'Artrite Reumatoide', 'LES': 'Lúpus Eritematoso Sistêmico', 'SAF': 'Síndrome do Anticorpo Antifosfolípide',
  'DM': 'Dermatomiosite', 'PM': 'Polimiosite', 'EGPA': 'Granulomatose Eosinofílica com Poliangiite',
  'GPA': 'Granulomatose com Poliangiite', 'MPA': 'Poliangiite Microscópica', 'PAN': 'Poliarterite Nodosa',
  'AAV': 'Vasculite Associada a ANCA', 'ANCA': 'Anticorpo Anticitoplasma de Neutrófilo', 'FR': 'Fator Reumatoide',
  'ANA': 'Anticorpo Antinuclear', 'VHS': 'Velocidade de Hemossedimentação', 'PCR': 'Proteína C-Reativa',
  'DMARD': 'Fármaco Antirreumático Modificador de Doença', 'csDMARD': 'DMARD Sintético Convencional',
  'bDMARD': 'DMARD Biológico', 'tsDMARD': 'DMARD Sintético Direcionado', 'MTX': 'Metotrexato',
  'HCQ': 'Hidroxicloroquina', 'AZA': 'Azatioprina', 'MMF': 'Micofenolato de Mofetila', 'CYC': 'Ciclofosfamida',
  'RTX': 'Rituximabe', 'TCZ': 'Tocilizumabe', 'ABT': 'Abatacepte', 'ADA': 'Adalimumabe', 'ETN': 'Etanercepte',
  'IFX': 'Infliximabe', 'GC': 'Glicocorticoide', 'JAK': 'Janus Quinase', 'TNF': 'Fator de Necrose Tumoral',
  'IL-6': 'Interleucina 6', 'IL-17': 'Interleucina 17', 'IL-23': 'Interleucina 23',
  'SLEDAI': 'Systemic Lupus Erythematosus Disease Activity Index', 'BVAS': 'Birmingham Vasculitis Activity Score',
  'EULAR': 'European Alliance of Associations for Rheumatology', 'ACR': 'American College of Rheumatology',
  'IgAN': 'Nefropatia por IgA', 'IgG4-RD': 'Doença Relacionada a IgG4', 'PTI': 'Púrpura Trombocitopênica Imune',
  'AHAI': 'Anemia Hemolítica Autoimune', 'GLILD': 'Doença Pulmonar Intersticial Linfoide Granulomatosa',
  'DRC': 'Doença Renal Crônica', 'RM': 'Ressonância Magnética', 'TC': 'Tomografia Computadorizada',
  'IVIG': 'Imunoglobulina Intravenosa', 'ACG': 'Arterite de Células Gigantes', 'DILE': 'Lúpus Induzido por Droga',
  'dsDNA': 'DNA de Dupla Fita', 'ILD': 'Doença Pulmonar Intersticial', 'HAS': 'Hipertensão Arterial Sistêmica',
};

function linkifyAcronyms(safeHtml) {
  let result = safeHtml;
  Object.keys(ACRONYM_GLOSSARY).forEach((acr) => {
    const re = new RegExp('\\\\b(' + escapeRegex(acr) + ')\\\\b', 'g');
    result = result.replace(re, '<span class="acronym" data-acr="' + acr + '">$1</span>');
  });
  return result;
}

const acronymTooltip = document.getElementById('acronymTooltip');
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('acronym')) {
    const acr = e.target.dataset.acr;
    const expansion = ACRONYM_GLOSSARY[acr] || '';
    acronymTooltip.innerHTML = '<b>' + escapeHtml(acr) + '</b> — ' + escapeHtml(expansion);
    const rect = e.target.getBoundingClientRect();
    acronymTooltip.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    acronymTooltip.style.left = Math.max(8, window.scrollX + rect.left) + 'px';
    acronymTooltip.classList.add('active');
    e.stopPropagation();
  } else if (!acronymTooltip.contains(e.target)) {
    acronymTooltip.classList.remove('active');
  }
});

// ---------- Visão agregada "Por Doença" ----------
const DV_CATEGORIES = [
  { key: 'epidemiologia', label: '📊 Dados Epidemiológicos' },
  { key: 'fisiopatologia', label: '🧬 Fisiopatologia' },
  { key: 'moa', label: '💊 Mecanismo de Ação de Medicações' },
  { key: 'tratamento', label: '💉 Tratamento' },
  { key: 'diferencial', label: '🔍 Diagnóstico Diferencial e Investigação' },
];

function categorizeHeading(heading) {
  const h = normalizeText(heading);
  if (!h) return null;
  if (h.includes('diferencial')) return 'diferencial';
  if (h.includes('epidemiol') || h.includes('prevalenc') || h.includes('incidenc')) return 'epidemiologia';
  if (h.includes('mecanismo de acao')) return 'moa';
  if (h.includes('fisiopatolog') || h.includes('patogen') || h.includes('imunopatogen')) return 'fisiopatologia';
  if (h.includes('tratamento') || h.includes('terapi') || h.includes('posologia')) return 'tratamento';
  return null;
}

function getDiseaseArticles(diseaseName) {
  return ARTICLES.filter((a) => {
    const all = [a.disease, ...parseArr(a.secondary_diseases)];
    return all.includes(diseaseName);
  });
}

function populateDiseaseViewSelect() {
  const opts = optionsForFilterKey('disease');
  const prevValue = diseaseViewSelect.value;
  diseaseViewSelect.innerHTML = '<option value="">Selecione uma doença/tema...</option>' +
    opts.map((d) => '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + ' (' + getDiseaseArticles(d).length + ')</option>').join('');
  if (prevValue && opts.includes(prevValue)) diseaseViewSelect.value = prevValue;
}

function renderTimeline(articles) {
  if (articles.length === 0) return '';
  const byYear = new Map();
  const noYear = [];
  articles.forEach((a) => {
    const y = parseInt(a.year, 10);
    if (!y) { noYear.push(a); return; }
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(a);
  });
  const years = [...byYear.keys()].sort((x, y) => x - y);
  let track = years.map((y) =>
    '<div class="dv-timeline-year"><div class="dv-timeline-year-label">' + y + '</div>' +
      byYear.get(y).map((a) => '<div class="dv-timeline-item" data-id="' + a.id + '">' + escapeHtml(a.title || a.original_name) + '</div>').join('') +
    '</div>'
  ).join('');
  if (noYear.length > 0) {
    track += '<div class="dv-timeline-year"><div class="dv-timeline-year-label">Ano não informado</div>' +
      noYear.map((a) => '<div class="dv-timeline-item" data-id="' + a.id + '">' + escapeHtml(a.title || a.original_name) + '</div>').join('') +
    '</div>';
  }
  return '<div class="dv-timeline"><div class="dv-timeline-title">📅 Linha do tempo de publicações</div><div class="dv-timeline-track">' + track + '</div></div>';
}

function computeRelatedUnexplored(diseaseName, articles) {
  const primary = new Set(ARTICLES.map((a) => normalizeText(a.disease || '')).filter(Boolean));
  const diseaseNorm = normalizeText(diseaseName);
  const freq = new Map();
  articles.forEach((a) => {
    const candidates = [...parseArr(a.secondary_diseases), ...((a.topics || '').split(','))].map((s) => s.trim()).filter(Boolean);
    candidates.forEach((c) => {
      const norm = normalizeText(c);
      if (!norm || norm === diseaseNorm || primary.has(norm)) return;
      if (!freq.has(norm)) freq.set(norm, { label: c, count: 0 });
      freq.get(norm).count++;
    });
  });
  return [...freq.values()].sort((x, y) => y.count - x.count).slice(0, 6);
}

function renderRelatedUnexplored(diseaseName, articles) {
  const items = computeRelatedUnexplored(diseaseName, articles);
  if (items.length === 0) return '';
  const chips = items.map((it) =>
    '<span class="dv-related-chip" data-term="' + escapeHtml(it.label) + '">' + escapeHtml(it.label) + ' (' + it.count + ')</span>'
  ).join('');
  return '<div class="dv-related"><div class="dv-related-title">🧭 Doenças/temas relacionados ainda sem síntese própria nesta biblioteca</div>' + chips + '</div>';
}

function buildConsistencyPrompt(diseaseName, articles, finding) {
  const context = articles.slice(0, 10).map((a, i) => {
    const chunks = getArticleChunks(a).slice(0, 6);
    const text = chunks.map((c) => (c.heading ? c.heading + ': ' : '') + c.text).join('\\n').slice(0, 1800);
    return '[Artigo ' + (i + 1) + '] ' + (a.title || a.original_name) + (a.year ? ' (' + a.year + ')' : '') + '\\n' + text;
  }).join('\\n\\n');

  let instruction = 'Voce e um assistente que analisa a consistencia entre artigos cientificos de reumatologia sobre "' + diseaseName + '". ' +
    'Com base APENAS nos trechos abaixo, identifique pontos em que dois ou mais artigos concordam e pontos em que divergem entre si sobre algum achado, citando os artigos pelo titulo entre colchetes.';
  if (finding && finding.trim()) {
    instruction += ' Alem disso, para o achado especifico "' + finding.trim() + '", diga quantos artigos corroboram, quantos contradizem e quantos nao mencionam, listando os titulos em cada grupo.';
  }
  instruction += '\\n\\nArtigos:\\n\\n' + context + '\\n\\nResponda em portugues, de forma organizada com topicos.';
  return instruction;
}

function renderConsistencyPanel() {
  return '<div class="dv-consistency">' +
    '<div class="dv-consistency-title">🤖 Concordâncias e divergências entre os artigos (IA)</div>' +
    '<p class="dv-consistency-hint">Opcional: descreva um achado específico para contar quantos artigos corroboram vs. contradizem. Usa a mesma chave de API configurada na aba Perguntas.</p>' +
    '<div class="dv-consistency-box">' +
      '<input type="text" id="dvFindingInput" placeholder="Ex: risco de recidiva após suspensão do imunossupressor">' +
      '<button type="button" id="dvConsistencyBtn" class="btn-primary">Analisar com IA</button>' +
    '</div>' +
    '<div id="dvConsistencyResult"></div>' +
  '</div>';
}

function renderDiseaseView() {
  const diseaseName = diseaseViewSelect.value;
  if (!diseaseName) {
    diseaseViewContent.innerHTML = '<div class="empty-state">Selecione uma doença acima para ver a síntese agregada de fisiopatologia, mecanismo de ação, tratamento, epidemiologia e diagnóstico diferencial de todos os artigos da biblioteca sobre ela.</div>';
    return;
  }

  const articles = getDiseaseArticles(diseaseName);
  const buckets = { epidemiologia: [], fisiopatologia: [], moa: [], tratamento: [], diferencial: [] };
  articles.forEach((a) => {
    getArticleChunks(a).forEach((c) => {
      const cat = categorizeHeading(c.heading);
      if (cat) buckets[cat].push({ articleId: a.id, title: a.title || a.original_name, year: a.year, heading: c.heading, text: c.text });
    });
  });

  const sortedArticles = articles.slice().sort((x, y) => (Number(y.year) || 0) - (Number(x.year) || 0));
  const sourceChips = sortedArticles.map((a) =>
    '<span class="dv-source-chip" data-id="' + a.id + '">' + escapeHtml(a.title || a.original_name) + (a.year ? ' (' + escapeHtml(a.year) + ')' : '') + '</span>'
  ).join('');

  let html = '<div class="dv-header">Síntese agregada de <strong>' + escapeHtml(diseaseName) + '</strong> — ' + articles.length + ' artigo' + (articles.length !== 1 ? 's' : '') + ' desta biblioteca abordam este tema:</div>';
  html += '<div class="dv-sources">' + sourceChips + '</div>';
  html += renderTimeline(sortedArticles);
  html += renderRelatedUnexplored(diseaseName, articles);
  html += renderConsistencyPanel();

  DV_CATEGORIES.forEach((cat) => {
    const entries = buckets[cat.key];
    html += '<div class="dv-section"><div class="dv-section-title">' + cat.label + '</div>';
    if (entries.length === 0) {
      html += '<div class="dv-empty">Nenhum dos artigos desta biblioteca sobre ' + escapeHtml(diseaseName) + ' tem uma seção isolada deste tipo.</div>';
    } else {
      html += entries.map((e) =>
        '<div class="dv-entry">' +
          '<div class="dv-entry-source" data-id="' + e.articleId + '">' + escapeHtml(e.title) + (e.year ? ' · ' + escapeHtml(e.year) : '') + (e.heading ? ' — <em>' + escapeHtml(e.heading) + '</em>' : '') + '</div>' +
          '<div class="dv-entry-text">' + linkifyAcronyms(escapeHtml(e.text)) + '</div>' +
          renderDoseTable(e.text) +
        '</div>'
      ).join('');
    }
    html += '</div>';
  });

  diseaseViewContent.innerHTML = html;
  diseaseViewContent.querySelectorAll('.dv-entry-source, .dv-source-chip, .dv-timeline-item').forEach((el) => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
  diseaseViewContent.querySelectorAll('.dv-related-chip').forEach((el) => {
    el.addEventListener('click', () => {
      searchBox.value = el.dataset.term;
      setViewMode('list');
    });
  });

  const consistencyBtn = document.getElementById('dvConsistencyBtn');
  if (consistencyBtn) {
    consistencyBtn.addEventListener('click', async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        alert('Configure sua chave de API da Anthropic na aba Perguntas > Perguntar com IA antes de usar esta análise.');
        return;
      }
      const finding = document.getElementById('dvFindingInput').value;
      const resultEl = document.getElementById('dvConsistencyResult');
      resultEl.innerHTML = '<div class="dv-consistency-result qa-loading">Analisando artigos...</div>';
      consistencyBtn.disabled = true;
      try {
        const prompt = buildConsistencyPrompt(diseaseName, articles, finding);
        const answer = await askClaude([{ role: 'user', content: prompt }], apiKey);
        resultEl.innerHTML = '<div class="dv-consistency-result">' + escapeHtml(answer) + '</div>';
      } catch (err) {
        resultEl.innerHTML = '<div class="dv-consistency-result qa-error">Erro: ' + escapeHtml(err.message) + '</div>';
      } finally {
        consistencyBtn.disabled = false;
      }
    });
  }
}

diseaseViewSelect.addEventListener('change', renderDiseaseView);

function renderLibrary() {
  if (viewMode === 'disease') {
    libraryList.style.display = 'none';
    libControlsEl.style.display = 'none';
    resultCount.style.display = 'none';
    diseaseView.style.display = 'block';
    populateDiseaseViewSelect();
    renderDiseaseView();
    return;
  }
  libraryList.style.display = '';
  libControlsEl.style.display = '';
  resultCount.style.display = '';
  diseaseView.style.display = 'none';

  const rawTerm = searchBox.value.trim();
  const term = normalizeText(rawTerm);
  const collectionVal = collectionFilter.value;
  const favOnly = favFilter.checked;
  const collections = getCollections();

  const filtered = ARTICLES.filter((a) => {
    const allDiseases = [a.disease, ...parseArr(a.secondary_diseases)];
    if (filterState.disease.size > 0 && ![...filterState.disease].some((d) => allDiseases.includes(d))) return false;
    if (filterState.evidence.size > 0 && !filterState.evidence.has(a.evidence_level)) return false;
    if (filterState.applicability.size > 0) {
      const appl = parseArr(a.clinical_applicability);
      if (![...filterState.applicability].some((c) => appl.includes(c))) return false;
    }
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
    currentSorted = [];
    libraryList.innerHTML = '<div class="empty-state">Nenhum artigo encontrado.</div>';
    return;
  }

  const sorted = sortArticles(filtered, sortSelect.value);

  if (viewMode === 'tree') {
    currentSorted = [];
    renderTree(sorted);
    return;
  }

  currentSorted = sorted;
  vListStart = -1;
  vListEnd = -1;
  renderVirtualList(true);
}

searchBox.addEventListener('input', renderLibrary);
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
    return '<div class="section-label">Resumo</div><p>' + linkifyAcronyms(escapeHtml(a.summary || 'Sem resumo disponível.')) + '</p>' + renderDoseTable(a.summary || '');
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
      '<p>' + linkifyAcronyms(escapeHtml(s.text || '')) + '</p>' +
      renderDoseTable(s.text || '') +
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

// ---------- PDF original (embutido em base64 ou pasta "pdfs/" ao lado do HTML) ----------
function buildPdfActionsHtml(a) {
  if (!a.has_pdf) return '';
  const href = a.pdf_data ? 'data:application/pdf;base64,' + a.pdf_data : 'pdfs/' + a.id + '.pdf';
  const hint = a.pdf_data ? '' : '<span class="pdf-hint">Requer a pasta "pdfs/" ao lado deste arquivo HTML.</span>';
  return '<div class="pdf-actions">' +
      '<a class="btn-secondary" href="' + href + '" target="_blank" rel="noopener">📄 Abrir PDF original</a>' +
      '<button type="button" class="btn-secondary" id="togglePdfViewer" data-href="' + href + '">🖼️ Ver PDF aqui</button>' +
      hint +
    '</div>' +
    '<div id="pdfViewer" class="pdf-viewer"></div>';
}

// ---------- Texto completo (extraído do PDF) ----------
function buildFullTextHtml(a) {
  if (!a.full_text || !a.full_text.trim()) {
    return '<div class="fulltext-empty">Texto completo não disponível para este artigo.</div>';
  }
  const cleaned = a.full_text.replace(/\\r\\n/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
  const words = cleaned.split(/\\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return '<div class="fulltext-meta">~' + words + ' palavras · ~' + minutes + ' min de leitura</div>' +
    '<div class="fulltext-search">' +
      '<input type="text" id="fulltextSearchInput" placeholder="Buscar no texto completo...">' +
      '<span id="fulltextMatchCount" class="fulltext-count"></span>' +
      '<button type="button" id="fulltextPrev" class="icon-btn" title="Ocorrência anterior">↑</button>' +
      '<button type="button" id="fulltextNext" class="icon-btn" title="Próxima ocorrência">↓</button>' +
    '</div>' +
    '<div id="fulltextContent" class="fulltext-content">' + escapeHtml(cleaned) + '</div>';
}

function setupFullTextSearch() {
  const input = document.getElementById('fulltextSearchInput');
  const countEl = document.getElementById('fulltextMatchCount');
  const prevBtn = document.getElementById('fulltextPrev');
  const nextBtn = document.getElementById('fulltextNext');
  const content = document.getElementById('fulltextContent');
  if (!input || !content) return;
  const originalHtml = content.innerHTML;
  let matches = [];
  let activeIndex = -1;

  function updateActive() {
    matches.forEach((m, i) => m.classList.toggle('ft-mark-active', i === activeIndex));
    if (activeIndex >= 0) {
      matches[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      countEl.textContent = (activeIndex + 1) + '/' + matches.length;
    } else {
      countEl.textContent = input.value.trim() ? '0/0' : '';
    }
  }

  function applyHighlight(term) {
    if (!term) {
      content.innerHTML = originalHtml;
      matches = [];
      activeIndex = -1;
      countEl.textContent = '';
      return;
    }
    let re;
    try {
      re = new RegExp('(' + escapeRegex(term) + ')', 'gi');
    } catch (e) {
      return;
    }
    content.innerHTML = originalHtml.replace(re, '<mark class="ft-mark">$1</mark>');
    matches = [...content.querySelectorAll('.ft-mark')];
    activeIndex = matches.length > 0 ? 0 : -1;
    updateActive();
  }

  input.addEventListener('input', () => applyHighlight(input.value.trim()));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nextBtn.click(); } });
  nextBtn.addEventListener('click', () => {
    if (matches.length === 0) return;
    activeIndex = (activeIndex + 1) % matches.length;
    updateActive();
  });
  prevBtn.addEventListener('click', () => {
    if (matches.length === 0) return;
    activeIndex = (activeIndex - 1 + matches.length) % matches.length;
    updateActive();
  });
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
    renderRelatedBox(a) +
    buildPdfActionsHtml(a) +
    '<div class="fulltext-toggle-row"><button type="button" id="toggleFullText" class="btn-secondary">📖 Ler artigo completo</button></div>' +
    '<div id="fullTextSection" class="fulltext-section" style="display:none">' + buildFullTextHtml(a) + '</div>';

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

  const pdfToggleBtn = modalBody.querySelector('#togglePdfViewer');
  if (pdfToggleBtn) {
    pdfToggleBtn.addEventListener('click', () => {
      const viewer = document.getElementById('pdfViewer');
      const isActive = viewer.classList.contains('active');
      if (isActive) {
        viewer.classList.remove('active');
        viewer.innerHTML = '';
      } else {
        viewer.innerHTML = '<iframe src="' + pdfToggleBtn.dataset.href + '"></iframe>';
        viewer.classList.add('active');
      }
    });
  }

  const fullTextToggleBtn = modalBody.querySelector('#toggleFullText');
  const fullTextSection = modalBody.querySelector('#fullTextSection');
  let fullTextSearchReady = false;
  fullTextToggleBtn.addEventListener('click', () => {
    const isHidden = fullTextSection.style.display === 'none';
    fullTextSection.style.display = isHidden ? 'block' : 'none';
    fullTextToggleBtn.textContent = isHidden ? '📖 Ocultar texto completo' : '📖 Ler artigo completo';
    if (isHidden && !fullTextSearchReady) {
      setupFullTextSearch();
      fullTextSearchReady = true;
    }
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

// ---------- Modo de pergunta: alternância Busca Inteligente / IA / Diferencial por Sintoma ----------
const modeSmartBtn = document.getElementById('modeSmartBtn');
const modeAiBtn = document.getElementById('modeAiBtn');
const modeSymptomBtn = document.getElementById('modeSymptomBtn');
const smartSearchPanel = document.getElementById('smartSearchPanel');
const aiPanel = document.getElementById('aiPanel');
const symptomPanel = document.getElementById('symptomPanel');

function setAskMode(mode) {
  modeSmartBtn.classList.toggle('active', mode === 'smart');
  modeAiBtn.classList.toggle('active', mode === 'ai');
  modeSymptomBtn.classList.toggle('active', mode === 'symptom');
  smartSearchPanel.style.display = mode === 'smart' ? 'block' : 'none';
  aiPanel.style.display = mode === 'ai' ? 'block' : 'none';
  symptomPanel.style.display = mode === 'symptom' ? 'block' : 'none';
}
modeSmartBtn.addEventListener('click', () => setAskMode('smart'));
modeAiBtn.addEventListener('click', () => setAskMode('ai'));
modeSymptomBtn.addEventListener('click', () => setAskMode('symptom'));

// ---------- Ask ----------
const STOPWORDS = new Set(['que','qual','quais','como','para','com','uma','um','dos','das','the','and','sobre','existe','existem','tem','foi','sao','ele','ela','isso','esse','essa','este','esta','nos','mais']);

// ---------- Busca Inteligente (sem IA, 100% local) ----------
function tokenizeQuery(question) {
  const words = normalizeText(question).match(/[a-z0-9]{3,}/g) || [];
  return [...new Set(words.filter((w) => !STOPWORDS.has(w)))];
}

function countOccurrences(haystack, term) {
  if (!term) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(term, idx)) !== -1) {
    count++;
    idx += term.length;
  }
  return count;
}

function getArticleChunks(a) {
  const chunks = [];
  if (a.detailed_summary) {
    try {
      const parsed = JSON.parse(a.detailed_summary);
      if (Array.isArray(parsed)) {
        parsed.forEach((s) => {
          if (s && s.text) chunks.push({ heading: s.heading || '', text: s.text });
        });
      }
    } catch (e) {
      // ignora resumo estruturado invalido
    }
  }
  if (chunks.length === 0 && a.full_text) {
    const paras = a.full_text.replace(/\\r\\n/g, '\\n').split(/\\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 40);
    paras.forEach((p) => chunks.push({ heading: '', text: p }));
  }
  if (chunks.length === 0 && a.summary) {
    chunks.push({ heading: 'Resumo', text: a.summary });
  }
  return chunks;
}

function excerptAround(text, terms, maxLen) {
  maxLen = maxLen || 400;
  if (text.length <= maxLen) return text;
  const normText = normalizeText(text);
  let firstIdx = -1;
  terms.forEach((t) => {
    const idx = normText.indexOf(t);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) firstIdx = idx;
  });
  if (firstIdx === -1) return text.slice(0, maxLen) + '…';
  const start = Math.max(0, firstIdx - 120);
  const end = Math.min(text.length, start + maxLen);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

function highlightTerms(safeHtml, terms) {
  if (!terms || terms.length === 0) return safeHtml;
  try {
    const pattern = terms.map(escapeRegex).join('|');
    const re = new RegExp('(' + pattern + ')', 'gi');
    return safeHtml.replace(re, '<mark>$1</mark>');
  } catch (e) {
    return safeHtml;
  }
}

function smartSearchLibrary(question) {
  const terms = tokenizeQuery(question);
  if (terms.length === 0) return [];

  const results = [];
  ARTICLES.forEach((a) => {
    const chunks = getArticleChunks(a);
    if (chunks.length === 0) return;
    const scoredChunks = chunks.map((c) => {
      const normText = normalizeText(c.text);
      let score = 0;
      terms.forEach((t) => { score += countOccurrences(normText, t); });
      return { heading: c.heading, text: c.text, score };
    }).filter((c) => c.score > 0);
    if (scoredChunks.length === 0) return;
    scoredChunks.sort((x, y) => y.score - x.score);
    const articleScore = scoredChunks.reduce((sum, c) => sum + c.score, 0);
    results.push({ article: a, score: articleScore, topChunks: scoredChunks.slice(0, 2) });
  });

  results.sort((x, y) => y.score - x.score);
  return results.slice(0, 8);
}

const smartQuestionInput = document.getElementById('smartQuestionInput');
const smartSearchBtn = document.getElementById('smartSearchBtn');
const smartResults = document.getElementById('smartResults');

function renderSmartResults(question) {
  const results = smartSearchLibrary(question);
  const terms = tokenizeQuery(question);

  if (results.length === 0) {
    smartResults.innerHTML = '<div class="empty-state">Nenhum trecho relevante encontrado na biblioteca para essa pergunta.</div>';
    return;
  }

  smartResults.innerHTML = results.map((r) => {
    const a = r.article;
    const chunksHtml = r.topChunks.map((c) => {
      const excerpt = excerptAround(c.text, terms);
      return (c.heading ? '<div class="smart-chunk-heading">' + escapeHtml(c.heading) + '</div>' : '') +
        '<p class="smart-chunk-text">' + highlightTerms(escapeHtml(excerpt), terms) + '</p>';
    }).join('');
    return '<div class="qa-item smart-result-item" data-id="' + a.id + '">' +
      '<div class="qa-question">' + escapeHtml(a.title || a.original_name) + '</div>' +
      '<div class="qa-answer">' + chunksHtml + '</div>' +
    '</div>';
  }).join('');

  smartResults.querySelectorAll('.smart-result-item').forEach((el) => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
}

smartSearchBtn.addEventListener('click', () => {
  const q = smartQuestionInput.value.trim();
  if (!q) return;
  renderSmartResults(q);
});
smartQuestionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') smartSearchBtn.click(); });

// ---------- Busca por sintoma → diagnóstico diferencial já documentado ----------
const symptomInput = document.getElementById('symptomInput');
const symptomSearchBtn = document.getElementById('symptomSearchBtn');
const symptomResults = document.getElementById('symptomResults');

function searchSymptomDifferentials(term) {
  const normTerm = normalizeText(term);
  const byDisease = new Map();
  ARTICLES.forEach((a) => {
    getArticleChunks(a).forEach((c) => {
      if (categorizeHeading(c.heading) !== 'diferencial') return;
      if (!normalizeText(c.text).includes(normTerm)) return;
      const disease = a.disease || 'Sem categoria';
      if (!byDisease.has(disease)) byDisease.set(disease, []);
      byDisease.get(disease).push({ article: a, heading: c.heading, text: c.text });
    });
  });
  return byDisease;
}

function renderSymptomResults(term) {
  const byDisease = searchSymptomDifferentials(term);
  const terms = [normalizeText(term)];
  if (byDisease.size === 0) {
    symptomResults.innerHTML = '<div class="empty-state">Nenhuma seção de Diagnóstico Diferencial desta biblioteca menciona esse termo.</div>';
    return;
  }
  const diseases = [...byDisease.keys()].sort();
  symptomResults.innerHTML = diseases.map((disease) => {
    const entries = byDisease.get(disease);
    const items = entries.map((e) => {
      const excerpt = excerptAround(e.text, terms);
      return '<div class="qa-item smart-result-item" data-id="' + e.article.id + '">' +
        '<div class="qa-question">' + escapeHtml(e.article.title || e.article.original_name) + (e.article.year ? ' · ' + escapeHtml(e.article.year) : '') + '</div>' +
        '<div class="qa-answer">' + (e.heading ? '<div class="smart-chunk-heading">' + escapeHtml(e.heading) + '</div>' : '') +
          '<p class="smart-chunk-text">' + highlightTerms(escapeHtml(excerpt), terms) + '</p>' +
        '</div></div>';
    }).join('');
    return '<div class="symptom-result-group"><div class="symptom-result-disease">' + escapeHtml(disease) + ' (' + entries.length + ')</div>' + items + '</div>';
  }).join('');

  symptomResults.querySelectorAll('.smart-result-item').forEach((el) => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
}

symptomSearchBtn.addEventListener('click', () => {
  const q = symptomInput.value.trim();
  if (!q) return;
  renderSymptomResults(q);
});
symptomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') symptomSearchBtn.click(); });

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

function buildContextBlock(articles) {
  return articles.map((a, i) => {
    const excerpt = (a.full_text || '').slice(0, 6000);
    return '[Artigo ' + (i + 1) + ']\\nTitulo: ' + (a.title || a.original_name) +
      '\\nDoenca/Tema: ' + (a.disease || 'ainda nao classificado') +
      '\\nTopicos: ' + (a.topics || 'ainda nao classificado') +
      '\\nResumo: ' + (a.summary || 'ainda nao classificado') +
      '\\nTrecho do texto:\\n"""\\n' + excerpt + '\\n"""';
  }).join('\\n\\n');
}

function buildPrompt(question, articles) {
  const context = buildContextBlock(articles);
  return 'Voce e um assistente que responde perguntas com base APENAS nos artigos cientificos fornecidos abaixo. Nao use conhecimento externo alem do que estiver nos trechos. Se a informacao nao estiver nos artigos, diga claramente que nao encontrou a resposta nos artigos cadastrados.\\n\\n' +
    'Sempre que usar informacao de um artigo, cite-o pelo titulo entre colchetes, ex: [Titulo do artigo].\\n\\n' +
    'Artigos disponiveis:\\n\\n' + context + '\\n\\nPergunta do usuario: ' + question + '\\n\\nResponda em portugues, de forma clara e objetiva.';
}

async function askClaude(messages, apiKey) {
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
      messages: messages,
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
const newConversationBtn = document.getElementById('newConversationBtn');

// ---------- Conversa com IA: histórico multi-turno, cache local e sugestões ----------
let conversationMessages = [];
let conversationArticles = [];
let conversationGeneration = 0;
const QA_CACHE_KEY = 'organizador_qa_cache';

function getQaCache() {
  try { return JSON.parse(localStorage.getItem(QA_CACHE_KEY) || '{}'); } catch (e) { return {}; }
}
function saveQaCache(cache) { localStorage.setItem(QA_CACHE_KEY, JSON.stringify(cache)); }
function cacheKeyFor(question) { return normalizeText(question).trim(); }

function renderCitedAnswer(answer, articles) {
  return escapeHtml(answer).replace(/\\[([^\\]]+)\\]/g, (whole, inner) => {
    const normInner = normalizeText(inner);
    const match = articles.find((a) => {
      const t = normalizeText(a.title || a.original_name || '');
      return t && (t.includes(normInner) || normInner.includes(t));
    });
    if (!match) return whole;
    return '<span class="cite-link" data-id="' + match.id + '">[' + inner + ']</span>';
  });
}

function computeCitedIds(answer, articles) {
  const cited = new Set();
  const normAnswer = normalizeText(answer);
  articles.forEach((a) => {
    const t = normalizeText(a.title || a.original_name || '');
    if (t && normAnswer.includes(t.slice(0, 30))) cited.add(a.id);
  });
  return cited;
}

function suggestRelatedQuestions(articles) {
  const topicCount = new Map();
  articles.forEach((a) => {
    (a.topics || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((t) => {
      topicCount.set(t, (topicCount.get(t) || 0) + 1);
    });
  });
  const topTopics = [...topicCount.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map((e) => e[0]);
  const templates = [
    (t) => 'O que a biblioteca diz sobre ' + t + '?',
    (t) => 'Qual a relevância clínica de ' + t + '?',
    (t) => 'Existe divergência entre os artigos sobre ' + t + '?',
  ];
  return topTopics.map((t, i) => templates[i % templates.length](t));
}

function resetConversation() {
  conversationGeneration++;
  conversationMessages = [];
  conversationArticles = [];
  askHistory.innerHTML = '';
}
newConversationBtn.addEventListener('click', resetConversation);

askBtn.addEventListener('click', ask);
questionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

let isAsking = false;

async function ask() {
  const question = questionInput.value.trim();
  if (!question) return;
  if (isAsking) return; // evita envio duplicado (ex.: Enter pressionado repetidamente antes da resposta chegar)

  const apiKey = getApiKey();
  if (!apiKey) {
    alert('Cole sua chave de API da Anthropic acima e clique em "Salvar chave" antes de perguntar.');
    return;
  }

  isAsking = true;
  const isFollowUp = conversationMessages.length > 0;
  const myGeneration = conversationGeneration;
  questionInput.value = '';
  askBtn.disabled = true;

  const item = document.createElement('div');
  item.className = 'qa-item';
  item.innerHTML = '<div class="qa-question">' + escapeHtml(question) + '</div><div class="qa-answer qa-loading">Pensando...</div>';
  askHistory.appendChild(item);
  item.scrollIntoView({ behavior: 'smooth', block: 'end' });
  const answerDiv = item.querySelector('.qa-answer');

  try {
    let relevant;
    let userContent;
    if (isFollowUp) {
      const extra = pickRelevantArticles(question).filter((a) => !conversationArticles.some((c) => c.id === a.id)).slice(0, 3);
      relevant = conversationArticles.concat(extra);
      userContent = extra.length > 0
        ? 'Contexto adicional (novos artigos relevantes):\\n\\n' + buildContextBlock(extra) + '\\n\\nPergunta de seguimento: ' + question
        : question;
    } else {
      relevant = pickRelevantArticles(question);
      userContent = buildPrompt(question, relevant);
    }

    if (relevant.length === 0) {
      answerDiv.classList.remove('qa-loading');
      answerDiv.textContent = 'Ainda nao ha artigos com texto disponivel na biblioteca para responder perguntas.';
      return;
    }
    conversationArticles = relevant;

    const cacheKey = cacheKeyFor(question);
    const cache = getQaCache();
    let answer;
    let fromCache = false;

    if (!isFollowUp && cache[cacheKey]) {
      answer = cache[cacheKey].answer;
      fromCache = true;
      conversationMessages.push({ role: 'user', content: userContent });
      conversationMessages.push({ role: 'assistant', content: answer });
    } else {
      conversationMessages.push({ role: 'user', content: userContent });
      answer = await askClaude(conversationMessages, apiKey);
      if (myGeneration !== conversationGeneration) return; // conversa foi reiniciada enquanto aguardava a resposta; descarta
      conversationMessages.push({ role: 'assistant', content: answer });
      if (!isFollowUp) {
        cache[cacheKey] = { answer: answer, ts: Date.now() };
        saveQaCache(cache);
      }
    }

    answerDiv.classList.remove('qa-loading');
    answerDiv.innerHTML = renderCitedAnswer(answer, relevant) + (fromCache ? '<span class="qa-cache-badge">⚡ resposta em cache</span>' : '');
    answerDiv.querySelectorAll('.cite-link').forEach((el) => {
      el.addEventListener('click', () => openModal(Number(el.dataset.id)));
    });

    const citedIds = computeCitedIds(answer, relevant);
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'qa-sources';
    sourcesDiv.innerHTML = '<b>Artigos consultados:</b> ' + relevant.map((a) =>
      '<span class="qa-sources-item' + (citedIds.has(a.id) ? ' cited' : '') + ' cite-link" data-id="' + a.id + '">' + escapeHtml(a.title || a.original_name) + '</span>'
    ).join('');
    item.appendChild(sourcesDiv);
    sourcesDiv.querySelectorAll('.cite-link').forEach((el) => {
      el.addEventListener('click', () => openModal(Number(el.dataset.id)));
    });

    if (fromCache) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-secondary';
      retryBtn.style.marginTop = '8px';
      retryBtn.textContent = '🔄 Reprocessar (ignorar cache)';
      retryBtn.addEventListener('click', () => {
        const freshCache = getQaCache();
        delete freshCache[cacheKey];
        saveQaCache(freshCache);
        conversationMessages = conversationMessages.slice(0, -2);
        item.remove();
        questionInput.value = question;
        ask();
      });
      item.appendChild(retryBtn);
    }

    const suggestions = suggestRelatedQuestions(relevant);
    if (suggestions.length > 0) {
      const relatedDiv = document.createElement('div');
      relatedDiv.className = 'qa-related';
      relatedDiv.innerHTML = suggestions.map((s) => '<span class="qa-related-chip">' + escapeHtml(s) + '</span>').join('');
      relatedDiv.querySelectorAll('.qa-related-chip').forEach((el) => {
        el.addEventListener('click', () => {
          questionInput.value = el.textContent;
          ask();
        });
      });
      item.appendChild(relatedDiv);
    }
  } catch (err) {
    answerDiv.classList.remove('qa-loading');
    answerDiv.classList.add('qa-error');
    answerDiv.textContent = 'Erro: ' + err.message;
    if (myGeneration === conversationGeneration && conversationMessages.length > 0 && conversationMessages[conversationMessages.length - 1].role === 'user') {
      conversationMessages.pop();
    }
  } finally {
    askBtn.disabled = false;
    isAsking = false;
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
if (embedPdfs) {
  console.log(`PDFs embutidos em base64 no HTML: ${pdfsCopied}/${articles.length}`);
} else {
  console.log(`PDFs copiados para ${pdfsDir}: ${pdfsCopied}/${articles.length}`);
}
