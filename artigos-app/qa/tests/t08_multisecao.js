const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  // Mesmo fármaco documentado em duas seções do artigo gera as duas linhas.
  const multi = await page.evaluate(() => {
    const g = new Map();
    MEDICATIONS_INDEX.forEach(m => { const k = m.articleId + '|' + m.drug; if (!g.has(k)) g.set(k, []); g.get(k).push(m); });
    let comMultiplasSecoes = 0, dup = 0;
    const vistos = new Set();
    g.forEach(rows => { if (new Set(rows.map(r => r.heading || '')).size > 1) comMultiplasSecoes++; });
    MEDICATIONS_INDEX.forEach(m => {
      const k = m.articleId + '|' + m.drug + '|' + (m.dose || '') + '|' + (m.line || '');
      if (vistos.has(k)) dup++; else vistos.add(k);
    });
    return { comMultiplasSecoes, dup };
  });
  check('há fármacos documentados em mais de uma seção', multi.comMultiplasSecoes > 0, multi.comMultiplasSecoes);
  check('sem duplicata pura (mesmo fármaco+dose+linha)', multi.dup === 0, multi.dup);
  // Seções de comentário não viram linha de conduta.
  const com = await page.evaluate(() => {
    // Espelha isCommentaryHeading: só conta como comentário a seção cuja
    // categoria PRINCIPAL é limitações/relevância. "Prognóstico e Avaliação
    // Crítica" é híbrida e vale como prognóstico — conteúdo clínico.
    const puroComentario = (h) => {
      const n = (h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!n) return false;
      if (n.includes('prognostico') || n.includes('tratamento') || n.includes('diferencial')) return false;
      return n.includes('limitac') || (n.includes('critic') && !n.includes('criterio')) || n.includes('relevancia clinica');
    };
    return { m: MEDICATIONS_INDEX.filter(x => puroComentario(x.heading)).length,
             f: FINDINGS_INDEX.filter(x => puroComentario(x.heading)).length };
  });
  check('nenhuma medicação vinda de seção de comentário', com.m === 0, com.m);
  check('nenhum achado vindo de seção de comentário', com.f === 0, com.f);
  await browser.close();
})();
