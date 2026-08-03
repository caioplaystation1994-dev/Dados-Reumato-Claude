const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const ids = await page.evaluate(() => ARTICLES.map(a => a.id));
  for (const id of ids) { await page.evaluate((i) => openModal(i), id); await page.waitForTimeout(12); }
  check('abriu o modal de todos os artigos', ids.length > 0, ids.length);
  // artigo totalmente nulo não pode quebrar nem exibir "null"
  await page.evaluate(() => {
    ARTICLES.push({ id: 999999, title: null, original_name: 'sem_classificar.pdf', disease: null,
      summary: null, detailed_summary: null, full_text: null, status: 'pendente', has_pdf: false });
    openModal(999999);
  });
  await page.waitForTimeout(150);
  const txt = await page.$eval('#modalBody', e => e.innerText);
  check('modal de artigo nulo não imprime "null"', !/\bnull\b/.test(txt));
  await browser.close();
})();
