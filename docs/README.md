# Site institucional — Reumatologia

Site estático (HTML, CSS e JavaScript puros, sem build) pronto para publicação
no GitHub Pages, Vercel, Netlify ou qualquer hospedagem tradicional.

```
docs/
├── index.html              Página principal (todas as seções)
├── 404.html                Página de erro
├── robots.txt              Instruções para buscadores
├── sitemap.xml             Mapa do site
├── CNAME                   Domínio próprio (caiowandenkolk.com.br)
├── .nojekyll               Impede o processamento Jekyll no GitHub Pages
└── assets/
    ├── css/style.css       Estilos (paleta e tipografia no topo, em :root)
    ├── js/main.js          Menu mobile, revelação ao rolar, ano do rodapé
    └── img/favicon.svg     Ícone do navegador
```

---

## 1. Preencher os dados reais

Todo trecho a personalizar está marcado no HTML com o comentário `<!-- SUBSTITUIR -->`.
Para localizá-los:

```bash
grep -n "SUBSTITUIR" docs/index.html
```

Substitua, em `index.html` e `404.html`:

| Marcador atual | Substituir por |
|---|---|
| `CW` (em `marca__sigla` e no favicon) | Iniciais, caso queira outras |
| `Cidade/UF` (só na lista de formação) | Cidade da instituição de ensino |
| `5500000000000` | WhatsApp: 55 + DDD + número, só dígitos (ex.: `5511998765432`) |
| `+550000000000` / `(00) 0000-0000` | Telefone do consultório |
| `contato@caiowandenkolk.com.br` | E-mail real, caso seja outro |
| `Rua Exemplo, 000` | Endereço completo do consultório |
| Bloco `.retrato__vazio` | `<img src="assets/img/retrato.jpg" alt="Retrato do Dr. Caio Wandenkolk">` |
| Bloco `.mapa__vazio` | `<iframe>` do Google Maps (Compartilhar → Incorporar um mapa) |
| Lista `.formacao` | Sua formação real |
| Cartão `00 anos` | Tempo de atuação, ou remova o bloco `.cartao-flutuante` |

Uma substituição rápida em massa (revise antes de rodar):

```bash
cd docs
sed -i 's/5500000000000/5511998765432/g; s/+550000000000/+5511998765432/g' index.html
```

### Imagens a adicionar em `assets/img/`

| Arquivo | Uso | Tamanho sugerido |
|---|---|---|
| `retrato.jpg` | Foto profissional no herói | 800 × 1000 px |
| `capa.jpg` | Prévia ao compartilhar em redes sociais | 1200 × 630 px |
| `apple-touch-icon.png` | Ícone em iPhone/iPad | 180 × 180 px |

Comprima as imagens antes de subir (o site inteiro deve carregar em menos de 1 s).

---

## 2. Publicar no GitHub Pages

1. No GitHub: **Settings → Pages**.
2. Em *Build and deployment*, escolha **Deploy from a branch**.
3. Branch: a branch em que este código está · Pasta: **`/docs`** · **Save**.
4. Aguarde alguns minutos: o site fica no ar em `https://<usuário>.github.io/<repositório>/`.

### Apontar o domínio próprio — `caiowandenkolk.com.br`

O arquivo `docs/CNAME` já está criado com o domínio raiz. Falta a parte do DNS.

1. No **Registro.br**, entre no domínio → aba **DNS** → *Editar zona* e crie:

   | Tipo | Nome | Valor |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<usuário>.github.io.` |

   Os quatro registros `A` são obrigatórios — o GitHub usa os quatro para redundância.
   Troque `<usuário>` pelo seu usuário do GitHub (no Registro.br, o ponto final é exigido).
   O `CNAME` de `www` é opcional, mas garante que `www.caiowandenkolk.com.br`
   redirecione para o domínio raiz em vez de dar erro.

2. Em **Settings → Pages → Custom domain**, informe `caiowandenkolk.com.br` e salve.
3. Aguarde o *DNS check* passar (de minutos a algumas horas) e marque **Enforce HTTPS**.
   O certificado TLS é emitido automaticamente pelo GitHub, sem custo.

Para verificar a propagação:

```bash
dig +short caiowandenkolk.com.br
# deve responder os quatro IPs 185.199.10x.153
```

> **Atenção:** se você trocar o domínio raiz por `www` mais tarde, atualize também o
> `CNAME`, a `<link rel="canonical">` e a `og:url` do `index.html`, o `robots.txt`
> e o `sitemap.xml` — os quatro precisam apontar para o mesmo endereço, senão o
> Google indexa versões duplicadas do site.

---

## 3. Alternativas de hospedagem

- **Vercel / Netlify** — conecte o repositório, defina o diretório de publicação como `docs`
  e deixe o comando de build vazio. O domínio próprio é configurado no painel do serviço.
- **Hospedagem tradicional (cPanel/FTP)** — envie o *conteúdo* da pasta `docs/`
  para `public_html/`.

---

## 4. Personalização visual

Cores e tipografia ficam concentradas no bloco `:root` de `assets/css/style.css`:

```css
--azul-800:#14456e;   /* cor principal: cabeçalho, botões, títulos */
--verde:#2a9d8f;      /* cor de destaque: CTAs, ícones, marcadores */
--areia:#fbfaf8;      /* fundo geral */
```

Alterar essas variáveis muda o site inteiro de forma consistente.

---

## 5. Conformidade com o Conselho Federal de Medicina

A publicidade médica é regulada pela Resolução CFM nº 1.974/2011 e pelo Código de Ética
Médica. Ao preencher o conteúdo, observe:

- **Obrigatório:** nome, especialidade e número de inscrição no CRM (com RQE, se houver)
  visíveis em todo material.
- **Vedado:** divulgar preços de consultas e procedimentos, ou oferecer descontos e
  condições de pagamento como chamariz.
- **Vedado:** fotos de "antes e depois", depoimentos de pacientes e imagens que sugiram
  resultados garantidos.
- **Vedado:** garantir resultados, prometer cura ou alegar superioridade sobre colegas.
- **Vedado:** divulgar técnica ainda não reconhecida pelo CFM como de eficácia comprovada.
- **Recomendado:** manter o tom informativo e educativo, sem autopromoção sensacionalista.

Em caso de dúvida sobre um conteúdo específico, consulte o CRM do seu estado antes de publicar.

---

## 6. Checklist antes de divulgar o site

- [ ] Todos os `<!-- SUBSTITUIR -->` resolvidos (`grep -n SUBSTITUIR docs/index.html` sem resultados)
- [ ] Links de WhatsApp, telefone e e-mail testados em um celular
- [ ] Foto e mapa inseridos
- [ ] DNS do `caiowandenkolk.com.br` propagado e HTTPS ativo (*Enforce HTTPS* marcado)
- [ ] Site cadastrado no [Google Search Console](https://search.google.com/search-console) e sitemap enviado
- [ ] Perfil no [Google Meu Negócio](https://business.google.com) criado, com o mesmo endereço e telefone do site
- [ ] Verificado em celular, tablet e desktop
