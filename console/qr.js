// A QR code, drawn without a dependency.
//
// A linked Console device shows one square that a phone's camera can read (Devices, "Link
// another device"), so that linking a new one is "point the phone at the screen" rather than
// "type a code with no 0/O in it". That is
// worth about three hundred lines; it is not worth an npm package in a build that ships unpacked
// and is signed, nor a request to a "QR generator" website with the owner's link in the query
// string. So this is an original implementation of ISO/IEC 18004, cut down to exactly what the
// link needs and no further:
//
//   * BYTE mode only. The payload is a URL.
//   * error correction level M (~15%). A screen is a clean surface; L would be enough and M
//     costs nothing here.
//   * versions 1 to 10, which is up to 213 bytes - the link is about 55.
//
// Everything below is the standard's own arithmetic: a Galois field over 0x11D, Reed-Solomon
// remainders, the interleave, the eight masks and the penalty score that picks between them.
// console-app/tests/qr.test.mjs reads a finished symbol back out with the standard's own reading
// procedure and gets the original string, and checks each block is a real Reed-Solomon codeword - which is
// the pair of facts that would fail if any of the placement were subtly wrong.

export const EC_LEVEL = 'M';
export const MIN_VERSION = 1;
export const MAX_VERSION = 10;

/**
 * For level M, version 1..10: [error-correction codewords per block, blocks in group 1, data
 * codewords per block in group 1, blocks in group 2]. Group 2's blocks hold exactly one codeword
 * more than group 1's - that is how the standard splits an uneven total.
 */
const BLOCKS_M = {
  1: [10, 1, 16, 0],
  2: [16, 1, 28, 0],
  3: [26, 1, 44, 0],
  4: [18, 2, 32, 0],
  5: [24, 2, 43, 0],
  6: [16, 4, 27, 0],
  7: [18, 4, 31, 0],
  8: [22, 2, 38, 2],
  9: [22, 3, 36, 2],
  10: [26, 4, 43, 1],
};

/** Bits of padding after the last codeword, by version. */
const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

export const sizeOf = (version) => version * 4 + 17;

/** How many data codewords a version holds at level M. */
export function dataCodewords(version) {
  const [ec, n1, d1, n2] = BLOCKS_M[version];
  return n1 * d1 + n2 * (d1 + 1);
}

/** How many bytes of payload fit, allowing for the mode and the length field. */
export function capacity(version) {
  const countBits = version >= 10 ? 16 : 8;
  return Math.floor((dataCodewords(version) * 8 - 4 - countBits) / 8);
}

export function versionFor(byteLength) {
  for (let v = MIN_VERSION; v <= MAX_VERSION; v += 1) if (byteLength <= capacity(v)) return v;
  throw new Error(`That is too long for a QR code this size (${byteLength} bytes; the most is ${capacity(MAX_VERSION)}).`);
}

// ---- GF(2^8), the field the error correction lives in -------------------------------------------

/** Russian-peasant multiplication modulo x^8 + x^4 + x^3 + x^2 + 1 (0x11D). */
export function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** The generator polynomial's coefficients for `degree` error-correction codewords. */
export function rsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

/** The remainder of `data` divided by `divisor` - the error-correction codewords themselves. */
export function rsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i += 1) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ---- the bit stream ------------------------------------------------------------------------------

