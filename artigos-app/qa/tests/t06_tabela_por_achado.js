const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  await page.click('.tab-btn[data-tab="findings"]');
  await page.click('#findingsModeSearchBtn');
  await page.fill('#findingSearchInput', 'Acometimento nasossinusal');
  await page.click('#findingSearchBtn');
  await page.waitForTimeout(300);
  const f = await page.evaluate(() => {
    const t = document.querySelector('#findingsBySearchContent table');
    return { linhas: t.querySelectorAll('tbody tr.study-row').length,
             rowspan: !!t.querySelector('td[rowspan]'),
             hrAntigo: t.querySelectorAll('hr.source-sep').length,
             colunas: t.querySelectorAll('thead th').length };
  });
  check('uma linha por estudo', f.linhas > 1, f.linhas);
  check('doença agrupada por rowspan', f.rowspan);
  check('sem separador <hr> do formato antigo', f.hrAntigo === 0, f.hrAntigo);
  check('3 colunas (sem Contexto)', f.colunas === 3, f.colunas);
  // A % é clicável e abre o artigo de origem.
  await page.click('#findingsBySearchContent tr.study-row td[title]');
  await page.waitForTimeout(250);
  check('clique na % abre o artigo', await page.$eval('#modalOverlay', e => e.classList.contains('active')));
  await browser.close();
})();
