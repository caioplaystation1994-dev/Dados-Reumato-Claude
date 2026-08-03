const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const comTabela = await page.evaluate(() => {
    const a = ARTICLES.find(x => { try { return (JSON.parse(x.extracted_tables || '[]')).length > 0; } catch (e) { return false; } });
    return a ? a.id : null;
  });
  check('existe artigo com tabela extraída', comTabela !== null, comTabela);
  if (comTabela) {
    await page.evaluate((i) => openModal(i), comTabela);
    await page.waitForTimeout(200);
    const btn = await page.$('#toggleExtractedTables');
    check('botão de tabelas aparece', !!btn);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(150);
      const n = await page.$$eval('#extractedTablesSection table.extracted-table', e => e.length);
      check('tabelas renderizam', n > 0, n);
      const aviso = await page.$eval('#extractedTablesSection', e => e.innerText);
      check('traz aviso de extração automática', /extraídas automaticamente/i.test(aviso));
    }
  }
  const semTabela = await page.evaluate(() => {
    const a = ARTICLES.find(x => { try { return (JSON.parse(x.extracted_tables || '[]')).length === 0; } catch (e) { return true; } });
    return a ? a.id : null;
  });
  if (semTabela) {
    await page.evaluate((i) => openModal(i), semTabela);
    await page.waitForTimeout(150);
    check('sem tabela → sem botão', !(await page.$('#toggleExtractedTables')));
  }
  await browser.close();
})();
