/** Extrai desenhos Lucide locais do pacote instalado sem acessar CDN ou gerar novos ícones. */
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const icons = require('lucide-react');

/** Mapa explícito mantém somente os desenhos usados no protótipo. */
const selected = {
  library: 'Library', cpu: 'Cpu', search: 'Search', star: 'Star', trophy: 'Trophy',
  'gamepad-2': 'Gamepad2', 'chart-no-axes-column': 'ChartNoAxesColumn',
  'arrow-up-down': 'ArrowUpDown', 'grid-2x2': 'Grid2X2', list: 'List', settings: 'Settings',
  'chevron-left': 'ChevronLeft', 'chevron-right': 'ChevronRight', 'chevrons-left': 'ChevronsLeft', 'chevrons-right': 'ChevronsRight', x: 'X',
  pencil: 'Pencil', 'trash-2': 'Trash2', play: 'Play', 'globe-2': 'Globe2', sparkles: 'Sparkles',
  'rotate-ccw': 'RotateCcw', 'scroll-text': 'ScrollText', image: 'Image', save: 'Save',
  'link-2': 'Link2', plus: 'Plus', 'sliders-horizontal': 'SlidersHorizontal', unlink: 'Unlink',
  'refresh-cw': 'RefreshCw', 'rotate-ccw': 'RotateCcw', 'folder-open': 'FolderOpen', link: 'Link'
};
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'native/assets');
fs.mkdirSync(target, { recursive: true });
for (const [name, exported] of Object.entries(selected)) {
  const svg = renderToStaticMarkup(React.createElement(icons[exported], { size: 24, color: '#b9cacb', strokeWidth: 2 }));
  fs.writeFileSync(path.join(target, `${name}.svg`), `<!-- Ícone Lucide local; licença ISC em LUCIDE-LICENSE.txt. -->\n${svg}\n`);
}
// Variantes coloridas mantêm o mesmo desenho Lucide sem depender de efeitos de GPU.
for (const [source, targetName, color, filled] of [
  ['star', 'star-favorite', '#f59e0b', true],
  ['star', 'star-card', '#facc15', true],
  ['gamepad-2', 'gamepad-playing', '#00f2ff', false],
  ['trophy', 'trophy-completed', '#4ade80', false],
  ['grid-2x2', 'grid-2x2-active', '#00f2ff', false],
  ['list', 'list-active', '#00f2ff', false],
  ['library', 'library-active', '#00f2ff', false],
  ['cpu', 'cpu-active', '#00f2ff', false],
  ['chart-no-axes-column', 'chart-no-axes-column-active', '#00f2ff', false],
  ['star', 'star-active', '#00f2ff', false],
  ['gamepad-2', 'gamepad-2-active', '#00f2ff', false],
  ['trophy', 'trophy-active', '#00f2ff', false],
  ['settings', 'settings-dark', '#002022', false]
]) {
  const original = fs.readFileSync(path.join(target, `${source}.svg`), 'utf8');
  const variant = original.replace('stroke="#b9cacb"', `stroke="${color}"`).replace('fill="none"', `fill="${filled ? color : 'none'}"`);
  fs.writeFileSync(path.join(target, `${targetName}.svg`), variant);
}
fs.copyFileSync(path.join(root, 'src/renderer/assets/logo.png'), path.join(target, 'logo.png'));
fs.writeFileSync(path.join(target, 'LUCIDE-LICENSE.txt'), 'Licença original dos ícones Lucide extraídos do pacote local.\n\n' + fs.readFileSync(path.join(root, 'node_modules/lucide-react/LICENSE'), 'utf8'));
console.log('Assets do protótipo extraídos do renderer e do pacote Lucide instalado.');
