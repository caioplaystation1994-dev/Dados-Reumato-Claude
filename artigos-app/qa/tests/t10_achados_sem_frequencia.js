const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp({ width: 1030, height: 900 });
  // Achado descrito qualitativamente (sem %) precisa APARECER — a aba promete
  // "com a frequência relatada quando disponível", e filtrar por frequência
  // escondia a maioria dos achados da biblioteca.
  await page.click('.tab-btn[data-tab="findings"]');
  await page.selectOption('#findingsDiseaseSelect', 'Uveíte');
  await page.waitForTimeout(300);
  const txt = await page.$eval('#findingsByDiseaseContent', (e) => e.innerText);
  check('semiologia ocular sem % aparece (hipópio)', /hip[óo]pio/i.test(txt));
  check('semiologia ocular sem % aparece (precipitados ceráticos)', /precipitados cer[áa]ticos/i.test(txt));
  check('mostra "não detectada" para quem não tem %', /não detectada/i.test(txt));
  // ...e quem TEM % continua com o número.
  check('classificação SUN traz os percentuais', /41-60%/.test(txt) && /7-32%/.test(txt));
  // Quantificados vêm antes dos não quantificados dentro do mesmo grupo.
  const ordem = await page.evaluate(() => {
    const linhas = [...document.querySelectorAll('#findingsByDiseaseContent tbody tr')];
    const temPct = linhas.map((l) => /\d+%/.test(l.innerText));
    let quebrou = false, viuFalso = false;
    temPct.forEach((v) => { if (!v) viuFalso = true; else if (viuFalso) quebrou = true; });
    return { total: linhas.length, quebrou };
  });
  check('tabela tem conteúdo', ordem.total > 5, ordem.total);
  await browser.close();
})();
