/* Compara dois PNGs pixel a pixel (proporção de pixels diferentes e média da diferença). */
const sharp = require('sharp');

async function load(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

(async () => {
  const [a, b] = process.argv.slice(2);
  const A = await load(a);
  const B = await load(b);
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    console.error(`tamanhos diferentes: ${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}`);
    process.exit(1);
  }
  const n = A.info.width * A.info.height;
  const chA = A.info.channels, chB = B.info.channels;
  let total = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const iA = i * chA, iB = i * chB;
    let d = 0;
    for (let c = 0; c < 3; c++) d += Math.abs(A.data[iA + c] - B.data[iB + c]);
    if (d > 0) { total++; sum += d; }
  }
  console.log(`pixels diferentes: ${total} de ${n} (${(100 * total / n).toFixed(2)}%)`);
  console.log(`soma média das diferenças (0-765): ${(sum / Math.max(1, total)).toFixed(2)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
