// Sexta leva da família "o dado é real, mas está pendurado no lugar errado".
// Aqui o que se atribui errado não é o número — é a DOENÇA: numa seção de
// diagnóstico diferencial o texto descreve as OUTRAS doenças em blocos, e
// tudo caía na doença do artigo. Casos vindos da auditoria do artigo de
// PFAPA, que dedica uma seção inteira a TRAPS, MKD e CAPS.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => {
    const dif84 = FINDINGS_INDEX.filter(f => f.articleId === 84 && /Diferenciais das Demais/.test(f.heading || ''));
    return {
      // Edema periorbitário, conjuntivite e pericardite são da TRAPS;
      // esplenomegalia e diarreia, da MKD; surdez neurossensorial, da CAPS.
      // Nenhum deles é manifestação da síndrome PFAPA.
      trapsNaPfapa: dif84.filter(f => /Edema palpebral|Conjuntivite|Pericardite/.test(f.finding) && f.diseases.includes('Síndrome PFAPA'))
        .map(f => f.finding),
      mkdNaPfapa: dif84.filter(f => /Esplenomegalia|Diarreia/.test(f.finding) && f.diseases.includes('Síndrome PFAPA'))
        .map(f => f.finding),
      capsNaPfapa: dif84.filter(f => /Surdez/.test(f.finding) && f.diseases.includes('Síndrome PFAPA')).map(f => f.finding),
      // A seção precisa ter sido reconhecida como de diferencial — o
      // categorizador não casava o plural "Diferenciais". Se não fosse
      // reconhecida, os adjetivos de frequência daquelas doenças virariam
      // frequência da PFAPA.
      freqNaSecaoDif: dif84.filter(f => f.frequencyText && !/\d/.test(f.frequencyText)).map(f => f.finding + '=' + f.frequencyText),
      // ...mas a reatribuição tem três limites que precisam continuar valendo.
      // 1) menção negada não rege o bloco: "diagnóstico de GPA (NÃO EGPA):
      //    destruição óssea em 45%" — o número é da GPA.
      negada: FINDINGS_INDEX.some(f => f.articleId === 68 && /Destruição óssea/.test(f.finding) &&
        f.diseases.includes('Granulomatose com Poliangiite')),
      // 2) menção após "vs." é comparador: "52% (vs. 23% na EGPA)" segue GPA.
      comparador: FINDINGS_INDEX.some(f => f.articleId === 68 && /Esclerose óssea/.test(f.finding) &&
        f.diseases.includes('Granulomatose com Poliangiite')),
      // 3) achado que ABRE a frase é sujeito dela: "A dactilite exige
      //    diferenciar de artrite reativa" não pode virar artrite reumatoide.
      abreFrase: FINDINGS_INDEX.some(f => f.articleId === 74 && /Dactilite/.test(f.finding) && f.diseases.includes('Gota')),
      // A reatribuição correta que motivou tudo isso.
      psoriasica: FINDINGS_INDEX.some(f => f.articleId === 75 && /Artrite monoarticular/.test(f.finding) &&
        f.diseases.includes('Artrite Psoriásica')),
      // Semiologia da PFAPA propriamente dita, com os números do artigo.
      pfapa: [
        FINDINGS_INDEX.some(f => f.articleId === 84 && f.finding === 'Aftose oral' && f.frequencyText === '50%'),
        FINDINGS_INDEX.some(f => f.articleId === 84 && f.finding === 'Faringite' && f.frequencyText === '70 a 90%'),
        FINDINGS_INDEX.some(f => f.articleId === 84 && f.finding === 'Neutropenia cíclica'),
      ].filter(Boolean).length,
    };
  });
  check('achados da TRAPS nao caem na PFAPA', d.trapsNaPfapa.length === 0, JSON.stringify(d.trapsNaPfapa));
  check('achados da MKD nao caem na PFAPA', d.mkdNaPfapa.length === 0, JSON.stringify(d.mkdNaPfapa));
  check('achados da CAPS nao caem na PFAPA', d.capsNaPfapa.length === 0, JSON.stringify(d.capsNaPfapa));
  check('secao "Diferenciais" reconhecida (sem frequencia em palavra)', d.freqNaSecaoDif.length === 0, JSON.stringify(d.freqNaSecaoDif));
  check('mencao negada nao rege o bloco', d.negada, d.negada);
  check('mencao apos "vs." nao rege o bloco', d.comparador, d.comparador);
  check('achado que abre a frase nao herda doenca anterior', d.abreFrase, d.abreFrase);
  check('reatribuicao correta para artrite psoriasica', d.psoriasica, d.psoriasica);
  check('semiologia da PFAPA catalogada (3)', d.pfapa === 3, d.pfapa);
  await browser.close();
})();
