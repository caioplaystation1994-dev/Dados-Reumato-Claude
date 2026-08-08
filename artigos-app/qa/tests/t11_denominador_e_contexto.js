// Regressoes das quatro inversoes descobertas na auditoria dos artigos de
// gota. Todas sao da mesma familia: um numero (ou adjetivo de frequencia)
// REAL do texto, atribuido ao termo errado da frase.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => {
    const gota = FINDINGS_INDEX.filter(f => f.diseases.includes('Gota'));
    return {
      // "25% DAS PESSOAS COM HIPERURICEMIA tem deposicao de cristais": a
      // hiperuricemia e o denominador. Na gota ela esta em praticamente
      // todos — nunca em 25%.
      hiperuricemiaPct: gota.filter(f => /Hiperuricemia/i.test(f.finding) && f.frequencyText).map(f => f.frequencyText),
      // "a hiperuricemia acomete mais de 20% dos homens NA POPULACAO GERAL":
      // prevalencia populacional, nao frequencia na coorte da doenca.
      // Cuidado ao afiar este teste: "meningite (6%) ... mais frequentes que
      // a prevalencia esperada NA POPULACAO GERAL" tem as duas coisas na
      // mesma frase, mas ali o 6% e a taxa na coorte e a populacao geral e so
      // o termo de comparacao — nao e erro. O erro e o numero ser DA
      // populacao geral, como em "a hiperuricemia acomete mais de 20% dos
      // homens e 4% das mulheres na populacao geral". A forma reconhecivel e
      // o "na populacao geral" fechar a mesma clausula do numero.
      popGeral: FINDINGS_INDEX.filter((f) => {
        if (!f.frequencyText) return false;
        const i = (f.snippet || '').indexOf(f.frequencyText);
        if (i === -1) return false;
        return /^[^.;—–]{0,60}na\s+popula[çc][ãa]o\s+geral/i.test(f.snippet.slice(i + f.frequencyText.length));
      }).map(f => f.finding + '=' + f.frequencyText),
      // "achado COMUM DA GOTA AVANCADA": o "comum" e do dano articular.
      gotaAvancadaPalavra: gota.filter(f => /Gota avan/i.test(f.finding)).map(f => f.finding + '=' + f.frequencyText),
      // Secao de diagnostico diferencial: adjetivo solto caracteriza a
      // doenca COMPARADA, nao a do artigo.
      palavraEmDiferencial: FINDINGS_INDEX.filter(f =>
        /diferencial/i.test(f.heading || '') && f.frequencyText && !/\d/.test(f.frequencyText)).map(f => f.finding),
      // "taxas CRESCENTES de sindrome metabolica" nao e crescente glomerular:
      // o alias so vale com contexto renal na frase.
      crescentesSemRim: FINDINGS_INDEX.filter(f => /Crescentes/i.test(f.finding) &&
        !/glom[ée]rul|renal|rim|rins|bi[óo]psia|nefrite|nefropat|mesangial|MEST|IgA|ANCA|protein[úu]ria|hemat[úu]ria/i.test(f.snippet || '')).map(f => f.articleId + ':' + f.snippet.slice(0, 60)),
      // O que os artigos de gota DEVEM ter: a doenca avancada em 15% e a
      // semiologia de imagem que so o Seminar da Lancet descreve.
      gotaAvancada15: gota.some(f => /Gota avan/i.test(f.finding) && f.frequencyText === '15%'),
      imagemGota: ['Sinal do duplo contorno', 'Sinal da nevasca', 'Erosão em saca-bocado', 'TC de dupla energia']
        .filter(t => gota.some(f => f.finding.includes(t))),
    };
  });
  check('hiperuricemia nao carrega percentual de outra coorte', d.hiperuricemiaPct.length === 0, JSON.stringify(d.hiperuricemiaPct));
  check('nenhum numero de populacao geral vira frequencia', d.popGeral.length === 0, JSON.stringify(d.popGeral));
  check('"gota avancada" nao herda adjetivo de outro achado', d.gotaAvancadaPalavra.every(x => !/=comum|=frequente/.test(x)), JSON.stringify(d.gotaAvancadaPalavra));
  check('secao de diferencial nao gera frequencia em palavra', d.palavraEmDiferencial.length === 0, JSON.stringify(d.palavraEmDiferencial));
  check('crescentes so aparecem em contexto renal', d.crescentesSemRim.length === 0, JSON.stringify(d.crescentesSemRim));
  check('gota avancada catalogada com 15%', d.gotaAvancada15, d.gotaAvancada15);
  check('semiologia de imagem da gota presente (4 achados)', d.imagemGota.length === 4, JSON.stringify(d.imagemGota));
  await browser.close();
})();
