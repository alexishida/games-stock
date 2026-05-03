---
name: Obsidian Cyber
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#eff8ff'
  on-tertiary: '#003547'
  tertiary-container: '#ace2ff'
  on-tertiary-container: '#006788'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#c0e8ff'
  tertiary-fixed-dim: '#7bd1fa'
  on-tertiary-fixed: '#001e2b'
  on-tertiary-fixed-variant: '#004d66'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
  form-control:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  form-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '800'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.375rem (6px)
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  gutter: 1.5rem
  margin: 2rem
---

## Marca e Estilo

A personalidade de marca deste sistema de design é definida por precisão técnica e organização digital imersiva. Ele mira um público gamer sofisticado, que valoriza tanto o acabamento estético quanto a eficiência funcional. A UI evoca a sensação de um "Centro de Comando": confiável, performática e futurista.

O estilo visual combina **Minimalismo** com **Glassmorphism**. Ao remover elementos decorativos desnecessários, o sistema permite que as capas dos jogos permaneçam como ponto focal. O glassmorphism é aplicado estrategicamente em elementos de navegação e overlays para criar sensação de profundidade e acabamento moderno sem distrair da biblioteca principal de conteúdo.

## Cores

Este sistema de design utiliza uma paleta escura de alto contraste, pensada para reduzir o cansaço visual em sessões longas e manter os metadados dos jogos legíveis.

