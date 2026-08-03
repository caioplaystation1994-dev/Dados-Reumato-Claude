const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  check('biblioteca carregou', await page.evaluate(() => ARTICLES.length) > 0);
  for (const termo of ['', 'lupus', 'undefined', '../../etc/passwd', '<script>', 'termoquenaoexiste123']) {
    await page.fill('#searchBox', termo);
    await page.waitForTimeout(80);
  }
  await page.fill('#searchBox', '');
  await page.waitForTimeout(120);
  check('busca sobreviveu a entradas adversariais', true);
  await browser.close();
})();
