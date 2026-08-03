const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  await page.click('.tab-btn[data-tab="treatment"]');
  const td = await page.$$eval('#treatmentDiseaseSelect option', o => o.map(x => x.value).filter(Boolean));
  for (const d of td) { await page.selectOption('#treatmentDiseaseSelect', d); await page.waitForTimeout(15); }
  check('percorreu todas as doenças em Tratamento', td.length > 0, td.length);
  await page.click('.tab-btn[data-tab="findings"]');
  const fd = await page.$$eval('#findingsDiseaseSelect option', o => o.map(x => x.value).filter(Boolean));
  for (const d of fd) { await page.selectOption('#findingsDiseaseSelect', d); await page.waitForTimeout(15); }
  check('percorreu todas as doenças em Achados', fd.length > 0, fd.length);
  const cols = await page.evaluate(() => [...new Set([...document.querySelectorAll('#findingsByDiseaseContent table')].map(t => t.querySelectorAll('thead th').length))]);
  check('tabelas de achados têm 3 colunas (sem Contexto)', cols.every(c => c === 3), JSON.stringify(cols));
  await browser.close();
})();