/** Mode 0100, the length, the bytes, a terminator, then the standard's own padding. */
export function encodeBytes(bytes, version) {
  const bits = [];
  const push = (value, n) => { for (let i = n - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  const capacityBits = dataCodewords(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  // 236, 17, 236, 17 … is the standard's filler, and it is deliberately not zeros: a long run of
  // one value would make the mask's job harder and the penalty score worse.
  for (let pad = 0xec; out.length < dataCodewords(version); pad ^= 0xec ^ 0x11) out.push(pad);
  return Uint8Array.from(out);
}

/** Split into blocks, add each block's remainder, then interleave the lot. */
export function addEccAndInterleave(data, version) {
  const [ecLen, n1, d1, n2] = BLOCKS_M[version];
  const divisor = rsDivisor(ecLen);
  const blocks = [];
  let at = 0;
  for (let i = 0; i < n1 + n2; i += 1) {
    const len = i < n1 ? d1 : d1 + 1;
    const chunk = data.slice(at, at + len);
    at += len;
    blocks.push({ data: chunk, ecc: rsRemainder(chunk, divisor) });
  }
  const out = [];
  const longest = d1 + (n2 ? 1 : 0);
  for (let i = 0; i < longest; i += 1) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i += 1) for (const b of blocks) out.push(b.ecc[i]);
  return { codewords: Uint8Array.from(out), blocks };
}

// ---- the symbol ------------------------------------------------------------------------------------

/** Where the alignment patterns' centers are, for this version. */
export function alignmentCentres(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = sizeOf(version) - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

const bitAt = (value, i) => ((value >>> i) & 1) !== 0;

/**
 * The whole symbol. -> { version, size, modules (boolean[size][size], [row][col]), mask }
 * `mask` may be forced for a test; left out, all eight are scored and the best is kept.
 */
export function encode(text, { mask = null } = {}) {
  const bytes = new TextEncoder().encode(String(text));
  const version = versionFor(bytes.length);
  const size = sizeOf(version);
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };

  // The two timing lines FIRST, then the finders over the top of them. That order is not a
  // preference: row 6 and column 6 run straight through each finder's outer ring, so drawing the
  // timing last would punch alternating holes in all three finders. The symbol would still decode
  // in a test that knew where to look, and no camera would ever find it.
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // finders, and the blank ring around each of them
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  // alignment patterns, except where a finder already is
  const centres = alignmentCentres(version);
  for (let i = 0; i < centres.length; i += 1) {
    for (let j = 0; j < centres.length; j += 1) {
      if ((i === 0 && j === 0) || (i === 0 && j === centres.length - 1) || (i === centres.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(centres[j] + dx, centres[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  // the format area is reserved before the data is laid down, and filled in afterwards
  drawFormat(set, size, 0);
  if (version >= 7) drawVersion(set, size, version);

  // the data, in the standard's zigzag: two columns at a time, right to left, skipping column 6
  const { codewords } = addEccAndInterleave(encodeBytes(bytes, version), version);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < codewords.length * 8) {
          modules[y][x] = bitAt(codewords[i >>> 3], 7 - (i & 7));
          i += 1;
        }
      }
    }
  }
  // (the remainder bits are already false, which is what the standard asks for)

  const chosen = mask == null ? bestMask(modules, isFunction, size) : mask;
  applyMask(modules, isFunction, size, chosen);
  drawFormat((x, y, dark) => { modules[y][x] = dark; }, size, formatBits(chosen));
  return { version, size, modules, mask: chosen, remainder: REMAINDER_BITS[version] };
}

/** 15 bits: two for the level (M = 00), three for the mask, ten of BCH, XORed with 0x5412. */
export function formatBits(mask) {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormat(set, size, bits) {
  for (let i = 0; i <= 5; i += 1) set(8, i, bitAt(bits, i));
  set(8, 7, bitAt(bits, 6));
  set(8, 8, bitAt(bits, 7));
  set(7, 8, bitAt(bits, 8));
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, bitAt(bits, i));
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bitAt(bits, i));
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bitAt(bits, i));
  set(8, size - 8, true);                               // the module that is always dark
}

function drawVersion(set, size, version) {
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i += 1) {
    const dark = bitAt(bits, i);
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    set(a, b, dark);
    set(b, a, dark);
  }
}

export function maskAt(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
  }
}

function applyMask(modules, isFunction, size, mask) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) if (!isFunction[y][x] && maskAt(mask, x, y)) modules[y][x] = !modules[y][x];
  }
}

/** The standard's four penalties: runs, blocks, finder look-alikes, and the light/dark balance. */
export function penalty(modules, size) {
  let score = 0;
  const run = (line) => {
    let n = 1;
    for (let i = 1; i < size; i += 1) {
      if (line[i] === line[i - 1]) { n += 1; if (n === 5) score += 3; else if (n > 5) score += 1; }
      else n = 1;
    }
  };
  for (let y = 0; y < size; y += 1) run(modules[y]);
  for (let x = 0; x < size; x += 1) run(modules.map((row) => row[x]));
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const v = modules[y][x];
      if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) score += 3;
    }
  }
  const FINDER = [true, false, true, true, true, false, true];
  const looksLikeFinder = (line, at) => {
    for (let i = 0; i < 7; i += 1) if (line[at + i] !== FINDER[i]) return false;
    const before = line.slice(Math.max(0, at - 4), at);
    const after = line.slice(at + 7, at + 11);
    return (before.length === 4 && before.every((m) => !m)) || (after.length === 4 && after.every((m) => !m));
  };
  for (let i = 0; i < size; i += 1) {
    const row = modules[i];
    const col = modules.map((r) => r[i]);
    for (let at = 0; at + 7 <= size; at += 1) {
      if (looksLikeFinder(row, at)) score += 40;
      if (looksLikeFinder(col, at)) score += 40;
    }
  }
  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark += 1;
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

function bestMask(modules, isFunction, size) {
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(modules, isFunction, size, mask);
    drawFormat((x, y, dark) => { modules[y][x] = dark; }, size, formatBits(mask));
    const score = penalty(modules, size);
    applyMask(modules, isFunction, size, mask);            // XOR again: back to where it was
    if (score < bestScore) { bestScore = score; best = mask; }
  }
  return best;
}

// ---- on screen ------------------------------------------------------------------------------------

/**
 * One <svg> string: a light square with dark ones on it, and the four-module quiet zone the
 * standard asks for. One path for every dark module rather than one rect each, so a version-10
 * symbol is one element instead of three thousand.
 */
export function toSvg(text, { scale = 4, quiet = 4, dark = '#000000', light = '#FFFFFF', title = '' } = {}) {
  const { modules, size } = encode(text);
  const span = size + quiet * 2;
  let path = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) if (modules[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" width="${span * scale}" height="${span * scale}" shape-rendering="crispEdges" role="img"`,
    title ? ` aria-label="${String(title).replace(/[&<>"]/g, '')}">` : ' aria-hidden="true">',
    `<rect width="${span}" height="${span}" fill="${light}"/>`,
    `<path d="${path}" fill="${dark}"/>`,
    '</svg>',
  ].join('');
}
