// Quarta leva da familia "o numero e real, mas o sujeito e outro" (ver t11,
// t12 e t13). Aqui a fonte do erro e o ENSAIO CLINICO: nele quase todo
// percentual vem por braco de tratamento, e nenhum deles e a frequencia do
// achado na doenca. Casos vindos da auditoria dos quatro artigos de lupus.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => {
    const les = FINDINGS_INDEX.filter(f => f.diseases.includes('Lúpus Eritematoso Sistêmico'));
    return {
      // "linfopenia em 0%, 3,2% e 0%" / "acometimento renal em 2,9%, 0% e
      // 5,3%": enumeracao por braco. Um achado com frequencia "0%" e sempre
      // sinal de que o numero foi lido do braco errado.
      frequenciaZero: FINDINGS_INDEX.filter(f => /^0(?:[.,]0+)?\s*%$/.test((f.frequencyText || '').trim()))
        .map(f => f.articleId + ':' + f.finding),
      // O ensaio de lupus EXCLUIU nefrite grave; "Acometimento renal: 2,9%"
      // seria a proporcao de um braco, nao a frequencia renal no lupus.
      renalPorBraco: FINDINGS_INDEX.filter(f => f.articleId === 80 && /renal|Nefrite/i.test(f.finding) && f.frequencyText)
        .map(f => f.finding + '=' + f.frequencyText),
      // "no SUBGRUPO COM assinatura de interferon baixa — 18 (82%) de 22":
      // 82% e taxa de resposta dentro do subgrupo, nao frequencia da
      // assinatura (que o proprio artigo da como 63%).
      interferon: les.filter(f => /interferon/i.test(f.finding) && f.frequencyText)
        .map(f => f.articleId + '=' + f.frequencyText),
      // "...e acidente vascular cerebral isquemico) e quatro (10%) de 42 no
      // placebo": o parenteses do achado ja fechou; o 10% e de outra clausula.
      avcParenteses: FINDINGS_INDEX.filter(f => f.articleId === 81 && /AVC|isqu[êe]mico/i.test(f.finding) && f.frequencyText)
        .map(f => f.finding + '=' + f.frequencyText),
      // "Infeccoes oportunistas EXCLUINDO tuberculose e herpes-zoster": o
      // achado esta numa clausula de exclusao.
      hzExcluido: FINDINGS_INDEX.filter(f => f.articleId === 80 && /Herpes/i.test(f.finding) && f.frequencyText)
        .map(f => f.finding + '=' + f.frequencyText),
      // ...mas os guards nao podem apagar numeros corretos. Estes tres casos
      // sao percentuais legitimos que versoes anteriores dos guards mataram:
      // lista de achados distintos, comparacao explicita com "vs.", e duas
      // estimativas do mesmo achado em coortes diferentes.
      listaDeAchados: FINDINGS_INDEX.some(f => f.articleId === 28 && /Meningismo/.test(f.finding) && f.frequencyText === '55%'),
      comparacaoVs: ['Destruição óssea', 'Esclerose óssea de parede de seio']
        .filter(n => FINDINGS_INDEX.some(f => f.articleId === 68 && f.finding === n && f.frequencyText)),
      duasCoortes: FINDINGS_INDEX.some(f => f.articleId === 27 && /sunset glow/i.test(f.finding) && f.frequencyText === '67,5%'),
      // Os quatro artigos de lupus devem ter entrado com o arsenal que descrevem.
      farmacosLupus: ['Telitacicepte', 'Ustequinumabe', 'Upadacitinibe', 'Deucravacitinibe', 'Anifrolumabe', 'Belimumabe', 'Cenerimode', 'Elsubrutinibe']
        .filter(n => MEDICATIONS_INDEX.some(m => m.drug.includes(n) && m.articleId >= 78)),
    };
  });
  check('nenhum achado com frequencia 0%', d.frequenciaZero.length === 0, JSON.stringify(d.frequenciaZero));
  check('acometimento renal sem percentual de braco', d.renalPorBraco.length === 0, JSON.stringify(d.renalPorBraco));
  check('assinatura de interferon sem taxa de resposta de subgrupo', !d.interferon.some(x => /82%/.test(x)), JSON.stringify(d.interferon));
  check('AVC nao herda numero de fora do parenteses', d.avcParenteses.length === 0, JSON.stringify(d.avcParenteses));
  check('achado em clausula de exclusao nao ganha numero', d.hzExcluido.length === 0, JSON.stringify(d.hzExcluido));
  check('lista de achados distintos preservada', d.listaDeAchados, d.listaDeAchados);
  check('primeiro numero de comparacao "vs." preservado (2)', d.comparacaoVs.length === 2, JSON.stringify(d.comparacaoVs));
  check('estimativa de coorte preservada', d.duasCoortes, d.duasCoortes);
  check('arsenal do lupus catalogado (8)', d.farmacosLupus.length === 8, JSON.stringify(d.farmacosLupus));
  await browser.close();
})();
