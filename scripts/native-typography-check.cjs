/** Compara medidas de fontes e caixas exportadas do DOM Electron e da interface Qt. */
const fs = require('node:fs');

/** Lê um relatório JSON recusando arquivos vazios ou sem a estrutura esperada. */
function readReport(filename, field) {
  const report = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  if (!report || !Array.isArray(report[field])) throw new Error(`Relatório inválido: ${filename}`);
  return report;
}

/** A tolerância cobre arredondamento de meio pixel, sem aceitar mudança de tamanho de fonte. */
function compareReports(electron, qt) {
  const failures = [];
  const comparisons = [];
  for (const key of ['width', 'height', 'scale']) {
    if (electron.viewport[key] !== qt.viewport[key]) failures.push(`Área útil diferente: ${key}`);
  }
  const groups = [
    { role: 'navigationLabel', selectors: ['.nav-item', '.tree-item'], row: true },
    { role: 'libraryCardPlatform', selectors: ['.card-platform'] },
    { role: 'libraryCardTitle', selectors: ['.card-copy strong'] },
    { role: 'inventoryCardCover', selectors: ['.hw-card-cover'] },
    { role: 'inventoryCardPlatform', selectors: ['.hw-card-platform'] },
    { role: 'inventoryCardTitle', selectors: ['.hw-card-copy strong'] }
  ];
  for (const group of groups) {
    const expected = electron.elements.filter(item => group.selectors.includes(item.selector));
    const actual = qt.typography.filter(item => item.role === group.role);
    if (expected.length !== actual.length) failures.push(`${group.role}: quantidade ${actual.length}, esperada ${expected.length}`);
    for (let index = 0; index < Math.min(expected.length, actual.length); ++index) {
      const left = expected[index];
      const right = actual[index];
      const rect = group.row ? right.row : right.rect;
      const delta = {};
      for (const key of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(left.rect[key]) || !Number.isFinite(rect[key])) throw new Error(`Medida inválida: ${group.role}.${key}`);
        delta[key] = Math.round((rect[key] - left.rect[key]) * 10000) / 10000;
        if (Math.abs(delta[key]) > 0.5) failures.push(`${group.role}[${index}].${key}: diferença ${delta[key]} px`);
      }
      if (right.font) {
        const family = left.style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (right.font.family !== family) failures.push(`${group.role}[${index}]: família diferente`);
        if (right.font.size !== parseFloat(left.style.fontSize)) failures.push(`${group.role}[${index}]: tamanho de fonte diferente`);
        if (right.font.weight !== Number(left.style.fontWeight)) failures.push(`${group.role}[${index}]: peso de fonte diferente`);
        const label = group.row ? left.text.split('\n')[0] : left.text;
        if (label !== right.text) failures.push(`${group.role}[${index}]: texto diferente`);
      }
      comparisons.push({ role: group.role, text: right.text || '', delta, font: right.font || null });
    }
  }
  return { passed: failures.length === 0, tolerancePx: 0.5, compared: comparisons.length, failures, comparisons };
}

/** Executa somente comparações locais; não abre nem modifica qualquer perfil de usuário. */
function main() {
  const [electronPath, qtPath, outputPath] = process.argv.slice(2);
  if (!electronPath || !qtPath) throw new Error('Uso: node scripts/native-typography-check.cjs <electron-typography.json> <qt.json> [resultado.json]');
  const result = compareReports(readReport(electronPath, 'elements'), readReport(qtPath, 'typography'));
  if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, compared: result.compared, tolerancePx: result.tolerancePx, failures: result.failures }));
  if (!result.passed) process.exitCode = 1;
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
