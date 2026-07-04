# Organizador de Artigos Científicos

Aplicativo para organizar artigos científicos (PDF) por doença/tema e fazer perguntas cujas respostas são geradas a partir do conteúdo dos artigos cadastrados.

## Duas versões

- **`organizador_artigos.html`** (na raiz do repositório): arquivo único, sem servidor. Basta abrir no navegador (duplo-clique). Biblioteca 100% embutida no arquivo; a aba Perguntas pede sua própria chave de API da Anthropic (fica salva só no seu navegador) e chama a API direto do seu computador. **Esta é a forma recomendada de uso pessoal.** Gerado a partir do banco de dados com `node server/scripts/export-html.js` (rodar de novo sempre que novos artigos forem classificados).
- **App completo (esta pasta, `artigos-app/`)**: servidor Node/Express, usado internamente pelo Claude Code para ingerir e classificar os artigos (scripts abaixo) e como fonte de dados para gerar o HTML acima. Também pode ser rodado localmente como site normal, se preferir.

## Como funciona

1. **Classificação**: feita manualmente pelo Claude Code (veja a seção abaixo) — não usa a API da Anthropic. Você anexa os PDFs em uma conversa com o Claude Code, ele lê, identifica título, autores, ano, doença/condição, tópicos e um resumo, e grava tudo direto no banco de dados, criando uma nova versão do app (commit + push).
2. **Biblioteca**: lista de todos os artigos, com busca e filtro por doença/tema. Artigos enviados pela aba Upload mas ainda não classificados aparecem como "Aguardando classificação".
3. **Perguntas**: dentro do app, você digita uma pergunta em linguagem natural; o app busca os artigos mais relevantes (busca full-text) e usa a API da Anthropic para responder com base apenas nesses trechos, citando os artigos usados. **Esta é a única parte que usa `ANTHROPIC_API_KEY`.**

Todos os dados (metadados, texto extraído) ficam em um banco SQLite (`data/artigos.db`) e os PDFs originais em `uploads/` — ambos versionados no git, já que fazem parte do conteúdo "publicado" do app.

## Como adicionar e classificar artigos

Duas formas de entrada:

- **Pela aba Upload do app**: extrai o texto do PDF e salva com status "pendente" (sem IA nenhuma envolvida). Fica esperando classificação manual.
- **Direto pelo Claude Code**: anexe o(s) PDF(s) numa conversa e peça para adicionar/classificar. Nos bastidores, isso roda:
  ```bash
  node server/scripts/add-article.js <caminho-do-pdf> ["nome original"]
  # retorna o id do artigo criado (status "pendente")

  node server/scripts/classify.js --id <id> --json '{"title":"...","authors":"...","year":"2023","disease":"...","topics":"a, b, c","summary":"..."}'
  # marca o artigo como "concluido" com os dados fornecidos
  ```
  Depois disso, o Claude Code roda `node server/scripts/export-html.js` para regerar o `organizador_artigos.html` e comita e envia (`git push`) a nova versão (banco + PDFs + HTML) para a branch do projeto.

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha sua chave da API da Anthropic (necessária só para a aba Perguntas):
   ```bash
   cp .env.example .env
   ```
   Você precisa de uma chave em https://console.anthropic.com/ (variável `ANTHROPIC_API_KEY`).
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Acesse `http://localhost:3000` no navegador.

## Estrutura

```
server/
  index.js        servidor Express
  db.js           SQLite + índice full-text (FTS5)
  claude.js       chamadas à API da Anthropic (só perguntas)
  routes/
    articles.js   upload (extração de texto, sem IA), listagem, detalhe, download e exclusão
    ask.js         endpoint de perguntas e respostas
  scripts/
    add-article.js  ingestão manual de um PDF (uso interno do Claude Code)
    classify.js     aplica a classificação manual a um artigo (uso interno do Claude Code)
    export-html.js  gera organizador_artigos.html a partir do banco de dados
public/
  index.html, app.js, style.css   frontend do app com servidor (sem build step)
data/             banco SQLite (versionado no git)
uploads/          PDFs enviados (versionado no git)
../organizador_artigos.html   arquivo único gerado (na raiz do repositório)
```

## Limitações conhecidas

- PDFs que são apenas imagens escaneadas (sem camada de texto/OCR) não têm texto extraível; o artigo fica marcado com erro.
- A busca usada para selecionar artigos relevantes para perguntas é full-text (palavras-chave), não busca semântica por embeddings — funciona bem para a maioria dos casos, mas pode não encontrar artigos que usam sinônimos muito diferentes da pergunta.
- Classificar um artigo exige uma sessão com o Claude Code — não é instantâneo como seria com a API automática.
- No `organizador_artigos.html`, a chave de API fica salva em texto simples no localStorage do navegador — segura o suficiente para uso pessoal no seu próprio computador, mas não compartilhe esse arquivo com outras pessoas depois de salvar a chave nele (a chave não viaja com o arquivo, só fica no navegador onde foi salva, mas evite deixar o computador destravado com o dev tools acessível a terceiros).
- O `organizador_artigos.html` não inclui os PDFs originais (só texto e metadados) para manter o arquivo leve; para abrir o PDF original, use os arquivos em `uploads/` no repositório.
