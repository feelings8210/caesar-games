/* Minimal PNG read/write for 8-bit RGBA, non-interlaced.
 * Enough to composite the CD mark onto solid icon canvases without pulling in
 * an image library. */

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** @returns {{width:number,height:number,data:Buffer}} RGBA */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  let palette = null, trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
      if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} not supported`);
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colour type ${colorType} not supported`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const row = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 0xff;
    }
  }

  // Normalise to RGBA
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    let r, g, b, a = 255;
    if (colorType === 6) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; a = out[i * 4 + 3]; }
    else if (colorType === 2) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2]; }
    else if (colorType === 0) { r = g = b = out[i]; }
    else if (colorType === 4) { r = g = b = out[i * 2]; a = out[i * 2 + 1]; }
    else { const p = out[i]; r = palette[p * 3]; g = palette[p * 3 + 1]; b = palette[p * 3 + 2]; if (trns && p < trns.length) a = trns[p]; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }

  return { width, height, data: rgba };
}

export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                                  // filter: None
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, body])));
    return Buffer.concat([len, t, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Area-average resample. Good quality for the large downscales we do here. */
export function resize(img, dstW, dstH) {
  const { width: sw, height: sh, data: src } = img;
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xr = sw / dstW, yr = sh / dstH;

  for (let y = 0; y < dstH; y++) {
    const y0 = Math.floor(y * yr), y1 = Math.min(sh, Math.max(y0 + 1, Math.ceil((y + 1) * yr)));
    for (let x = 0; x < dstW; x++) {
      const x0 = Math.floor(x * xr), x1 = Math.min(sw, Math.max(x0 + 1, Math.ceil((x + 1) * xr)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * sw + sx) * 4;
        const al = src[i + 3] / 255;
        r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += src[i + 3];
        n++;
      }
      const o = (y * dstW + x) * 4;
      const alphaAvg = a / n;
      const w = alphaAvg > 0 ? (alphaAvg / 255) * n : 1;
      dst[o] = Math.round(r / w); dst[o + 1] = Math.round(g / w); dst[o + 2] = Math.round(b / w);
      dst[o + 3] = Math.round(alphaAvg);
    }
  }
  return { width: dstW, height: dstH, data: dst };
}

export function solid(width, height, [r, g, b]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** Alpha-composite `top` onto `base` at (ox, oy), optionally re-tinting it. */
export function composite(base, top, ox, oy, tint = null) {
  for (let y = 0; y < top.height; y++) {
    const by = oy + y;
    if (by < 0 || by >= base.height) continue;
    for (let x = 0; x < top.width; x++) {
      const bx = ox + x;
      if (bx < 0 || bx >= base.width) continue;
      const ti = (y * top.width + x) * 4;
      const bi = (by * base.width + bx) * 4;
      const a = top.data[ti + 3] / 255;
      if (a === 0) continue;
      const sr = tint ? tint[0] : top.data[ti];
      const sg = tint ? tint[1] : top.data[ti + 1];
      const sb = tint ? tint[2] : top.data[ti + 2];
      base.data[bi] = Math.round(sr * a + base.data[bi] * (1 - a));
      base.data[bi + 1] = Math.round(sg * a + base.data[bi + 1] * (1 - a));
      base.data[bi + 2] = Math.round(sb * a + base.data[bi + 2] * (1 - a));
      base.data[bi + 3] = 255;
    }
  }
  return base;
}

export const hex = (h) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
