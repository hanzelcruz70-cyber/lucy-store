/* Genera icono de TIENDA (fachada con toldo) en PNG puro: 512, 192, 32 (favicon)
   Paleta Mi Prenda: fondo rosa #E040A0, tienda blanca, sin dependencias externas */
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibDeflate(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function zlibDeflate(data) {
  // deflate crudo (stored) con header/zlib mínimo: válido y compatible
  const blocks = [];
  const CHUNK = 65535;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, Math.min(i + CHUNK, data.length));
    const isLast = i + CHUNK >= data.length ? 1 : 0;
    const hdr = Buffer.alloc(5);
    hdr[0] = isLast;
    hdr.writeUInt16LE(slice.length & 0xffff, 1);
    hdr.writeUInt16LE(~slice.length & 0xffff, 3);
    blocks.push(Buffer.concat([hdr, slice]));
  }
  const adler = Buffer.alloc(4);
  let a = 1, b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const val = ((b % 65536) * 65536 + (a % 65536)) >>> 0;
  adler.writeUInt32BE(val, 0);
  return Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, adler]);
}

// ===== DIBUJO: tienda (fachada + toldo) sobre fondo rosa redondeado =====
function drawIcon(S) {
  const px = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    // alpha-blend
    const sa = a / 255;
    const da = px[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa);
    px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa);
    px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa);
    px[i + 3] = Math.round(oa * 255);
  };
  const PINK = [224, 64, 160];
  const WHITE = [255, 255, 255];
  const DARK = [25, 1, 12];

  const u = S / 100; // unidad
  const R = 22 * u; // radio esquina fondo

  // Fondo rosa redondeado
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // dentro del rounded-rect?
      const cx = Math.min(Math.max(x, R), S - R);
      const cy = Math.min(Math.max(y, R), S - R);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= R * R || (x >= R && x < S - R) || (y >= R && y < S - R)) {
        // esquinas del rounded rect
        const inX = x >= R && x < S - R;
        const inY = y >= R && y < S - R;
        if (inX || inY || dx * dx + dy * dy <= R * R) {
          set(x, y, ...PINK, 255);
        }
      }
    }
  }

  const px1 = (v) => Math.round(v * u);

  // Toldo: franja ondulada arriba de la tienda (y: 22..40), con festones
  const awningTop = px1(22), awningBottom = px1(42);
  const left = px1(20), right = px1(80);
  const scallopW = (right - left) / 5;
  for (let y = awningTop; y < awningBottom; y++) {
    for (let x = left; x < right; x++) {
      // festones: semicírculos hacia abajo en el borde inferior
      const seg = Math.floor((x - left) / scallopW);
      const segCenter = left + seg * scallopW + scallopW / 2;
      const localY = awningBottom - y;
      if (y < awningBottom - scallopW / 2 || Math.sqrt((x - segCenter) ** 2 + (localY - scallopW / 2) ** 2) <= scallopW / 2) {
        // franjas rosa-blanco alternadas... toldo BLANCO con franjas rosas oscuras
        const stripe = Math.floor((x - left) / (scallopW / 2.5)) % 2 === 0;
        if (stripe) set(x, y, ...WHITE, 255);
        else set(x, y, 244, 204, 217, 255); // rosa claro
      }
    }
  }

  // Cuerpo de la tienda (blanco): y 42..78
  const bodyTop = px1(42), bodyBottom = px1(78);
  for (let y = bodyTop; y < bodyBottom; y++) {
    for (let x = left; x < right; x++) set(x, y, ...WHITE, 255);
  }

  // Puerta (rosa oscuro) centrada
  const doorW = px1(14), doorH = px1(24);
  const doorX1 = Math.round(S / 2 - doorW / 2), doorX2 = Math.round(S / 2 + doorW / 2);
  const doorY1 = bodyBottom - doorH, doorY2 = bodyBottom;
  for (let y = doorY1; y < doorY2; y++) {
    for (let x = doorX1; x < doorX2; x++) set(x, y, 149, 41, 100, 255);
  }
  // manija de la puerta
  for (let y = doorY1 + px1(10); y < doorY1 + px1(13); y++) {
    for (let x = doorX2 - px1(4); x < doorX2 - px1(2); x++) set(x, y, ...WHITE, 255);
  }

  // Ventanas a los lados (contorno rosa oscuro)
  const winW = px1(12), winH = px1(12);
  const winY1 = bodyTop + px1(6);
  [[left + px1(6)], [right - px1(6) - winW]].forEach(([wx]) => {
    for (let y = winY1; y < winY1 + winH; y++) {
      for (let x = wx; x < wx + winW; x++) {
        // marco de 2px
        const border = y < winY1 + px1(2) || y >= winY1 + winH - px1(2) || x < wx + px1(2) || x >= wx + winW - px1(2);
        if (border) set(x, y, 149, 41, 100, 255);
        else set(x, y, 244, 204, 217, 255);
      }
    }
  });

  return px;
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [512, 192, 32]) {
  const buf = png(size, size, drawIcon(size));
  const name = size === 32 ? 'favicon.png' : `icon-${size}.png`;
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`${name}: ${buf.length} bytes`);
}
// Maskable: mismo dibujo con más padding (la zona segura de Android recorta bordes)
for (const size of [512, 192]) {
  const px = drawIcon(size);
  fs.writeFileSync(path.join(outDir, `icon-maskable-${size}.png`), png(size, size, px));
  console.log(`icon-maskable-${size}.png generado`);
}
console.log('Iconos de tienda generados en public/icons/');
