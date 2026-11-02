/** Compara os tokens e ícones QML com a referência local Electron. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const icons = require('lucide-react');

/** Mapeia nomes de tokens entre CSS e o singleton QML. */
const tokenMap = {
  'bg-primary': 'background', 'bg-sidebar': 'sidebar', 'bg-panel': 'panel', 'bg-card': 'card',
  'bg-elevated': 'elevated', 'bg-control': 'control', 'bg-control-hover': 'controlHover',
  'bg-glass': 'glass', 'card-hover': 'cardHover', accent: 'accent', 'accent-muted': 'accentMuted',
  'accent-soft': 'accentSoft', 'on-accent': 'accentForeground', 'text-primary': 'text',
  'text-secondary': 'secondary', 'text-muted': 'muted', border: 'border', 'border-strong': 'borderStrong'
};

/** Converte CSS e notação Qt #AARRGGBB para os mesmos quatro bytes. */
function rgba(value, qt) {
  const text = value.trim().toLowerCase();
  if (text.startsWith('#')) {
    const digits = text.slice(1);
    if (digits.length === 6) return `${digits}ff`;
    if (digits.length === 8 && qt) return digits.slice(2) + digits.slice(0, 2);
  }
  const match = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(text);
  if (!match) throw new Error(`Cor não reconhecida: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), Math.round(Number(match[4]) * 255)].map((component) => component.toString(16).padStart(2, '0')).join('');
}

/** Faz a comparação determinística sem baixar assets ou consultar dados do usuário. */
function main() {
  const root = path.resolve(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'src/renderer/styles/global.css'), 'utf8');
  const qml = fs.readFileSync(path.join(root, 'native/qml/Theme.qml'), 'utf8');
  for (const [cssName, qmlName] of Object.entries(tokenMap)) {
    const cssMatch = css.match(new RegExp(`--${cssName}:\\s*([^;]+);`));
    const qmlMatch = qml.match(new RegExp(`readonly property color ${qmlName}:\\s*"([^"]+)"`));
    assert.ok(cssMatch && qmlMatch, `Token ausente: ${cssName}/${qmlName}`);
    assert.equal(rgba(qmlMatch[1], true), rgba(cssMatch[1], false), `Token divergente: ${cssName}/${qmlName}`);
  }
  assert.match(qml, /readonly property int sidebarWidth:\s*240/);
  assert.match(qml, /readonly property int controlHeight:\s*34/);
  for (const [cssName, qmlName] of [['modal-title-gap', 'modalTitleGap'], ['form-control-font-size', 'formControlFontSize'], ['form-label-font-size', 'formLabelFontSize']]) {
    const cssMatch = css.match(new RegExp(`--${cssName}:\\s*(\\d+)px;`));
    const qmlMatch = qml.match(new RegExp(`readonly property int ${qmlName}:\\s*(\\d+)`));
    assert.ok(cssMatch && qmlMatch, `Medida ausente: ${cssName}/${qmlName}`);
    assert.equal(qmlMatch[1], cssMatch[1], `Medida divergente: ${cssName}/${qmlName}`);
  }
  assert.match(css, /font-family:\s*"Segoe UI"/);
  // Sombras são tokens de layout/efeito, mas os valores de cor e geometria vêm do CSS.
  for (const [cssName, qmlColor, qmlBlur, qmlOffset] of [
    ['shadow-elevated', 'shadowElevatedColor', 'shadowElevatedBlur', 'shadowElevatedOffsetY'],
    ['shadow-modal', 'shadowModalColor', 'shadowModalBlur', 'shadowModalOffsetY']
  ]) {
    const cssMatch = css.match(new RegExp(`--${cssName}:\\s*0\\s+(\\d+)px\\s+(\\d+)px\\s+(rgba\\([^)]+\\))`));
    const colorMatch = qml.match(new RegExp(`readonly property color ${qmlColor}:\\s*"([^"]+)"`));
    const blurMatch = qml.match(new RegExp(`readonly property int ${qmlBlur}:\\s*(\\d+)`));
    const offsetMatch = qml.match(new RegExp(`readonly property int ${qmlOffset}:\\s*(\\d+)`));
    assert.ok(cssMatch && colorMatch && blurMatch && offsetMatch, `Sombra ausente: ${cssName}`);
    assert.equal(rgba(colorMatch[1], true), rgba(cssMatch[3], false), `Cor de sombra divergente: ${cssName}`);
    assert.equal(Number(blurMatch[1]), Number(cssMatch[2]), `Blur de sombra divergente: ${cssName}`);
    assert.equal(Number(offsetMatch[1]), Number(cssMatch[1]), `Deslocamento de sombra divergente: ${cssName}`);
  }
  // Confere pesos e tamanhos de componentes visíveis, além dos tokens globais.
  const sidebarCss = fs.readFileSync(path.join(root, 'src/renderer/components/Sidebar/Sidebar.css'), 'utf8');
  const cardCss = fs.readFileSync(path.join(root, 'src/renderer/components/GameGrid/GameGrid.css'), 'utf8');
  const sidebarQml = fs.readFileSync(path.join(root, 'native/qml/components/NavigationButton.qml'), 'utf8');
  const cardQml = fs.readFileSync(path.join(root, 'native/qml/components/GameCard.qml'), 'utf8');
  assert.match(sidebarCss, /\.nav-item\s*\{[^}]*font-size:\s*13px;[^}]*font-weight:\s*700;/s);
  assert.match(sidebarQml, /font\.pixelSize:\s*control\.compact\s*\?\s*12\s*:\s*13[\s\S]*?font\.weight:\s*Font\.Bold/);
  assert.match(cardCss, /\.card-platform\s*\{[^}]*font-size:\s*9px;[^}]*font-weight:\s*900;[^}]*letter-spacing:\s*0\.08em;/s);
  assert.match(cardQml, /font\.pixelSize:\s*9;\s*font\.weight:\s*Font\.Black;\s*font\.letterSpacing:\s*0\.72/);
  const iconMap = { library: 'Library', cpu: 'Cpu', search: 'Search', star: 'Star', trophy: 'Trophy', 'gamepad-2': 'Gamepad2', 'chart-no-axes-column': 'ChartNoAxesColumn', 'arrow-up-down': 'ArrowUpDown', 'grid-2x2': 'Grid2X2', list: 'List', settings: 'Settings', 'chevron-left': 'ChevronLeft', 'chevron-right': 'ChevronRight', 'chevrons-left': 'ChevronsLeft', 'chevrons-right': 'ChevronsRight', x: 'X' };
  for (const [name, exported] of Object.entries(iconMap)) {
    const expected = renderToStaticMarkup(React.createElement(icons[exported], { size: 24, color: '#b9cacb', strokeWidth: 2 }));
    const actual = fs.readFileSync(path.join(root, 'native/assets', `${name}.svg`), 'utf8').replace(/^<!--[^\n]*-->\r?\n/, '').trim();
    assert.equal(actual, expected, `Ícone Lucide divergente: ${name}`);
  }
  // Variantes ativas devem manter exatamente o desenho original e alterar só a cor.
  for (const name of ['library', 'cpu', 'chart-no-axes-column', 'star', 'gamepad-2', 'trophy', 'grid-2x2', 'list']) {
    const original = fs.readFileSync(path.join(root, 'native/assets', `${name}.svg`), 'utf8');
    const active = fs.readFileSync(path.join(root, 'native/assets', `${name}-active.svg`), 'utf8');
    assert.equal(active, original.replace('stroke="#b9cacb"', 'stroke="#00f2ff"'), `Ícone ativo divergente: ${name}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'native/assets/LUCIDE-LICENSE.txt')));
  console.log(`${Object.keys(tokenMap).length} tokens, 2 sombras, medidas básicas e ${Object.keys(iconMap).length} ícones conferidos.`);
}
main();
