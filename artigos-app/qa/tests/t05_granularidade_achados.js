const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  // Lateralidade: lado direito e esquerdo são achados distintos, não se sobrescrevem.
  const sub = await page.evaluate(() => FINDINGS_INDEX.filter(f => /subcl[áa]via/i.test(f.finding))
    .map(f => f.finding + ' = ' + (f.frequencyText || '—')));
  check('aneurisma de subclávia distingue lateralidade', sub.some(s => /lado direito|lado esquerdo/i.test(s)), JSON.stringify(sub));
  // Subtipos que não podem colapsar num rótulo genérico.
  const nomes = await page.evaluate(() => FINDINGS_INDEX.map(f => f.finding));
  check('micronódulos separados de nódulos/massas', nomes.includes('Micronódulos pulmonares (padrão perilinfático)') && nomes.includes('Nódulos/massas pulmonares'));
  check('GN membranosa separada da genérica', nomes.includes('Glomerulonefrite membranosa'));
  await browser.close();
})();
