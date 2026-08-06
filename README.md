# Dados-Reumato-Claude

Dois aplicativos independentes, cada um em **um único arquivo HTML**, que rodam direto no
navegador sem instalação, sem servidor e sem build. Os dados ficam apenas no navegador de quem
usa (`localStorage`); nada é enviado para servidores além das consultas públicas de cotação e de
índices econômicos descritas abaixo.

| Arquivo | O que é |
|---|---|
| `investimentos.html` | Carteira de investimentos: renda variável, renda fixa, proventos, desempenho e planejamento |
| `coleta_dados_reumatologia.html` | Formulário de coleta de dados de pesquisa em reumatologia (adesão ao tratamento) |
| `testes/` | Testes de ponta a ponta do app de investimentos, com as APIs simuladas ([detalhes](testes/README.md)) |

---

# investimentos.html

## Como usar

1. Abra o arquivo no navegador (ou salve na tela inicial do celular).
2. Clique em **➕ Novo investimento** e escolha o que você tem. O seletor cobre ações brasileiras e
   americanas, FIIs, ETFs, BDRs, criptomoedas, CDB/LCI/LCA, Tesouro Direto, fundos, previdência,
   poupança, crédito privado e **conta remunerada** — cada opção abre o formulário certo já
   configurado.
3. Em **Configurações**, cole um token gratuito do [brapi.dev](https://brapi.dev/dashboard) e clique
   em **Atualizar séries** para baixar CDI, IPCA, Ibovespa e IFIX.
4. Em **Desempenho**, use **Reconstruir histórico com preços passados** para recompor a evolução do
   patrimônio desde a primeira compra, em vez de esperar os registros diários se acumularem.
5. Exporte um backup em JSON de tempos em tempos: limpar os dados do navegador apaga tudo.

## Fontes de dados externas

| O quê | Origem | Observações |
|---|---|---|
| Ações, FIIs, ETFs, BDRs, ativos internacionais | brapi.dev `/api/quote` | Consultado em lotes de até 12 tickers, com repetição em caso de limite ou falha de rede |
| Criptomoedas | brapi.dev `/api/v2/crypto` | Sem série histórica: não entram na reconstrução |
| Dólar (USD/BRL) | brapi.dev `/api/v2/currency` | Atualizado junto com as cotações |
| CDI diário (série 12) e IPCA mensal (série 433) | API de dados abertos do Banco Central | Uma taxa por dia útil |
| Ibovespa (`^BVSP`) e IFIX | brapi.dev, histórico de 1 ano | O IFIX é aproximado pelo ETF **XFIX11** |
| Preço unitário do Tesouro Direto | tesourodireto.com.br | Pode ser bloqueado pelo navegador; nesse caso informe o PU manualmente |

Quando qualquer fonte falha, o app continua funcionando: as cotações podem ser digitadas na mão e
a renda fixa cai para as taxas estimadas das Configurações.

## Fórmulas e premissas

### Renda variável

- **Preço médio**: custo total ÷ quantidade. Compras e subscrições somam quantidade e custo
  (incluindo taxas); vendas dão baixa no custo pelo preço médio vigente. Vender mais do que a
  posição da data dispara um aviso, porque costuma indicar lançamento antigo faltando.
- **Lucro realizado** de uma venda: `quantidade × preço − taxas − preço médio × quantidade`.
- **Desdobramento / grupamento**: alteram só a quantidade; o custo total não muda, e o preço médio
  se divide ou se multiplica pelo fator.
- **Bonificação**: entra quantidade com o custo atribuído informado (pode ser zero), diluindo o
  preço médio.
- **Amortização de FII**: devolve capital, então reduz o custo da posição sem mexer na quantidade.
  O que passar do custo vira ganho tributável.
- **Ativos em dólar**: o custo é convertido pelo **câmbio da própria operação**, informado no
  lançamento. Taxas podem ser lançadas em reais ou em dólar.
- **Decomposição do resultado**, com `pm₀` = preço médio em dólar e `fx₀` = câmbio médio de compra:
  - ganho do ativo = `qtd × (preço − pm₀) × fx_atual`
  - efeito câmbio = `qtd × pm₀ × (fx_atual − fx₀)`
  - a soma das duas parcelas é exatamente o lucro total da posição.

### Renda fixa

- **CDI e Selic**: fator acumulado dia útil a dia útil, `∏ (1 + taxa_do_dia × percentual)`, com a
  série real do Banco Central. Sem a série, cai para `(1 + taxa)^(du/252)` com o CDI estimado.
- **Prefixado**: `(1 + taxa)^(du/252)`, com `du` contado pelos dias úteis da própria série.
- **IPCA+**: fator do IPCA acumulado no período × `(1 + spread)^(du/252)`. O IPCA sai com cerca de
  45 dias de atraso, então os meses ainda não divulgados entram pela estimativa das Configurações.
- **Dias úteis (`du`)**: contados pelo calendário real da série do CDI quando ela cobre o período —
  o que respeita feriados — e pela convenção de `dias × 252/365` fora disso. **Nunca dependem do
  tamanho da série**: uma série curta não pode encolher o tempo decorrido.
- **Cobertura parcial**: quando a série do Banco Central começa depois da aplicação, o trecho
  anterior entra pela taxa estimada e o título é marcado como *parcial*, com o método dizendo até
  onde vai o dado oficial. As séries são rebaixadas automaticamente quando um título mais antigo
  que elas é cadastrado.
- **Saldo conferido**: em qualquer título com taxa contratada dá para informar o valor que aparece
  no extrato numa data. Ele vira o novo ponto de partida e, dali em diante, o título volta a render
  pelo próprio indexador — a divergência contra a curva teórica é mostrada e para de se acumular.
- **Aportes e resgates parciais**: cada aporte rende a partir do próprio dia. Um resgate parcial
  retira principal e rendimento na mesma proporção do saldo — retirar `X` de um saldo `S` com
  principal `P` reduz o principal em `P × X/S`. A alíquota de IR continua sendo calculada pelo prazo
  desde a aplicação inicial, o que é uma simplificação.
- **Saldo informado**: o valor digitado é o ponto de partida; a partir da data desse saldo o valor
  pode continuar sendo corrigido pela rentabilidade média observada
  (`(saldo/aplicado)^(365/dias) − 1`), por um índice real, ou por nada.
- **Marcação a mercado**: quando há PU e quantidade de títulos, o valor passa a ser `PU × quantidade`
  e a curva teórica vira apenas referência (ágio/deságio).
- **IOF regressivo** nos 30 primeiros dias, aplicado sobre o rendimento **antes** do IR, pela tabela
  oficial (96% no 1º dia até 3% no 29º).
- **IR regressivo**: 22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima.
- **Previdência privada**: tabela própria — 35% até 2 anos, 30% até 4, 25% até 6, 20% até 8,
  15% até 10 e 10% acima. Na tributação progressiva usa-se 15% retido na fonte.
- **Isentos de IR**: LCI, LCA, CRI/CRA, debêntures e poupança.
- **FGC**: R$ 250 mil por CPF em cada instituição e R$ 1 milhão a cada 4 anos no total, cobrindo
  CDB, RDB, LCI, LCA e poupança. Tesouro, debêntures, CRI/CRA, fundos, previdência e COE ficam fora.
- **Vencimento**: títulos vencidos são baixados automaticamente na data do vencimento, com o valor
  líquido calculado naquele dia. A baixa é reversível. Conta remunerada, poupança, fundos e
  previdência não pedem vencimento.
- **Conta remunerada**: saldo que rende todo dia e pode ser sacado a qualquer momento. Entra como
  uma aplicação com liquidez diária a um percentual do CDI; depósitos e saques são lançados em
  *aportes*, e cada um passa a render (ou deixa de render) a partir do próprio dia. Conta na
  cobertura do FGC e segue a tabela regressiva de IR.

### Desempenho

- **Snapshots**: o patrimônio é registrado uma vez por dia, na abertura do app. Só dias úteis
  alimentam as métricas; fins de semana ficam guardados mas marcados como não úteis.
- **TWR (time-weighted return)**, por intervalo entre dois registros:

  ```
  r = (V₁ − V₀ − F + P) / capital_médio
  ```

  onde `F` é o aporte líquido do intervalo e `P` são os proventos recebidos. O capital médio segue
  o **Modified Dietz**: cada aporte pesa pela fração do intervalo em que ficou aplicado. A TWR do
  período é o produtório de `(1 + r)`, e a anualizada é `(1 + TWR)^(365/dias) − 1`.
- **Retornos com variação implausível** (abaixo de −95% ou acima de +300%) são descartados e
  sinalizados na tela — normalmente indicam cotação errada ou lançamento faltando.
- **XIRR**: taxa que zera o valor presente dos fluxos do investidor (aportes negativos, resgates e
  proventos positivos, patrimônio atual como fluxo final), resolvida por bisseção. Só é exibida a
  partir de 90 dias de histórico, porque em janelas curtas a anualização perde sentido.
- **Volatilidade**: desvio-padrão dos retornos diários × √252.
- **Drawdown**: maior queda percentual em relação ao topo anterior da curva acumulada.
- **Sharpe**: `(retorno anualizado − CDI anualizado) ÷ volatilidade`.
- **Correlação**: coeficiente de Pearson entre os retornos diários dos preços históricos, usando
  apenas as datas com preço para todos os ativos comparados.
- **Reconstrução do histórico**: baixa os preços de fechamento de cada ativo, reconstrói a posição
  em cada dia útil desde o primeiro lançamento e recalcula a renda fixa naquela data. Ativos sem
  série histórica (cripto, por exemplo) são avaliados pelo custo de aquisição, e o dia fica marcado
  como parcial. Registros criados pelo uso normal do app nunca são sobrescritos.

### Imposto de renda sobre renda variável

Apuração **mês a mês**, por categoria, com prejuízo que só compensa lucro da mesma categoria:

| Categoria | Alíquota | Isenção mensal por volume de vendas |
|---|---|---|
| Ações (swing trade) | 15% | R$ 20.000 |
| ETFs e BDRs | 15% | — |
| FIIs | 20% | — |
| Criptomoedas | 15% | R$ 35.000 |
| Ativos no exterior | 15% | R$ 35.000 |
| Day trade | 20% | — |

Day trade é identificado quando há compra e venda do mesmo ativo na mesma data. Prejuízo apurado em
mês isento não é aproveitável, conforme a regra. O imposto do mês vira DARF; abaixo de R$ 10 ele
acumula para o mês seguinte.

Continua sendo **estimativa**: não trata rendimentos no exterior pela Lei 14.754/2023, fundos com
come-cotas, operações a termo e opções, nem separação por corretora.

### Planejamento

- **Bandas**: o rebalanceamento só é sugerido quando `|% atual − % alvo|` passa da banda definida.
- **Sugestão de aporte**: distribui o valor novo proporcionalmente ao déficit de cada classe em
  relação ao alvo recalculado sobre o patrimônio já somado ao aporte — só compra, nunca vende.
- **Projeção**: `μ` é o retorno anualizado real da carteira e `σ` a volatilidade real; os cenários
  pessimista, base e otimista usam `μ − σ`, `μ` e `μ + σ`, com o aporte mensal informado. Sem
  histórico suficiente, cai para 8% a.a. e 12% de volatilidade como referência genérica.

## Estrutura dos dados

Tudo vive em uma única chave do `localStorage` (`investimentos_db`), com versão de schema e
migração automática ao abrir:

```
{ versao, transacoes[], proventos[], rendafixa[], cotacoes{}, ativos{}, precosHist{},
  snapshots[], series{cdi,ipca,ibov,ifix}, metas{}, config{} }
```

| Versão | O que mudou |
|---|---|
| 1 | Formato inicial |
| 2 | Moeda das taxas por lançamento; liquidez na renda fixa |
| 3 | Correção do saldo informado a partir da data de referência |
| 4 | Proventos com situação (recebido/previsto), metas de alocação e preços históricos |

Aportes e resgates parciais de renda fixa, subscrição e amortização de FII entram como campos
opcionais e não exigiram nova versão de schema.

## Limitações conhecidas

- Fundos de investimento não têm come-cotas; previdência e fundos usam aproximações de IR.
- Rendimentos no exterior seguem a regra antiga de ganho de capital, não a Lei 14.754/2023.
- Não há importação do extrato da B3 nem de notas de corretagem.
- Proventos são lançados manualmente.
- Não há separação por corretora nem controle de operações a termo e opções.
- Os dados vivem em um só navegador, sem sincronização entre dispositivos.
