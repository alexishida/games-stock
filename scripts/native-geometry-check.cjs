/** Compara retângulos lógicos de capturas Electron e Qt feitas nas mesmas condições. */
const fs = require('node:fs');

/** Recusa relatórios incompletos ou áreas úteis muito diferentes antes de comparar geometria. */
function main() {
  const [electronPath, qtPath] = process.argv.slice(2);
  if (!electronPath || !qtPath) throw new Error('Uso: node scripts/native-geometry-check.cjs <environment.json> <geometria.json>');
  const electron = JSON.parse(fs.readFileSync(electronPath, 'utf8'));
  const qt = JSON.parse(fs.readFileSync(qtPath, 'utf8'));
  if (!electron.geometry || !electron.page || !qt.viewport) {
    throw new Error('Relatórios sem geometria ou sem área útil.');
  }
  // A moldura Win32 pode arredondar 1 px na área útil; o layout é comparado em coordenadas lógicas.
  const viewportDelta = { width: qt.viewport.width - electron.page.width, height: qt.viewport.height - electron.page.height };
  if (Math.abs(viewportDelta.width) > 1 || Math.abs(viewportDelta.height) > 1) {
    throw new Error(`Áreas úteis diferentes: ${JSON.stringify(electron.page)} contra ${JSON.stringify(qt.viewport)}.`);
  }
  let failed = false;
  for (const name of ['sidebar', 'topbar', 'search', 'firstCard']) {
    const left = electron.geometry[name];
    const right = qt[name];
    if (!left || !right) throw new Error(`Elemento ausente: ${name}`);
    const differences = {};
    for (const key of ['x', 'y', 'width', 'height']) {
      if (!Number.isFinite(left[key]) || !Number.isFinite(right[key])) throw new Error(`Valor inválido: ${name}.${key}`);
      differences[key] = Math.round((right[key] - left[key]) * 1000) / 1000;
      if (Math.abs(differences[key]) > 2) failed = true;
    }
    console.log(`${name}: ${JSON.stringify(differences)}`);
  }
  // A escala deve ser conferida por quem gera as capturas, pois os relatórios não a certificam no Qt.
  console.log(`Área útil: Electron ${electron.page.width}x${electron.page.height}, Qt ${qt.viewport.width}x${qt.viewport.height}, diferença ${JSON.stringify(viewportDelta)}.`);
  console.log(`Escala Electron: ${electron.page.scale}; confirme a mesma escala no Qt.`);
  if (failed) process.exitCode = 1;
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
