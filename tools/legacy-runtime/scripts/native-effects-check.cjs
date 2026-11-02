/**
 * Compara efeitos (blur, sombras e escurecimento) em regiões sem texto entre
 * capturas Electron e Qt da mesma fixture. Mede somente o que a referência
 * permite medir: média por canal, desvio e energia de borda.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

/** Regiões em pixels da captura, escolhidas para excluir textos e ícones. */
const REGIONS = {
  library: {
    'sidebar-sombra': { left: 241, top: 400, width: 38, height: 380 },
    'topbar-sombra': { left: 700, top: 53, width: 320, height: 16 },
    /* O primeiro card mede 188 × 230 em 1106 px de largura (breakpoint do CSS). */
    'card-sombra-direita': { left: 560, top: 180, width: 22, height: 120 },
    'card-sombra-base': { left: 420, top: 347, width: 100, height: 22 },
  },
  modal: {
    /* O modal de 960 px deixa apenas as faixas laterais/topo da superfície visíveis. */
    'backdrop-esquerda': { left: 0, top: 300, width: 71, height: 300 },
    'backdrop-topo': { left: 620, top: 0, width: 300, height: 118 },
  },
};

/** Extrai os canais RGB de uma região e resume cor e nitidez. */
async function regionStats(file, region) {
  const { data, info } = await sharp(file)
    .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let sum = [0, 0, 0];
  let edge = 0;
  let edgeCount = 0;
  for (let y = 0; y < info.height; ++y) {
    for (let x = 0; x < info.width; ++x) {
      const index = (y * info.width + x) * channels;
      for (let c = 0; c < 3; ++c) sum[c] += data[index + c];
      // A diferença entre vizinhos mede a nitidez: blur reduz a energia de borda.
      if (x + 1 < info.width) {
        const next = index + channels;
        for (let c = 0; c < 3; ++c) edge += Math.abs(data[index + c] - data[next + c]);
        edgeCount += 3;
      }
    }
  }
  const pixels = info.width * info.height;
  return {
    mean: sum.map((value) => Math.round((value / pixels) * 100) / 100),
    edgeEnergy: edgeCount ? Math.round((edge / edgeCount) * 100) / 100 : 0,
    width: info.width,
    height: info.height,
  };
}

/** Diferença média absoluta por canal entre duas capturas na mesma região. */
async function meanDifference(leftFile, rightFile, region) {
  const load = (file) => sharp(file).extract({ left: region.left, top: region.top, width: region.width, height: region.height }).removeAlpha().raw().toBuffer();
  const [left, right] = await Promise.all([load(leftFile), load(rightFile)]);
  if (left.length !== right.length) throw new Error('Regiões com dimensões diferentes.');
  let total = 0;
  for (let index = 0; index < left.length; ++index) total += Math.abs(left[index] - right[index]);
  return Math.round((total / left.length) * 1000) / 1000;
}

async function main() {
  const [electronFile, qtFile, qtNoBlurFile, outputFile, group = 'library'] = process.argv.slice(2);
  if (!electronFile || !qtFile) {
    throw new Error('Uso: node scripts/native-effects-check.cjs <electron.png> <qt.png> [qt-sem-blur.png] [saida.json] [library|modal]');
  }
  const regions = REGIONS[group];
  if (!regions) throw new Error(`Grupo de regiões desconhecido: ${group}`);
  const report = { electron: path.basename(electronFile), qt: path.basename(qtFile), group, regions: {} };
  for (const [name, region] of Object.entries(regions)) {
    const entry = { region, electron: await regionStats(electronFile, region), qt: await regionStats(qtFile, region) };
    entry.meanDifference = await meanDifference(electronFile, qtFile, region);
    if (qtNoBlurFile) {
      entry.qtNoBlur = await regionStats(qtNoBlurFile, region);
      entry.blurDelta = Math.round((entry.qtNoBlur.edgeEnergy - entry.qt.edgeEnergy) * 100) / 100;
    }
    report.regions[name] = entry;
    const delta = entry.meanDifference.toFixed(2).padStart(6);
    console.log(`${name.padEnd(22)} MAD ${delta}  nitidez Electron ${entry.electron.edgeEnergy.toFixed(2)}  Qt ${entry.qt.edgeEnergy.toFixed(2)}`);
  }
  const json = JSON.stringify(report, null, 2);
  if (outputFile) fs.writeFileSync(outputFile, json);
  console.log(json);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
