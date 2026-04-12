# Documentação Frontend — Imobiliária do Professor

> Especificação de telas, funcionalidades, design system e integrações do cliente web.
> Para modelos de dados, rotas da API e segurança, consulte `DOCUMENTACAO_BACKEND.md`.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack e Tecnologias](#2-stack-e-tecnologias)
3. [Funcionalidades — Site Público](#3-funcionalidades--site-público)
4. [Funcionalidades — Painel Administrativo](#4-funcionalidades--painel-administrativo)
5. [Contrato com a API](#5-contrato-com-a-api)
6. [Identidade Visual e Design System](#6-identidade-visual-e-design-system)
7. [Responsividade](#7-responsividade)
8. [Integrações Externas](#8-integrações-externas)
9. [Infraestrutura e Deploy](#9-infraestrutura-e-deploy)
10. [Glossário](#10-glossário)

---

## 1. Visão Geral

**Produto:** Imobiliária do Professor
**Responsabilidade deste projeto:** Interface web completa — site público para visitantes e painel administrativo para a equipe.

**URLs:**

| Ambiente | Site Público | Painel Admin | API |
|----------|-------------|--------------|-----|
| **Produção** | `https://imobiliariadoprofessor.com.br` | `https://gestao.imobiliariadoprofessor.com.br` | `https://api.imobiliariadoprofessor.com.br` |
| **Homologação** | `https://anaerichard.visualizeaquiseu.app.br` | `https://gestaoanaerichard.visualizeaquiseu.app.br` | `https://apianaerichard.visualizeaquiseu.app.br` |

> O painel administrativo é acessível **apenas pelo subdomínio `gestao`**. Não existe botão, link ou menu no site público apontando para ele.

---

## 2. Stack e Tecnologias

| Camada | Tecnologia | Detalhes |
|--------|-----------|---------|
| **Framework** | Next.js (React) | App Router, SSR + CSR conforme a rota |
| **Linguagem** | TypeScript | Em todo o projeto |
| **Estilização** | CSS Modules ou Tailwind | A definir — seguir Design System da seção 6 |
| **Mapa** | Leaflet.js 1.9.x | Mapa interativo com polígonos de regiões |
| **HTTP Client** | fetch nativo / Axios | Consumo da API REST do backend |
| **Autenticação** | Cookie HttpOnly (JWT gerenciado pelo backend) | Middleware Next.js protege rotas admin |

### 2.1 Estrutura de Pastas

```
frontend/
├── src/
│   ├── app/
│   │   ├── (public)/               ← Site público (imobiliariadoprofessor.com.br)
│   │   │   ├── page.tsx            ← Home: mapa + filtros + lista
│   │   │   └── layout.tsx
│   │   └── (admin)/                ← Painel admin (gestao.*)
│   │       ├── login/
│   │       │   └── page.tsx
│   │       ├── page.tsx            ← Dashboard
│   │       ├── imoveis/
│   │       │   └── page.tsx
│   │       ├── regioes/
│   │       │   └── page.tsx
│   │       ├── usuarios/
│   │       │   └── page.tsx        ← Visível somente para ADM
│   │       ├── orcamento/
│   │       │   └── page.tsx
│   │       └── layout.tsx          ← Middleware de autenticação
│   ├── components/
│   │   ├── public/                 ← Componentes do site público
│   │   │   ├── MapaRegioes.tsx
│   │   │   ├── PainelFiltros.tsx
│   │   │   ├── CardImovel.tsx
│   │   │   └── ModalImovel.tsx
│   │   └── admin/                  ← Componentes do painel
│   │       ├── GaleriaEditor.tsx
│   │       ├── FormImovel.tsx
│   │       ├── ListaImoveis.tsx
│   │       └── DesenhoRegiao.tsx
│   └── lib/
│       ├── api.ts                  ← Funções de chamada à API
│       └── formatters.ts           ← Moeda, datas, etc.
├── public/
│   └── (assets estáticos)
└── package.json
```

### 2.2 Variáveis de Ambiente

```env
# Produção
NEXT_PUBLIC_API_URL=https://api.imobiliariadoprofessor.com.br

# Homologação
# NEXT_PUBLIC_API_URL=https://apianaerichard.visualizeaquiseu.app.br

NEXT_PUBLIC_WA_NUMBER=5517999999999
```

---

## 3. Funcionalidades — Site Público

### 3.1 Header

- Logo da imobiliária (usar variação do `Content/` conforme o fundo)
- Seletor de cidade (dropdown listando todas as cidades ativas retornadas por `GET /api/cidades`)
- **Sem botão ou link para o painel administrativo**

**Ao trocar cidade:**
1. Recentra o mapa nas coordenadas e zoom da cidade selecionada
2. Recarrega as regiões da nova cidade (`GET /api/cidades/{id}/regioes`)
3. Recarrega a lista de imóveis com `cidade_id` atualizado
4. Reseta todos os filtros ativos

---

### 3.2 Mapa Interativo

**Biblioteca:** Leaflet.js 1.9.x
**Tile layer:** OpenStreetMap (gratuito, sem API key)

**Layout:**
- Desktop: ocupa 70% da largura da tela
- Mobile: ocupa 100% da largura, altura fixa (~50vh), acima do painel

**Comportamento das regiões:**

| Situação | Estilo do polígono |
|----------|--------------------|
| Região com imóveis | Fill `#40A6F4` opacidade 0.22, borda contínua |
| Região sem imóveis | Fill `#40A6F4` opacidade 0.06, borda tracejada |
| Hover | Aumenta opacidade do fill para feedback visual |
| Clique | Aplica filtro `regiao_id` e atualiza a lista |

**Tooltip permanente** em cada polígono exibindo:
```
Zona Norte
3 imóveis
```

---

### 3.3 Painel de Filtros

**Desktop:** painel lateral direito (30% da largura), fixo
**Mobile:** drawer deslizante a partir da base da tela (bottom sheet)

O header do painel mostra a contagem de filtros ativos, ex: "2 filtros ativos".

**Campos:**

| Campo | Componente | Opções / Comportamento |
|-------|-----------|----------------------|
| Região | Select | "Todas" + regiões da cidade atual |
| Tipo de imóvel | Select | Casa, Apartamento, Sobrado, Terreno, Comercial |
| Preço mínimo | Input numérico | Máscara monetária R$ |
| Preço máximo | Input numérico | Máscara monetária R$ |
| Quartos | Select | 1, 2, 3, 4+ |
| Vagas de garagem | Select | 1, 2, 3+ |

**Botões:**
- **Buscar** — chama `GET /api/imoveis` com todos os params preenchidos
- **Limpar** — reseta todos os campos e recarrega sem filtros

---

### 3.4 Lista de Imóveis

Renderizada no painel lateral, abaixo dos filtros (scroll próprio).

Exibe apenas imóveis públicos retornados pela API (`status = ativo` e `publicar_em` válida — filtro aplicado no backend).

**Card de imóvel:**
- Thumbnail: primeira foto em Base64 (`data:[mimeType];base64,[dados]`), fallback ícone de casa
- Preço formatado: `R$ 480.000`
- Título: `[Região] — [Tipo]`  (ex: "Zona Norte — Casa")
- Tags: `🛏 3  🚿 2  🚗 2  📐 142m²`
- Código do imóvel em destaque (ex: `VTG-001`)
- Clique → abre modal de detalhes

---

### 3.5 Modal de Detalhes do Imóvel

Sobreposição de tela cheia. Acionado ao clicar em um card.

**Controles:**
- Botão fechar (X) no canto superior direito
- Tecla `Escape` fecha o modal
- Clique no overlay externo fecha o modal

**Galeria de mídia (fotos + vídeos unificados):**
- Slot principal (altura 260px) exibe a mídia selecionada:
  - Foto → `<img src="data:[mimeType];base64,[dados]">`
  - Vídeo → `<iframe src={video.embedUrl} allowfullscreen>` — URL vem pronta da API
- Botões `◀` / `▶` para navegar entre mídias
- Contador: `"3 / 6"` (fotos + vídeos juntos)
- Tira de thumbnails clicáveis na base:
  - Fotos: miniatura da imagem em Base64
  - Vídeos: `<img src={video.thumbnailUrl}>` com ícone de play sobreposto — URL vem pronta da API
- Badge com tipo do imóvel no canto inferior esquerdo

**Informações:**
- Preço em destaque (Lato Extrabold)
- Código do imóvel
- Localização: nome da região + cidade (**endereço completo nunca exibido**)
- Grid de specs: quartos · banheiros · m² · vagas
- Descrição (texto livre, Lato Regular)
- Botão WhatsApp (verde `#25D366`):
  ```
  https://wa.me/[WA_NUMBER]?text=Olá%2C+tenho+interesse+no+imóvel+VTG-001
  ```

---

### 3.6 Footer

- Links: WhatsApp, Facebook, Instagram
- Endereço físico da imobiliária
- Copyright

---

## 4. Funcionalidades — Painel Administrativo

Acessado em:
- **Produção:** `https://gestao.imobiliariadoprofessor.com.br`
- **Homologação:** `https://gestaoanaerichard.visualizeaquiseu.app.br`

O middleware do Next.js verifica o cookie JWT em todas as rotas `/admin/*`. Se ausente ou expirado, redireciona para `/login`.

---

### 4.1 Login (`/login`)

- Formulário: campo e-mail + campo senha
- Submit chama `POST /api/auth/login`
- Em caso de sucesso (`200`): cookie HttpOnly é setado pelo backend, frontend redireciona para `/` (dashboard)
- Em caso de credenciais inválidas (`401`): exibe mensagem "E-mail ou senha inválidos"
- Em caso de bloqueio por força bruta (`429`): exibe countdown regressivo usando o campo `bloqueadoPorSegundos` da resposta:

```typescript
// Resposta 429 do backend
type RespostaBloqueio = {
  erro: string              // "Muitas tentativas. Tente novamente em 847 segundos."
  bloqueadoPorSegundos: number
}

// Exemplo de countdown no componente
const [segundosRestantes, setSegundosRestantes] = useState(0)

if (response.status === 429) {
  const { bloqueadoPorSegundos } = await response.json()
  setSegundosRestantes(bloqueadoPorSegundos)
  // exibir: "Tente novamente em 14:07"
}
```

- Link "Voltar ao site" aponta para o site público

> **Credenciais iniciais (seed):** `admin@imobiliaria.com` / `Admin@123`
> Criadas automaticamente pelo `StartupService` na primeira inicialização. **Alterar imediatamente após o primeiro login em produção.**

---

### 4.2 Dashboard (`/`)

**Cards de estatísticas** (dados de `GET /api/admin/stats`):
- Total de imóveis ativos
- Total de regiões cadastradas
- Total de cidades ativas
- Preço médio dos imóveis ativos

**Menu de navegação:**
- 🏠 Imóveis → `/imoveis`
- 🗺️ Regiões → `/regioes`
- 👤 Usuários → `/usuarios` *(renderizado somente se `papel === 'adm'`)*
- 📋 Orçamento → `/orcamento`

---

### 4.3 Gerenciamento de Imóveis (`/imoveis`)

Layout de 3 colunas em desktop.

#### Coluna 1 — Lista (240px)

- Campo de busca (filtra por código, tipo ou região — client-side)
- Selects de cidade e região (cascading, chama API)
- Cada item:
  - Ponto de status colorido (verde=ativo, amarelo=pausado, cinza=inativo, laranja=agendado)
  - Código em destaque
  - Tipo + Região
  - Preço formatado
- Clique → seleciona e carrega nas colunas 2 e 3
- Botão **"+ Novo imóvel"** no topo

#### Coluna 2 — Galeria de Mídias (flex)

**Fotos:**
- Visualizador principal com navegação prev/next
- Thumbnails clicáveis na base
- Contador de posição (ex: "2 / 4")
- Botão **"Adicionar fotos"**:
  - Aceita JPG, PNG, WebP
  - Tamanho máximo: 2MB por arquivo
  - O browser converte o arquivo para Base64 (`FileReader.readAsDataURL`)
  - Envia `{ dadosBase64, mimeType, nomeArquivo }` para `POST /api/admin/imoveis/{id}/fotos`
- Botão excluir foto (lixeira sobre a thumbnail ativa)

**Vídeos:**
- Lista de vídeos com título e thumbnail do YouTube
- Botão **"Adicionar vídeo"** → abre campo para colar URL do YouTube
- Validação client-side de domínio antes de enviar
- Botão excluir vídeo individualmente

#### Coluna 3 — Formulário (310px)

**Modo "Novo Imóvel":** código mostrado como `---`, gerado pelo backend ao salvar
**Modo "Editar":** código exibido no header, botão "Excluir" disponível

| Campo | Tipo | Regras |
|-------|------|--------|
| Status | Select | Ativo, Pausado, Inativo, Agendado |
| Publicar a partir de | Datetime | Aparece somente quando status = Agendado |
| Cidade | Select | Lista `GET /api/admin/cidades`, cascata para Região |
| Região | Select | Lista `GET /api/admin/regioes` filtrada pela cidade |
| Tipo | Select | Casa, Apartamento, Sobrado, Terreno, Comercial |
| Preço | Input numérico | Máscara R$, obrigatório |
| Quartos | Número | 0–20 |
| Banheiros | Número | 0–20 |
| Área m² | Decimal | Obrigatório, positivo |
| Vagas | Número | 0–10 |
| Endereço | Texto | Obrigatório (nunca exibido no site público) |
| Descrição | Textarea | Opcional |

Botão **Salvar** → `POST` ou `PUT` conforme o modo
Botão **Cancelar** → descarta e volta ao estado inicial
Botão **Excluir** (somente edição) → confirmação via toast antes de `DELETE`

---

### 4.4 Gerenciamento de Regiões (`/regioes`)

**Header:**
- Select de estado — populado via `GET /api/estados` (retorna os 27 estados brasileiros do banco, inseridos pelo seed)
- Select de cidade — cascading pelo estado selecionado, via `GET /api/admin/cidades`
- Botão toggle do painel lateral (mobile)

**Mapa Leaflet:**
- Mostra polígonos das regiões cadastradas para a cidade selecionada
- **Modo desenho:** ativado pelo botão "Desenhar":
  - Cursor muda para crosshair
  - Cada clique adiciona um ponto ao polígono temporário
  - Double-clique finaliza o desenho
  - Polígono provisório renderizado em tempo real
- **Modo edição:** ativado ao clicar em "Editar" numa região:
  - Marcadores arrastáveis nos vértices
  - Marcador selecionado fica vermelho
  - Campos lat/lng editáveis manualmente no painel

**Painel lateral:**

*Modo padrão:*
- Botão "✏ Desenhar" / "✕ Limpar"
- Texto de instrução dinâmico ("Clique no mapa para adicionar pontos...")
- Formulário: nome da região, estado, cidade
- Botão "Salvar região" (habilitado somente com ≥ 3 pontos)

*Modo edição:*
- Cabeçalho com nome da região
- Lista de pontos com coordenadas editáveis (lat/lng)
- Botão excluir ponto individual
- Botão "✓ Salvar" e "✕ Cancelar"

**Lista de regiões:**
- Nome + contagem de imóveis
- Botão editar (lápis)
- Botão excluir (lixeira) — exibe aviso se houver imóveis vinculados (backend retorna 409)

---

### 4.5 Gerenciamento de Usuários (`/usuarios`) — somente ADM

Visível e navegável somente quando `papel === 'adm'` (verificado via `GET /api/auth/me`).

**Lista:**
- Nome, e-mail, papel, status (ativo/inativo), último acesso
- Botão **"+ Novo usuário"**
- Botão editar por linha
- Botão desativar por linha (seta `ativo = false` via `PUT`)

**Formulário:**

| Campo | Tipo | Regras |
|-------|------|--------|
| Nome | Texto | Obrigatório |
| E-mail | E-mail | Obrigatório, único |
| Senha | Senha | Obrigatório na criação; vazio na edição = não alterar |
| Papel | Select | ADM, Editor |
| Ativo | Toggle | Padrão: ativo |

> Um ADM não pode desativar a si mesmo nem rebaixar seu próprio papel — o backend retorna 400 se tentar.

---

### 4.6 Orçamento (`/orcamento`)

Página somente leitura com a proposta comercial. Renderiza conteúdo estático. Contém:
- Escopo do MVP entregue
- Tabela de valores por item (frontend, backend, banco, logo)
- Condições de pagamento (entrada + parcelas)
- Proposta de hospedagem recorrente (R$ 100/mês)

---

## 5. Contrato com a API

Esta seção define os formatos de resposta que o frontend espera da API, baseados nos exemplos reais do backend. Os endpoints retornam `Map<String, Object>` (campos em camelCase). Para a especificação completa, consulte `DOCUMENTACAO_BACKEND.md`.

### 5.1 `GET /api/estados`

```typescript
// Usado nos selects de estado (regiões, cadastro de cidades)
type Estado = {
  id: string    // sigla UF, ex: "SP"
  nome: string  // ex: "São Paulo"
}
```

### 5.2 `GET /api/cidades`

```typescript
type Cidade = {
  id: number
  nome: string
  estadoId: string
  latCentro: number
  lngCentro: number
  zoomPadrao: number
}
```

### 5.3 `GET /api/cidades/{id}/regioes`

```typescript
type RegiaoPublica = {
  id: number
  nome: string
  coordenadas: [number, number][]  // [[lat, lng], ...] — JSON parseado pelo frontend
  totalImoveis: number
}
```

> O campo `coordenadas` é armazenado como TEXT no banco. O backend retorna a string JSON — o frontend deve fazer `JSON.parse(regiao.coordenadas)` antes de passar ao Leaflet.

### 5.4 `GET /api/imoveis`

```typescript
// Fotos NÃO são incluídas na listagem — carregue via /midias apenas no modal
type ImovelCard = {
  id: number
  codigo: string
  tipo: string
  preco: number
  quartos: number
  banheiros: number
  areaM2: number
  vagas: number
  descricao: string | null
  regiao: { id: number; nome: string } | null
  cidade: { id: number; nome: string }
}
```

### 5.5 `GET /api/imoveis/{id}/midias`

```typescript
type MidiasImovel = {
  fotos: {
    id: number
    dadosBase64: string    // <img src={`data:${mimeType};base64,${dadosBase64}`} />
    mimeType: string
    nomeArquivo: string
    ordem: number
  }[]
  videos: {
    id: number
    urlYoutube: string
    videoId: string        // ex: "dQw4w9WgXcQ"
    embedUrl: string       // pronto: "https://www.youtube.com/embed/dQw4w9WgXcQ"
    thumbnailUrl: string   // pronto: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    titulo: string | null
    ordem: number
  }[]
}
```

> `embedUrl` e `thumbnailUrl` vêm **prontos do backend** — não é necessário montar no frontend.

### 5.6 `POST /api/auth/login` — resposta de sucesso

```typescript
type RespostaLogin = {
  id: number
  nome: string
  email: string
  papel: 'adm' | 'editor'
}
// Cookie JWT setado automaticamente via Set-Cookie: jwt=...; HttpOnly; SameSite=Strict
```

### 5.7 `GET /api/auth/me`

```typescript
type UsuarioLogado = {
  id: number
  nome: string
  email: string
  papel: 'adm' | 'editor'
}
```

### 5.8 `GET /api/admin/stats`

```typescript
type Stats = {
  imoveisAtivos: number
  regioes: number
  cidades: number
  precoMedio: number
}
```

---

## 6. Identidade Visual e Design System

> Referência: arquivo `Content/cores_fonte.pdf`.
> O protótipo atual usa tons creme/dourado com fontes Playfair Display — **tudo deve ser substituído** pelas especificações abaixo.

### 6.1 Paleta de Cores

```css
:root {
  --color-black:        #1D1E20;  /* Fundo principal, texto sobre claro */
  --color-white:        #FFFFFF;  /* Texto sobre escuro, fundo de cards claros */
  --color-green-mid:    #374C4B;  /* Fundos secundários, cards */
  --color-green-dark:   #2D4839;  /* Headers, barras laterais, nav */
  --color-blue:         #40A6F4;  /* CTAs, botões primários, destaques, links */
  --color-green-deeper: #22342A;  /* Hero sections, sobreposições */
  --color-gray-dark:    #393C40;  /* Bordas, textos secundários, ícones */
  --color-green-wa:     #25D366;  /* Exclusivo para WhatsApp */
}
```

**Hierarquia de uso:**
- **Fundo base:** `--color-black` (`#1D1E20`) — tema escuro
- **Superfícies / cards:** `--color-green-mid` ou `--color-green-dark`
- **Ação principal / destaque:** `--color-blue` (`#40A6F4`)
- **Texto primário:** `--color-white`
- **Texto secundário:** `--color-gray-dark` ou branco com opacidade reduzida

### 6.2 Tipografia

**Família única:** Lato (Google Fonts)

```html
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;800&display=swap" rel="stylesheet">
```

| Peso | `font-weight` | Uso principal |
|------|--------------|---------------|
| Light | 300 | Subtítulos, textos de apoio, metadados |
| Regular | 400 | Corpo de texto, descrições, parágrafos |
| Bold | 700 | Labels, títulos de seção, preços |
| Extrabold | 800 | Títulos principais, CTAs, destaques |

### 6.3 Logos

Arquivos disponíveis em `Content/`:

| Variação | Arquivo | Uso |
|----------|---------|-----|
| Padrão colorida | `png/default.png` / `svg/default.svg` | Uso geral |
| Sobre azul/escuro | `png/blue.png` / `svg/blue.svg` | Header do site, painéis escuros |
| Branca | `png/white-01.png` / `png/white-02.png` | Fundos escuros |
| Preta | `png/black.png` / `svg/black.svg` | Fundos claros |
| Com fundo (bg) | `bg/*.png` | Banners, OG images |

### 6.4 Componentes UI

| Componente | Descrição |
|-----------|-----------|
| **Card de imóvel** | Thumbnail + preço (bold) + título + tags + código |
| **Modal de detalhe** | Galeria unificada fotos/vídeos + specs grid + botão WhatsApp |
| **Toast notification** | Feedback de ações: salvo ✅, excluído 🗑, erro ❌ |
| **Drawer (mobile)** | Painel que desliza da base da tela |
| **Indicador de status** | Ponto colorido: verde=ativo, amarelo=pausado, cinza=inativo, laranja=agendado |
| **Badge tipo imóvel** | Etiqueta pequena sobre a galeria |
| **Ícone de play** | Sobreposto ao thumbnail de vídeo na galeria |
| **Contador de filtros** | "2 filtros ativos" no header do painel |

### 6.5 Breakpoints

| Nome | Largura | Comportamento |
|------|---------|--------------|
| Mobile | ≤ 640px | Layout single column, drawers, mapa full-width |
| Desktop | > 640px | Layouts multi-coluna, painéis fixos |

---

## 7. Responsividade

### Site Público

**Desktop (> 640px):**
- Header: logo à esquerda | seletor de cidade à direita
- Corpo: mapa 70% | painel filtros + lista 30%
- Footer: links e endereço em linha

**Mobile (≤ 640px):**
- Header compacto (logo centralizada)
- Mapa ocupa 100% da largura, ~50vh de altura
- Botão "Filtros" abre o drawer inferior
- Lista de imóveis rolável abaixo do mapa
- Footer empilhado em coluna

---

### Painel Admin — Imóveis

**Desktop:** 3 colunas fixas (lista 240px | galeria flex | formulário 310px)

**Mobile:** coluna única com barra de abas na base para alternar entre:
- "Lista"
- "Mídia"
- "Formulário"

---

### Painel Admin — Regiões

**Desktop:** mapa 70% | painel lateral 340px fixo

**Mobile:** mapa full-screen + botão flutuante para abrir drawer inferior com o painel

---

### Painel Admin — Usuários

**Desktop:** tabela com todas as colunas visíveis

**Mobile:** cards empilhados por usuário, com ações em menu dropdown (⋮)

---

## 8. Integrações Externas

### WhatsApp
- Nenhuma SDK necessária — apenas URL com query string:
  ```
  https://wa.me/{NUMERO}?text={MENSAGEM_URL_ENCODED}
  ```
- Mensagem padrão: `"Olá, tenho interesse no imóvel {CODIGO}"`
- Número vem de `process.env.NEXT_PUBLIC_WA_NUMBER`
- Abre em nova aba (`target="_blank"`)

### YouTube — Embed de Vídeos
- O `videoId` já vem pronto no response da API (extraído pelo backend)
- Embed: `<iframe src="https://www.youtube.com/embed/{videoId}" allowfullscreen />`
- Thumbnail na galeria: `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
- Validação client-side de URL YouTube antes de enviar ao backend (segunda camada de segurança)

### Leaflet.js + OpenStreetMap

```bash
npm install leaflet
npm install @types/leaflet  # TypeScript
```

**Uso principal:**

| Funcionalidade | API Leaflet |
|---------------|------------|
| Mapa base | `L.map(el).setView([lat, lng], zoom)` |
| Tiles | `L.tileLayer('https://{s}.tile.openstreetmap.org/...')` |
| Polígonos de regiões | `L.polygon(coords, { color, fillOpacity })` |
| Tooltip permanente | `polygon.bindTooltip(texto, { permanent: true })` |
| Marcadores editáveis | `L.circleMarker(latLng, { draggable: true })` |

> Leaflet não funciona com SSR (acessa `window`). Importar com `dynamic(() => import('...'), { ssr: false })` no Next.js.

### IBGE API
- ~~Usado para listar estados~~ — estados agora vêm de `GET /api/estados` (backend próprio, seed com os 27 estados)
- Ainda pode ser usado **opcionalmente** no cadastro de novas cidades para validar/autocompletar o nome do município antes de enviar ao backend
- Endpoint: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`
- Chamada direta do frontend, sem autenticação

---

## 9. Infraestrutura e Deploy

### 9.1 Docker

**Desenvolvimento:** apenas o banco de dados roda em Docker. O backend e o frontend sobem localmente.

```yaml
# docker-compose.yml (dev)
services:
  db:
    image: postgres:16
    ports:
      - "5433:5432"   # 5433 no host para evitar conflito com PostgreSQL local
    volumes:
      - pgdata:/var/lib/postgresql/data
```

```bash
# Backend — roda localmente com hot reload
./mvnw quarkus:dev

# Frontend — roda localmente
npm run dev
```

**Produção:** os três serviços (`frontend`, `backend`, `db`) sobem via Docker Compose. Ver `DOCUMENTACAO_BACKEND.md` para o compose completo de produção.

```yaml
# Trecho do docker-compose.yml (produção) — serviço frontend
frontend:
  build: ./frontend
  environment:
    NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    NEXT_PUBLIC_WA_NUMBER: ${NEXT_PUBLIC_WA_NUMBER}
  ports:
    - "3000:3000"
  depends_on:
    - backend
  networks:
    - imob-net
```

### 9.2 Nginx — Roteamento por Subdomínio

Cada subdomínio tem seu próprio bloco `server`. O frontend não precisa mais fazer proxy de `/api/` — as chamadas vão diretamente para `api.*`.

```nginx
# Site público
server {
    listen 443 ssl;
    server_name imobiliariadoprofessor.com.br;
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}

# Painel admin
server {
    listen 443 ssl;
    server_name gestao.imobiliariadoprofessor.com.br;
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}

# API (ver DOCUMENTACAO_BACKEND.md para config completa)
server {
    listen 443 ssl;
    server_name api.imobiliariadoprofessor.com.br;
    location / {
        proxy_pass http://backend:8080;
    }
}
```

> O Next.js distingue site público de admin pelo subdomínio via middleware ou por rotas separadas no App Router.

### 9.3 Variáveis de Ambiente

```env
# URL base da API — subdomínio próprio do backend
NEXT_PUBLIC_API_URL=https://api.imobiliariadoprofessor.com.br   # produção
# NEXT_PUBLIC_API_URL=https://apianaerichard.visualizeaquiseu.app.br  # homologação

# Número WhatsApp (com DDI+DDD, sem + nem traços)
NEXT_PUBLIC_WA_NUMBER=5517999999999
```

---

## 10. Glossário

| Termo | Definição |
|-------|-----------|
| **Site público** | Parte do frontend acessível sem login (`imobiliariadoprofessor.com.br`) |
| **Painel admin** | Parte protegida por JWT (`gestao.imobiliariadoprofessor.com.br`) |
| **Subdomínio gestao** | Único ponto de acesso ao painel — não há link no site público |
| **Drawer** | Painel que desliza da borda inferior da tela (mobile) |
| **Card de imóvel** | Componente de listagem com thumbnail, preço e tags |
| **Modal** | Sobreposição de tela exibindo o detalhe completo de um imóvel |
| **Galeria unificada** | Sequência de fotos e vídeos do imóvel navegável por prev/next |
| **Embed YouTube** | Vídeo exibido dentro da página via `<iframe>` sem sair do site |
| **Base64** | Formato em que as fotos chegam da API — usadas diretamente no `src` do `<img>` |
| **videoId** | Identificador único do vídeo no YouTube, extraído pelo backend da URL completa |
| **Leaflet** | Biblioteca JavaScript para mapas interativos usada no mapa de regiões |
| **Polígono** | Forma geométrica desenhada no mapa representando uma região da cidade |
| **ADM** | Papel de usuário com acesso total, incluindo gestão de usuários |
| **Editor** | Papel com acesso a imóveis e regiões, sem gestão de usuários |
| **Toast** | Notificação temporária de feedback (sucesso / erro / aviso) |
| **SSR** | Server-Side Rendering — página gerada no servidor antes de chegar ao browser |
| **CSR** | Client-Side Rendering — conteúdo carregado dinamicamente no browser |
