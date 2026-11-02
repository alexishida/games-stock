<!-- Efeitos gráficos do protótipo Qt no Windows: blur, sombras, gradientes e custo. -->
# Efeitos do protótipo no Windows

Medições feitas com `--open-settings`, `--effect-benchmark` e capturas comparativas contra
`electron-reference-fWbTwI`, em backend D3D11 e sem perfil real.

## Backdrop blur

O CSS usa `backdrop-filter: blur(8px)` com scrim de 0,68. No Qt, `MultiEffect` com
`backdropBlurMax: 32` reproduz o raio percebido; a camada empilhada usa 16 e scrim mais claro. O
efeito é aplicado na superfície da janela, não no painel, para não desfocar o próprio modal.

## Sombras

| Elemento | CSS | MultiEffect |
|---|---:|---:|
| Card elevado | 30 px | `shadowElevatedBlurMax: 60` |
| Modal | 80 px | `shadowModalBlurMax: 128` |
| TopBar | 24 px | `shadowTopbarBlurMax: 48` |

As sombras usam os mesmos offsets e cores do renderer. Acima de 80 px o MultiEffect perde
intensidade em relação ao CSS; o valor 128 foi o maior que ainda desenhou a sombra do modal sem
artefatos.

## Gradientes e transições

- Gradientes de card (placeholder radial, gradiente inferior de 58% e brilho de fundo) foram
  capturados sem diferença visível; o placeholder usa `Canvas` porque o CSS combina gradiente radial
  e linear.
- Transições preservadas: card sobe 2 px em 180 ms (também `border-color` e sombra), favorito em
  160 ms e botões/navegação em 150 ms. O teste QML offscreen cobre arraste e escurecimento; a
  fidelidade temporal foi conferida por captura em hover manual, não por medição automática de quadros.

## Custo

Benchmark de 5 s com a superfície animada e o modal de Configurações aberto:

| Configuração | Quadros | CPU do processo | API gráfica |
|---|---:|---:|---:|
| Com blur | 309 | 125 ms | 4 (D3D11) |
| Sem blur | 308 | 109 ms | 4 (D3D11) |

O loop ficou limitado pelo vsync (~62 fps nas duas configurações), portanto o número de quadros não
mede ganho ou perda de GPU. O custo observável é de ~16 ms de CPU em 5 s (+3,2%) e uma camada de
textura do tamanho da janela enquanto há modal aberto. `QSG_RENDER_TIMING=1` arredonda o tempo por
quadro para 0 ms nesta máquina e não serve como evidência; medição de GPU fica pendente de uma
ferramenta externa.

## Pendências herdadas

1. A sombra do modal é mais fraca que o CSS (limitação do MultiEffect acima de 80 px).
2. O primeiro modal não recebe o blur de 4 px da camada empilhada; o segundo recebe.

Essas diferenças são registradas como limitação gráfica e não como falha de layout na
[matriz visual](parity-audit.md).
