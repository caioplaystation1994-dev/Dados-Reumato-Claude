// Oitava leva de "o número é real, mas o sujeito é outro" (ver t11 a t17).
// Três formas novas, todas da auditoria dos artigos de ANA, glomerulonefrite
// e SHU/PTT: valor introduzido pelo lado ERRADO de uma enumeração "N% ... com
// X e M% ... com Y" (o número correto vem ANTES do achado, não depois);
// ausência expressa por verbo ("não ocorre em") em vez de adjetivo; e o
// segundo extremo de uma faixa "de X% em A a Y% em B".
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => ({
    // "positivo em 95% dos pacientes com faringite E 80% dos COM infecção de
    // pele": 80% é da infecção de pele, não da faringite.
    faringite80: FINDINGS_INDEX.filter(f => f.articleId === 91 && f.finding === 'Faringite' && f.frequencyText === '80%'),
    // "a diarreia sanguinolenta ... NÃO OCORRE em 30 a 40% dos pacientes":
    // o número mede a ausência.
    diarreiaAusencia: FINDINGS_INDEX.filter(f => f.articleId === 92 && f.finding === 'Diarreia sanguinolenta' && f.frequencyText)
      .map(f => f.frequencyText),
    // "variou entre 2 e 87% para anticardiolipina E entre 14 e 100% PARA
    // anti-beta-2-glicoproteína": 100% é da beta-2-glicoproteína.
    anticardiolipina100: FINDINGS_INDEX.filter(f => f.articleId === 90 && f.finding === 'Anticardiolipina' && f.frequencyText === '100%'),
    // "de quase 60% em hipertensão maligna A MENOS DE 10% em SHU induzida
    // por droga": 10% é do outro extremo da faixa.
    htMaligna10: FINDINGS_INDEX.filter(f => f.articleId === 92 && f.finding === 'Hipertensão maligna' && f.frequencyText === '10%'),
    // "hemorragia PULMONAR" (sinônimo textual de "hemorragia alveolar" no
    // artigo de GN) precisa ser reconhecida pelo dicionário.
    hemorragiaPulmonar: FINDINGS_INDEX.some(f => f.articleId === 91 && f.finding === 'Hemorragia alveolar' && f.frequencyText === '60%'),
    // ...mas o guard não pode matar construções comuns que apenas fecham a
    // própria cláusula: "X% DOS PACIENTES," (sem "com" depois) e "X% DOS
    // CASOS DE Y" são o denominador do PRÓPRIO achado, não um novo item.
    faringitePfapa: FINDINGS_INDEX.some(f => f.articleId === 84 && f.finding === 'Faringite' && f.frequencyText === '70 a 90%'),
    meningeoGpa: FINDINGS_INDEX.some(f => f.articleId === 69 && f.finding === 'Acometimento meníngeo' && f.frequencyText === '75%'),
    // As quatro doenças/achados-chave desta rodada devem estar catalogados.
    anaEspecificos: ['Anti-Sm/RNP', 'Anti-Ro52', 'Anti-histonas', 'Anti-Ku', 'Anti-proteína P ribossomal']
      .filter(n => FINDINGS_INDEX.some(f => f.finding === n && f.articleId >= 89)),
  }));
  check('faringite nao herda o numero da infeccao de pele', d.faringite80.length === 0, JSON.stringify(d.faringite80));
  check('diarreia sanguinolenta nao herda numero da sua ausencia', d.diarreiaAusencia.length === 0, JSON.stringify(d.diarreiaAusencia));
  check('anticardiolipina nao herda o numero da beta-2-glicoproteina', d.anticardiolipina100.length === 0, JSON.stringify(d.anticardiolipina100));
  check('hipertensao maligna nao herda o outro extremo da faixa', d.htMaligna10.length === 0, JSON.stringify(d.htMaligna10));
  check('hemorragia pulmonar reconhecida como hemorragia alveolar', d.hemorragiaPulmonar, d.hemorragiaPulmonar);
  check('"X% dos pacientes," sem "com" preservado', d.faringitePfapa, d.faringitePfapa);
  check('"X% dos casos de Y" preservado', d.meningeoGpa, d.meningeoGpa);
  check('painel de autoanticorpos ANA-especificos catalogado (5)', d.anaEspecificos.length === 5, JSON.stringify(d.anaEspecificos));
  await browser.close();
})();
