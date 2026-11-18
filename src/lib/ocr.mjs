/**
 * The OCR text of every issue, from data/ocr.tar.gz (made by `npm run pack-ocr`). It's read once
 * per build, at build time only: the archive and the text files never ship to dist/, only the
 * pages and search index made from them.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

// From the project root (where astro runs): pages are bundled elsewhere, so import.meta.url won't do
const ARCHIVE = resolve("data/ocr.tar.gz");

/** @type {Map<string, string> | undefined} */
let cache;

/** A NUL-terminated ASCII field of a tar header. */
const field = (block, offset, length) =>
  block.toString("ascii", offset, offset + length).replace(/\0.*$/s, "");

/**
 * Every issue's text, keyed by its date as "YYYYMMDD". Empty if data/ocr.tar.gz doesn't exist yet.
 * @returns {Map<string, string>}
 */
export function ocrTexts() {
  if (cache) return cache;
  cache = new Map();
  if (!existsSync(ARCHIVE)) return cache;

  const tar = gunzipSync(readFileSync(ARCHIVE));
  for (let at = 0; at + 512 <= tar.length;) {
    const block = tar.subarray(at, at + 512);
    if (block.every((byte) => byte === 0)) break;
    const name = field(block, 345, 155)
      ? `${field(block, 345, 155)}/${field(block, 0, 100)}`
      : field(block, 0, 100);
    const size = parseInt(field(block, 124, 12).trim() || "0", 8);
    const type = field(block, 156, 1);
    const body = tar.subarray(at + 512, at + 512 + size);
    const date = name.match(/dailycal_(\d{8})_issue\.txt$/)?.[1];
    if ((type === "0" || type === "") && date) cache.set(date, body.toString("utf8"));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return cache;
}

/**
 * An issue's text, or "" if it has none.
 * @param {string} date "YYYYMMDD"
 */
export const ocrText = (date) => ocrTexts().get(date) ?? "";
