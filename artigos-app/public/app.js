const state = {
  articles: [],
};

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'library') loadLibrary();
  });
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------- Upload ----------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('uploadList');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(fileList) {
  [...fileList].forEach((file) => {
    if (file.type !== 'application/pdf') return;
    uploadFile(file);
  });
  fileInput.value = '';
}

function makeUploadItem(name) {
  const li = document.createElement('li');
  li.className = 'upload-item status-processando';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = name;
  const statusSpan = document.createElement('span');
  statusSpan.className = 'status';
  statusSpan.textContent = 'Enviando...';
  li.appendChild(nameSpan);
  li.appendChild(statusSpan);
  uploadList.prepend(li);
  return { li, statusSpan };
}

async function uploadFile(file) {
  const { li, statusSpan } = makeUploadItem(file.name);
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/articles', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha no upload.');

    if (data.status === 'erro') {
      li.className = 'upload-item status-erro';
      statusSpan.textContent = 'Erro na extração do texto do PDF.';
    } else {
      li.className = 'upload-item status-pendente';
      statusSpan.textContent = 'Aguardando classificação';
    }
    loadLibrary();
  } catch (err) {
    li.className = 'upload-item status-erro';
    statusSpan.textContent = 'Erro: ' + err.message;
  }
}

// ---------- Library ----------
const searchBox = document.getElementById('searchBox');
const diseaseFilter = document.getElementById('diseaseFilter');
const libraryList = document.getElementById('libraryList');

document.getElementById('refreshLibBtn').addEventListener('click', loadLibrary);
searchBox.addEventListener('input', renderLibrary);
diseaseFilter.addEventListener('change', renderLibrary);

async function loadLibrary() {
  try {
    const res = await fetch('/api/articles');
    state.articles = await res.json();
    populateDiseaseFilter();
    renderLibrary();
  } catch (e) {
    libraryList.innerHTML = '<div class="empty-state">Erro ao carregar a biblioteca.</div>';
  }
}

function populateDiseaseFilter() {
  const diseases = [...new Set(state.articles.map((a) => a.disease).filter(Boolean))].sort();
  const current = diseaseFilter.value;
  diseaseFilter.innerHTML = '<option value="">Todas as doenças/temas</option>';
  diseases.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    diseaseFilter.appendChild(opt);
  });
  diseaseFilter.value = current;
}

function renderLibrary() {
  const term = searchBox.value.trim().toLowerCase();
  const diseaseVal = diseaseFilter.value;

  const filtered = state.articles.filter((a) => {
    if (diseaseVal && a.disease !== diseaseVal) return false;
    if (!term) return true;
    const haystack = [a.title, a.disease, a.topics, a.summary].join(' ').toLowerCase();
    return haystack.includes(term);
  });

  libraryList.innerHTML = '';
  if (filtered.length === 0) {
    libraryList.innerHTML = '<div class="empty-state">Nenhum artigo encontrado. Envie artigos na aba Upload.</div>';
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
    metaParts.push(
      a.status === 'concluido' ? 'Classificado' :
      a.status === 'erro' ? 'Erro no processamento' :
      'Aguardando classificação'
    );
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

// ---------- Modal ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

function closeModal() {
  modalOverlay.classList.remove('active');
  modalBody.innerHTML = '';
}

async function openModal(id) {
  const res = await fetch(`/api/articles/${id}`);
  if (!res.ok) return;
  const a = await res.json();

  modalBody.innerHTML = `
    <h3>${escapeHtml(a.title || a.original_name)}</h3>
    <div class="meta">${escapeHtml([a.authors, a.year].filter(Boolean).join(' · '))}</div>
    <div class="tags">
      ${a.disease ? `<span class="tag">${escapeHtml(a.disease)}</span>` : ''}
      ${(a.topics || '').split(',').map((s) => s.trim()).filter(Boolean).map((t) => `<span class="tag topic">${escapeHtml(t)}</span>`).join('')}
    </div>
    <div class="section-label">Resumo</div>
    <p>${escapeHtml(a.summary || 'Sem resumo disponível.')}</p>
    <div class="modal-actions">
      <a class="btn-secondary" href="/api/articles/${a.id}/file" target="_blank" rel="noopener">Abrir PDF original</a>
      <button class="btn-danger" id="deleteArticleBtn">Excluir</button>
    </div>
  `;

  document.getElementById('deleteArticleBtn').addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return;
    await fetch(`/api/articles/${a.id}`, { method: 'DELETE' });
    closeModal();
    loadLibrary();
  });

  modalOverlay.classList.add('active');
}

// ---------- Ask ----------
const questionInput = document.getElementById('questionInput');
const askBtn = document.getElementById('askBtn');
const askHistory = document.getElementById('askHistory');

askBtn.addEventListener('click', ask);
questionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

async function ask() {
  const question = questionInput.value.trim();
  if (!question) return;
  questionInput.value = '';
  askBtn.disabled = true;

  const item = document.createElement('div');
  item.className = 'qa-item';
  item.innerHTML = `
    <div class="qa-question">${escapeHtml(question)}</div>
    <div class="qa-answer qa-loading">Pensando...</div>
  `;
  askHistory.prepend(item);
  const answerDiv = item.querySelector('.qa-answer');

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao processar a pergunta.');

    answerDiv.classList.remove('qa-loading');
    answerDiv.textContent = data.answer;

    if (data.sources && data.sources.length > 0) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'qa-sources';
      sourcesDiv.innerHTML = '<b>Artigos consultados:</b> ' + data.sources.map((s) => escapeHtml(s.title)).join('; ');
      item.appendChild(sourcesDiv);
    }
  } catch (err) {
    answerDiv.classList.remove('qa-loading');
    answerDiv.textContent = 'Erro: ' + err.message;
  } finally {
    askBtn.disabled = false;
  }
}

// ---------- Init ----------
loadLibrary();
