# caiowandenkolk.com.br — site do Dr. Caio Wandenkolk

Site estático (HTML, CSS e JavaScript puros, sem build nem dependências),
publicado no GitHub Pages em **https://caiowandenkolk.com.br**.

Este arquivo é a memória do projeto: como o site é publicado, por que algumas
decisões foram tomadas e o que ainda está pendente. Quem precisar mexer aqui
daqui a um ano deve conseguir se orientar só por ele.

Ele fica na **raiz do repositório**, fora de `docs/`, de propósito: tudo que
está dentro de `docs/` é publicado no domínio, e este arquivo descreve a tela de
senha das ferramentas internas e o endereço direto da carteira. Não deve ficar
acessível em `caiowandenkolk.com.br/README.md` — era o que acontecia até
novembro de 2026, quando ele ainda morava em `docs/`.

```
docs/
├── index.html                    Página principal — todas as seções
├── links/index.html              Página de links da bio do Instagram
├── 404.html                      Página de erro
├── robots.txt                    Instruções para buscadores
├── sitemap.xml                   Mapa do site
├── CNAME                         Domínio próprio
├── .nojekyll                     Impede o processamento Jekyll
├── app/                          Ferramentas clínicas (ver seção 8)
└── assets/
    ├── css/style.css             Estilos — paleta e tipografia no :root
    ├── css/fonts.css             Os quatro @font-face
    ├── fonts/*.woff2             Fontes hospedadas aqui, não no Google
    ├── js/main.js                Menu, revelação ao rolar, voltar ao topo
    └── img/                      Retratos, capa social e ícones
```

---

## 1. Como o site é publicado — leia antes de mexer

**Todo push na `main` publica no domínio, em poucos minutos.** Não há ambiente
de teste nem etapa de aprovação. O que for enviado vai ao ar.

Tudo vive na `main`:

| Caminho | O que é |
|---|---|
| `docs/` | O site publicado — a raiz do domínio |
| `docs/app/` | As ferramentas servidas, geradas no deploy |
| Raiz do repositório | As ferramentas em desenvolvimento, sem a tela de senha |
| `scripts/publicar-apps.js` | Copia as ferramentas da raiz para `docs/app/` |
| `.github/workflows/pages.yml` | O workflow que monta e publica |

O workflow roda o script, confere o resultado e publica `docs/`. O que vai ao ar
é sempre gerado na hora, a partir da raiz — `docs/app/` no repositório é só uma
cópia de conferência.

### A origem em Settings → Pages precisa ser "GitHub Actions"

Essa configuração não está no código e é o ponto mais frágil de tudo isto.
Se ela voltar para **Deploy from a branch**, o GitHub passa a servir o `docs/`
de uma branch, *ignorando* o workflow — e o site congela no conteúdo daquela
branch sem nenhum erro visível.

Foi o que aconteceu entre 16 e 24 de novembro de 2026: a origem voltou a apontar
para `claude/happy-ride-mp97bp`, uma branch antiga onde o site morava antes da
consolidação de outubro. O domínio passou a servir as ferramentas de setembro —
o portal oferecia um laudo já aposentado e o app de documentos imprimia a data
no rodapé — enquanto a `main` seguia correta. Ninguém reverteu nada; só mudou de
onde o site saía.

**Se o site parecer ter voltado no tempo, confira essa configuração antes de
procurar o erro no código.**

### Três regras que existem por causa de acidentes reais

1. **A raiz do domínio é o site pessoal.** Um push em `main` já derrubou o site
   e colocou o portal de documentos, sem senha, no endereço principal. O
   workflow hoje barra o deploy se `docs/index.html` não for o site pessoal.

2. **Toda ferramenta em `/app/` tem que carregar `gate.js`.** O workflow confere
   arquivo por arquivo e barra o deploy se faltar em algum. Confere também o
   `docs/CNAME`, sem o qual o domínio deixaria de apontar para cá.

