const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const s = await page.evaluate(() => {
    const k = f => f.articleId + '||' + f.finding;
    const clin = new Set(FINDINGS_INDEX.map(k));
    return { clinicos: FINDINGS_INDEX.filter(f => f.frequencyText && f.type !== 'etiológico').length,
             auto: AUTO_FINDINGS.length,
             vazou: AUTO_FINDINGS.filter(a => clin.has(k(a))).length,
             flag: FINDINGS_INDEX.filter(f => f.autoDiscovered).length };
  });
  check('índice clínico tem conteúdo', s.clinicos > 0, s.clinicos);
  check('fila de revisão tem conteúdo', s.auto > 0, s.auto);
  check('fila NÃO vaza para as tabelas clínicas', s.vazou === 0, s.vazou);
  check('nenhum auto-descoberto dentro do índice clínico', s.flag === 0, s.flag);
  await page.click('.tab-btn[data-tab="coverage"]');
  await page.click('#coverageAutoBtn');
  await page.waitForTimeout(400);
  const p = await page.evaluate(() => ({ linhas: document.querySelectorAll('#coverageAutoContent tbody tr').length,
                                          aviso: /não para uso clínico direto/i.test(document.getElementById('coverageAutoContent').innerText) }));
  check('painel de revisão renderiza', p.linhas > 0, p.linhas);
  check('painel traz aviso de não-uso-clínico', p.aviso);
  await browser.close();
})();
