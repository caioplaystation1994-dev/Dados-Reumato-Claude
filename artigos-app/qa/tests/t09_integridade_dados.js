const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => ({
    // g/dL é concentração (hemoglobina), nunca posologia.
    doseConcentracao: MEDICATIONS_INDEX.filter(m => m.dose && /d[lL]\b/.test(m.dose)).map(m => m.drug + '=' + m.dose),
    // toda linha precisa apontar para um artigo existente.
    orfaos: [...FINDINGS_INDEX, ...MEDICATIONS_INDEX].filter(r => !ARTICLES.some(a => a.id === r.articleId)).length,
    // toda linha precisa ter ao menos uma doença.
    semDoenca: [...FINDINGS_INDEX, ...MEDICATIONS_INDEX].filter(r => !r.diseases || r.diseases.length === 0).length,
    // glicocorticoide foi deliberadamente excluído da aba Tratamento.
    glico: MEDICATIONS_INDEX.filter(m => /glicocorticoide/i.test(m.drug)).length,
  }));
  check('nenhuma dose com unidade de concentração', d.doseConcentracao.length === 0, JSON.stringify(d.doseConcentracao));
  check('nenhuma linha órfã de artigo', d.orfaos === 0, d.orfaos);
  check('nenhuma linha sem doença', d.semDoenca === 0, d.semDoenca);
  check('glicocorticoide segue fora da aba Tratamento', d.glico === 0, d.glico);
  await browser.close();
})();