3. **Cuidado ao apagar blocos de CSS.** Uma reestruturação do rodapé apagou
   junto os blocos `.levar` e `.heroi__monograma`, e a regressão ficou no ar por
   dias — o site continuava sendo o site, o gate continuava aplicado, e nenhuma
   trava pegou. Não existe verificação automática para isso. Ao mexer em
   `style.css`, confira o diff inteiro, não só o trecho que você queria mudar.

### A branch antiga do site

`claude/happy-ride-mp97bp` ainda existe e carrega uma cópia de `docs/`. Ela é
mantida igual à `main` por segurança, para o caso de a origem do Pages voltar a
apontar para lá. Enquanto as duas existirem, **uma alteração feita só numa delas
pode sumir do ar** dependendo de qual estiver servindo. O certo é mexer sempre
na `main`; quando a origem estiver confirmada em "GitHub Actions", a branch pode
ser apagada.

---

## 2. Domínio e DNS — já configurado

No **Registro.br**, zona do `caiowandenkolk.com.br`:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<usuário>.github.io.` |

Os quatro registros `A` são obrigatórios — o GitHub usa os quatro para
redundância. No Registro.br o ponto final do CNAME é exigido, e é preciso clicar
em **SALVAR ALTERAÇÕES** para a zona ser publicada (uma vez os registros ficaram
preenchidos na tela sem terem sido salvos).

O HTTPS está ativo, com certificado emitido pelo GitHub, e **Enforce HTTPS**
marcado.

O endereço canônico é **sem `www`**. O `www` funciona, mas redireciona — então
sempre divulgue `caiowandenkolk.com.br`, não `www.caiowandenkolk.com.br`, para
não gastar um salto a mais em cada visita.

> Se um dia o domínio canônico virar `www`, atualize junto: `CNAME`,
> `<link rel="canonical">` e `og:url` do `index.html`, `robots.txt` e
> `sitemap.xml`. Os cinco precisam apontar para o mesmo endereço, senão o Google
> indexa versões duplicadas.

---

## 3. Identidade visual

Paleta e tipografia ficam concentradas no `:root` de `assets/css/style.css`,
derivadas do material impresso (cartão, timbrado e receituário). Alterar as
variáveis muda o site inteiro de forma consistente.

```css
--areia:#f7f4ef;   /* fundo geral, do papel timbrado */
--tinta:#242321;   /* títulos */
--ouro:#79602d;    /* textos, links e destaques — escuro o bastante para carregar texto */
--ouro-claro:#dcbd8a; /* molduras e filetes; decorativo, nunca texto */
```

**Tipografia:** *Source Serif 4* nos títulos, *Source Sans 3* no texto e nos
controles, e *Cormorant Garamond* reservada à marca — monograma, nome e
assinatura — preservando a serifa de alto contraste do impresso.

Dois detalhes que não são óbvios:

- **As fontes são hospedadas aqui**, em `assets/fonts/`, e não carregadas do
  Google Fonts. Isso evita que cada visita ao site informe o Google.
- **Só o subconjunto `latin` está incluído** (208 KB no total). Foi verificado
  caractere a caractere que nada no site cai fora dele. Se um dia entrar um
  texto com caractere incomum, ele cairá numa fonte do sistema sem aviso — foi
  o que aconteceu com a seta `→`, que acabou substituída por um SVG.

A moldura dupla (borda externa dourada + filete interno claro) é o motivo visual
recorrente, vindo do impresso. Aparece no monograma, nos retratos, no mapa, nos
ícones dos cartões e no botão de voltar ao topo.

---

## 4. Sair do modo "em construção" — PENDENTE

O site está com a indexação **bloqueada de propósito**. Enquanto isso vale:

- ele continua acessível por link direto — o bloqueio impede a indexação, não o
  acesso;
- não aparece em nenhuma busca do Google, Bing ou similares.

Para lançar, faça as duas alterações **juntas**:

1. Em `index.html`, troque
   `<meta name="robots" content="noindex, nofollow">` por
   `<meta name="robots" content="index, follow">` e remova o bloco de comentário
   acima dela.
2. Em `robots.txt`, substitua todo o conteúdo pelo que está indicado dentro do
   próprio arquivo — mantendo o `Disallow: /app/`.

**Não mexa no `noindex` de `links/index.html`.** O dele é permanente e
intencional: aquela página não deve disputar as buscas com a página principal.
Ela leva `noindex, follow`, que continua transmitindo autoridade para o site.

---

## 5. Google — PENDENTE

### Search Console

Depois de remover o bloqueio, registrar o site em
[Search Console](https://search.google.com/search-console), provar a posse do
domínio e enviar `https://caiowandenkolk.com.br/sitemap.xml`.

