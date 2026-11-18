/**
 * `npm run pack-ocr [-- <folder>]`: packs the OCR text of every issue into data/ocr.tar.gz, which
 * the build reads (src/lib/ocr.mjs). The folder (default: ../newsprint-ocr) holds one
 * <year>/dailycal_YYYYMMDD_issue.txt per issue, as the OCR run wrote them.
 *
 * The archive is a plain .tar.gz (`tar -xzf data/ocr.tar.gz` unpacks it), written the same way
 * every time: files sorted by path, with no dates or owners, so repacking unchanged text gives an
 * identical file and git sees no change.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = resolve(process.argv[2] ?? join(root, "../newsprint-ocr"));
const output = join(root, "data/ocr.tar.gz");

const NAME = /^\d{4}\/dailycal_\d{8}_issue\.txt$/;

const files = readdirSync(source, { recursive: true })
  .map((path) => path.split("\\").join("/"))
  .filter((path) => NAME.test(path))
  .sort();
if (files.length === 0) {
  console.error(`No <year>/dailycal_YYYYMMDD_issue.txt files in ${source}`);
  process.exit(1);
}

/** Writes `value` into `header` at `offset` as ASCII, padded with NULs to `length`. */
function field(header, offset, length, value) {
  header.write(value, offset, Math.min(value.length, length), "ascii");
}

/** A ustar header for a regular file. */
function header(name, size) {
  const block = Buffer.alloc(512);
  field(block, 0, 100, name);
  field(block, 100, 8, "0000644\0");
  field(block, 108, 8, "0000000\0");
  field(block, 116, 8, "0000000\0");
  field(block, 124, 12, `${size.toString(8).padStart(11, "0")}\0`);
  field(block, 136, 12, "00000000000\0");
  field(block, 148, 8, "        ");
  field(block, 156, 1, "0");
  field(block, 257, 6, "ustar\0");
  field(block, 263, 2, "00");
  let sum = 0;
  for (const byte of block) sum += byte;
  field(block, 148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
  return block;
}

const parts = [];
let bytes = 0;
for (const name of files) {
  const data = readFileSync(join(source, name));
  bytes += data.length;
  parts.push(header(name, data.length), data, Buffer.alloc((512 - (data.length % 512)) % 512));
}
parts.push(Buffer.alloc(1024));

const gz = gzipSync(Buffer.concat(parts), { level: 9 });
writeFileSync(output, gz);
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
console.log(
  `Packed ${files.length} issues (${mb(bytes)} of text) from ${source} into ` +
    `${relative(process.cwd(), output)} (${mb(statSync(output).size)})`,
);
