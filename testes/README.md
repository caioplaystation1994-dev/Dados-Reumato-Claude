# Testes

Testes de ponta a ponta do `investimentos.html`, rodando o arquivo real em um Chromium sem
interface. **Todas as chamadas externas são simuladas** (brapi.dev, Banco Central e Tesouro
Direto), então as suítes não dependem de rede nem de token e produzem sempre o mesmo resultado.

## Como rodar

```bash
cd testes
npm install
npx playwright install chromium   # só na primeira vez
npm test
```

Para rodar uma suíte isolada:

```bash
node 07-imposto-e-aportes.mjs
```

Cada suíte imprime uma linha por verificação e sai com código diferente de zero se alguma falhar.

## O que cada suíte cobre

| Arquivo | Cobertura |
|---|---|
| `01-carteira-e-eventos.mjs` | Preço médio, desdobramento, grupamento, bonificação, taxas em dólar, efeito câmbio, renda fixa com CDI real, IOF, marcação a mercado, carência, FGC, TWR |
| `02-interface-e-cotacoes.mjs` | Navegação entre abas, consistência das tabelas, formulários, atualização de cotações, layout em desktop e celular |
| `03-graficos-em-tela-estreita.mjs` | Adaptação do viewBox dos gráficos em telas pequenas |
| `04-investimento-ja-existente.mjs` | Cadastro pelo saldo informado nos três modos de entrada, validações e atualização do saldo |
| `05-correcao-do-saldo.mjs` | Correção diária do saldo informado pela média observada e por índice real, casos de borda e migração de schema |
| `06-risco-e-planejamento.mjs` | Reconstrução do histórico, Modified Dietz, XIRR, volatilidade, drawdown, correlação, metas, rebalanceamento, projeção e memoização |
| `07-imposto-e-aportes.mjs` | Lotes e repetição nas cotações, subscrição, amortização de FII, aportes e resgates parciais, apuração mensal de IR com isenções, compensação e DARF |
| `08-cobertura-e-conferencia.mjs` | Regressão do erro em que uma série curta do Banco Central encolhia o tempo decorrido, rebaixamento automático das séries e conferência de saldo com a taxa contratada preservada |

## Escrevendo uma suíte nova

`navegador.mjs` exporta os utilitários comuns: `abrirNavegador()`, o caminho `APP` para o arquivo
do app, `CABECALHO_JSON` para as respostas simuladas e `criarContador()` para o placar de
verificações. O padrão é injetar o estado inicial via `addInitScript` gravando em `localStorage`,
interceptar as APIs com `page.route` e depois inspecionar o resultado chamando as próprias funções
do app dentro de `page.evaluate`.