Expectativa realista: um site institucional novo não disputa buscas genéricas
como "reumatologista São Paulo", dominadas por portais de agendamento. Ele
aparece bem é para quem busca **o nome**, e aí é determinante que seja o
primeiro resultado, acima dos agregadores.

### Perfil da Empresa no Google

É o que gera a estrela, o painel lateral e o link de avaliação. É separado do
site e gratuito. Os dados precisam bater **exatamente** com os do site e com o
JSON-LD do `index.html`:

| Campo | Valor |
|---|---|
| Nome | `Dr. Caio Wandenkolk` |
| Categoria principal | `Reumatologista` |
| Endereço | `Av. Paulista, 1048 — 18º andar, Bela Vista, São Paulo/SP, 01310-100` |
| Telefone | `(11) 3382-1525` |
| Site | `https://caiowandenkolk.com.br` |
| Horário | Terça 14h–20h; quinta 15h–20h |

**Duas armadilhas:**

1. **O nome do perfil é só "Dr. Caio Wandenkolk".** Acrescentar especialidade,
   bairro ou palavra-chave ao nome viola as diretrizes do Google e é uma das
   causas mais comuns de suspensão de perfil médico. A especialidade vai no
   campo Categoria. Muita agência recomenda o contrário — está errado.

2. **A verificação por vídeo é o ponto difícil**, porque a sinalização do prédio
   diz "Clinovi", não o nome do médico, e o Google exige ver sinalização
   permanente com o nome do negócio. Mitigam: nome no diretório do prédio ou na
   porta do consultório, carteira do CRM em close, receituário timbrado, acesso
   a áreas restritas. O vídeo tem que ser um take contínuo e sem edição.

Antes de criar, alinhar com a Clinovi: eles provavelmente já têm perfil próprio
no mesmo endereço (o que é previsto e permitido), podem já ter criado um em nome
do médico — duplicata gera suspensão — e a recepção pode receber a ligação de
verificação.

---

## 6. Instagram

