# Organizador de Artigos Científicos

Aplicativo para fazer upload de artigos científicos (PDF), classificá-los automaticamente por doença/tema usando a IA da Anthropic (Claude), e fazer perguntas cujas respostas são geradas a partir do conteúdo dos artigos cadastrados.

## Como funciona

1. **Upload**: você envia um PDF. O texto é extraído e enviado para o Claude, que identifica título, autores, ano, doença/condição principal, tópicos e um resumo.
2. **Biblioteca**: lista de todos os artigos, com busca e filtro por doença/tema.
3. **Perguntas**: você digita uma pergunta em linguagem natural; o app busca os artigos mais relevantes (busca full-text) e pede ao Claude para responder com base apenas nesses trechos, citando os artigos usados.

Todos os dados (metadados, texto extraído) ficam em um banco SQLite local (`data/artigos.db`) e os PDFs originais em `uploads/`.

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha sua chave da API da Anthropic:
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
  claude.js       chamadas à API da Anthropic (classificação e perguntas)
  routes/
    articles.js   upload, listagem, detalhe, download e exclusão de artigos
    ask.js         endpoint de perguntas e respostas
public/
  index.html, app.js, style.css   frontend (sem build step)
data/             banco SQLite (não versionado)
uploads/          PDFs enviados (não versionado)
```

## Limitações conhecidas

- PDFs que são apenas imagens escaneadas (sem camada de texto/OCR) não têm texto extraível; o artigo fica marcado com erro.
- A busca usada para selecionar artigos relevantes para perguntas é full-text (palavras-chave), não busca semântica por embeddings — funciona bem para a maioria dos casos, mas pode não encontrar artigos que usam sinônimos muito diferentes da pergunta.