- **Primária:** Electric Cyan (#00f2ff) é reservado para ações de alta prioridade, estados de foco e indicadores de progresso.
- **Paleta de superfícies:** A base é Deep Charcoal (#121212), com Slate Grays usados para definir containers e superfícies interativas.
- **Bordas:** Bordas slate sutis e com baixa opacidade (por exemplo, #334155 a 40% de opacidade) são usadas para delimitar cards de jogos sem criar ruído visual.
- **Acentos:** Azuis celestes terciários são usados para indicadores de status secundários (por exemplo, "ROM verificada" ou "Atualizado").

## Tipografia

O sistema tipográfico usa **Inter** por sua excelente legibilidade e por seu caráter neutro e sistemático.

- **Hierarquia:** Títulos de jogos usam `headline-lg` ou `headline-md` em pesos fortes para se destacar sobre imagens ricas.
- **Rótulos de metadados:** Rótulos pequenos, em caixa alta e negrito, com leve espaçamento entre letras (0.05em), são usados para detalhes técnicos como "PLATAFORMA", "REGIÃO" ou "TAMANHO DO ARQUIVO", garantindo leitura de alto contraste sobre fundos escuros.
- **Texto de corpo:** Informações padrão usam tamanho confortável entre 14px e 16px, com line-height generoso para descrições e logs de alteração.
- **Formulários:** Controles de formulário (`input`, `select`, `textarea` e botões de ação do fluxo) usam `form-control` com 13px, o mesmo tamanho visual do botão "Adicionar Pasta". Rótulos de formulário usam `form-label` com 11px e peso 800.

## Layout e Espaçamento

O layout utiliza um modelo de **Grid Fluido** para a biblioteca principal de jogos, permitindo que a visualização escale de miniaturas pequenas para cards hero grandes de acordo com o tamanho da janela.

- **Sidebars:** Uma sidebar de largura fixa (280px) abriga a navegação, usando um efeito de vidro semitransparente para manter a sensação de espaço.
- **Sistema de grid:** Uma unidade base de 8px orienta todos os espaçamentos. Na galeria, mantém-se um gutter de 24px (1.5rem) para evitar poluição visual entre as capas.
- **Margens:** As margens globais da página são definidas em 32px (2rem) para enquadrar o conteúdo confortavelmente dentro da janela do aplicativo desktop.

## Elevação e Profundidade

A hierarquia é estabelecida por **Camadas Tonais** e **Glassmorphism**.

- **Nível 0 (fundo):** #121212 sólido.
- **Nível 1 (cards/containers):** Slate Gray (#1e293b) com borda sutil de 1px.
- **Nível 2 (overlays/sidebars):** Slate semitransparente com `backdrop-filter: blur(12px)`. Isso cria um efeito de vidro fosco que sugere que a UI está flutuando acima da biblioteca de jogos.
- **Sombras:** Use sombras ultrassuaves, com raio amplo (0 10px 30px rgba(0,0,0,0.5)), em cards de jogo ativos e modais para trazê-los para frente no eixo Z.

## Formas

A linguagem de formas deste sistema de design é consistentemente **Arredondada**, equilibrando acessibilidade orgânica e precisão técnica.

- **Elementos padrão:** Botões, campos de entrada e cards pequenos usam raio de **6px** para manter a interface mais compacta.
- **Componentes grandes:** Cards principais de capas de jogos e containers de modal usam raio de **1rem (16px)** para enfatizar sua importância e suavizar a aparência geral do grid.
- **Estados interativos:** No hover, os cards podem aumentar sutilmente sua elevação, mas o raio dos cantos permanece constante para manter o ritmo visual.

## Componentes

- **Cards de jogos:** O componente central. Ele apresenta uma imagem de capa full-bleed com um overlay de gradiente sutil na parte inferior para garantir a legibilidade do título. Chips de metadados ficam no canto superior direito.
- **Títulos de modal:** Todo modal deve manter respiro padrão de 28px entre o cabeçalho/título e o conteúdo seguinte. Usar a variável CSS global `--modal-title-gap` para esse espaçamento, evitando valores locais divergentes.
- **Modais secundários:** Modais abertos sobre outro modal usam título interno em Inter, 22px, peso 900, `line-height: 1` e cor `on-surface`. Mantêm borda `outline`, fundo `surface-container`, sombra ampla e raio próximo de 12px para preservar a hierarquia sem competir com o modal principal. Ações de rodapé ficam alinhadas à direita, com espaçamento consistente entre botões.
- **Botões:** Botões primários são preenchidos com Electric Cyan e usam texto preto (`on-primary`). Botões secundários têm contorno slate e estados de hover preenchidos.
- **Icones:** Todos os icones da interface usam `lucide-react` instalado localmente no projeto. Importar apenas os icones necessarios por componente e manter tamanhos entre 16px e 22px em botoes/menus.
- **Chips de metadados:** Pills pequenas e de alto contraste (por exemplo, "N64", "RPG"), com fundos semitransparentes e bordas brilhantes.
- **Campos de entrada:** Campos escuros e rebaixados, com anéis de foco em #00f2ff e texto de placeholder discreto.
- **Selects de formulário:** Devem seguir o mesmo tratamento dos campos de entrada: fundo escuro (`rgba(255, 255, 255, 0.04)`), texto `on-surface`, borda `outline`, raio de 6px, fonte `form-control` e foco com anel #00f2ff. As opções internas (`option`/`optgroup`) também precisam usar fundo escuro e texto claro para evitar menus nativos com fundo branco.
- **Sidebars de vidro:** Links de navegação usam um indicador sutil de "borda esquerda" em ciano primário quando ativos, acompanhado por um destaque suave de fundo.
- **Barras de progresso:** Barras finas, com 4px de altura, usando a cor primária para conclusão sobre uma trilha slate escura.

### Padrão: formulários em modal

Formulários em modais devem usar `management-form` como base visual. Labels ficam sempre em caixa alta, peso 800, tamanho `form-label`, `letter-spacing: 0.05em` e `gap: 8px` ate o campo.

Grupos de campos usam `gap: 16px`. Rodapés de modal ficam alinhados à direita, com espaçamento consistente entre ações.

Botões de ação em formulários devem usar ícones `lucide-react` junto do texto. Ação primária usa `.text-button.active`; cancelar ou ação negativa usa `.text-button.danger`. Para botões de rodapé, usar `.form-action-button` para largura mínima consistente.

### Padrão: intro de seção de configurações

Toda seção do modal de configurações deve iniciar com o componente `<SectionIntro title="..." description="..." />` localizado em `src/renderer/components/SectionIntro/SectionIntro.tsx`.

- `title`: subtítulo em `var(--accent)`, 16px, peso 800 — identifica o conteúdo da seção (ex.: "Pastas em uso", "Plataformas").
- `description`: frase curta em `var(--text-primary)`, 13px — descreve o que o usuário encontra abaixo.
- O componente adiciona `margin-bottom: 12px` após o `<p>` para separar o intro do conteúdo seguinte.
- Não duplicar os estilos em CSS local — o componente centraliza tudo em `SectionIntro.css`.

### Padrão: botões de fechar modal

Todo botão de fechar modal deve usar `icon-button` com ícone `X` do `lucide-react`, tamanho 26px, sem padding e SVG centralizado. O botão inteiro deve ser vermelho, não apenas o ícone: borda `rgba(248, 113, 113, 0.55)`, fundo `rgba(127, 29, 29, 0.38)` e cor `#fecaca`. No hover, intensificar para borda `rgba(248, 113, 113, 0.8)`, fundo `rgba(185, 28, 28, 0.58)` e cor `#fff1f2`.