Perfil: [@drcaiowandenkolk](https://www.instagram.com/drcaiowandenkolk/).

Vinculado em dois lugares no site: o cartão em `links/index.html` (com
`rel="me"`, que declara formalmente a reciprocidade do perfil) e o `sameAs` do
JSON-LD em `index.html`, que é o que faz o Google tratar site e perfil como a
mesma entidade. Esse vínculo só passa a valer quando o `noindex` sair.

O campo **Site** da bio deve apontar para `caiowandenkolk.com.br/links`,
**sem o `www`**.

A bio precisa trazer **CRM-SP 197983** e **RQE 139762** — o CFM exige
identificação em qualquer meio de divulgação, incluindo redes sociais, e o
CRM-SP fiscaliza Instagram. O campo *Nome* (não a bio) é o único indexado pela
busca do Instagram, por isso "Reumatologista" fica lá.

---

## 7. Conformidade com o CFM

A publicidade médica é regulada pela Resolução CFM nº 1.974/2011 e pelo Código
de Ética Médica.

- **Obrigatório:** nome, especialidade e CRM (com RQE) visíveis em todo
  material — site, página de links e redes sociais.
- **Vedado:** divulgar preços, descontos ou condições de pagamento.
- **Vedado:** fotos de "antes e depois", depoimentos de pacientes e imagens que
  sugiram resultado garantido.
- **Vedado:** garantir resultados, prometer cura ou alegar superioridade sobre
  colegas.
- **Recomendado:** tom informativo e educativo, sem autopromoção sensacionalista.

### Duas ressalvas específicas sobre avaliações

**Não trazer avaliações para dentro do site.** Avaliações vivendo no Google são
uma plataforma de terceiro, fora do controle editorial do médico — situação
diferente e amplamente praticada. Embutir depoimentos em
`caiowandenkolk.com.br` transforma o conteúdo em material publicitário próprio,
que é exatamente o que a resolução veda. **Não construir bloco de depoimentos**
sem parecer do CRM-SP.

**Ao responder uma avaliação no Google, não confirmar que a pessoa é paciente**
nem mencionar qualquer informação clínica. A resposta é pública: "foi um prazer
te acompanhar no tratamento" já é quebra de sigilo. A resposta segura é curta e
genérica — *"Agradeço o retorno."*

Pedir ativamente avaliações é zona cinzenta (pode configurar captação de
clientela). Confirmar com o CRM-SP antes de montar qualquer rotina.

---

## 8. Ferramentas clínicas (`docs/app/`)

Uso interno, publicadas junto ao site:

| Endereço | Ferramenta |
|---|---|
| `/app/` | Portal com o menu das ferramentas |
| `/app/documentos_ambulatorio.html` | Relatório, receitas, exames, vacinas, atestado |
| `/app/laudo_imunobiologicos.html` | Laudo de imunobiológicos (DUT 65/ANS) |
| `/app/investimentos.html` | Carteira — não linkada no portal, só pelo endereço direto |

Não são indexadas: cada arquivo tem `noindex` e o `robots.txt` bloqueia `/app/`.

### Acesso por senha

Todas passam por uma tela de senha (`docs/app/gate.js`), que guarda apenas o
hash SHA-256 — nunca a senha. O acesso vale 12 horas por navegador.

Para trocar: entre em `/app/`, use **"Gerar hash de uma nova senha"** no rodapé,
cole o valor em `HASH_SENHA` dentro de `docs/app/gate.js` e publique.

É uma porta, não um cofre: como o site é estático, quem abrir o código-fonte vê
o conteúdo sem digitar a senha. Ela impede o uso casual por quem esbarre no
endereço. Isso é proporcional ao risco, porque **nenhum dado de paciente é
publicado** — o que se preenche fica só no navegador (localStorage) e nunca é
enviado ao servidor. Para proteção real seria preciso trocar de hospedagem
(Cloudflare Access, Netlify com senha).

### Atualizar as ferramentas

Desenvolvidas na raiz do repositório, sem a tela de senha. Um push em `main`
dispara o workflow, que as republica em `/app/` com `noindex` e o gate
injetados, sem tocar na raiz do site.

O laudo para convênio foi aposentado em outubro de 2026: era uma cópia de junho
do mesmo gerador, parada desde então. O que ela tinha de próprio — o cálculo do
ASDAS, a função pulmonar nas demais doenças e a duração do tratamento — foi
levado para o laudo principal antes de a cópia sair do ar.

---

## 9. Pendências em aberto

- [ ] Alinhar com a Clinovi sobre o Perfil da Empresa no mesmo endereço (seção 5)
- [ ] Remover o bloqueio de indexação (seção 4)
- [ ] Registrar no Search Console e enviar o sitemap (seção 5)
- [ ] Criar e verificar o Perfil da Empresa no Google (seção 5)
- [ ] Tirar o `www` do link da bio do Instagram (seção 6)
- [ ] Confirmar com o CRM-SP antes de qualquer rotina de pedir avaliações (seção 7)

### Ideias avaliadas e não aplicadas

Ficam registradas para não serem rediscutidas do zero:

- **Verificação de integridade no workflow** — dois testes estáticos antes do
  deploy: toda classe usada no HTML tem regra no CSS, e todo `href`/`src` local
  aponta para arquivo existente. Teria pegado a regressão do rodapé no commit
  que a causou. Proposto e adiado.
- **Carregar o mapa do Google só ao clicar** — hoje o `iframe` contata o Google
  em toda visita, o que é incoerente com ter hospedado as fontes localmente por
  privacidade. Não aplicado.
- **Agrupar os nove cartões de "Quando procurar"** por natureza (investigação /
  doenças / serviços). Não aplicado.
- **Fotos da clínica** vindas de `clinovi.com.br` para a seção de localização.
  Dependem de autorização da Clinovi e dos arquivos originais.
