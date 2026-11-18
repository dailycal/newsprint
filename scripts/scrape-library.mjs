/**
 * Finds which issues the UC Berkeley Library has in its digital collections
 * (digicoll.lib.berkeley.edu), and records them in data/issues.csv's `library` column: the
 * library's record ID for each date, so the site can link to https://digicoll.lib.berkeley.edu/record/<id>.
 * Dates only the library has get a new row with no Google Drive `id`.
 *
 * Usage: npm run scrape-library
 *
 * For each collection in COLLECTIONS, it searches the library one year at a time (MARCXML, 200
 * records a request, only the fields needed), waiting DELAY_MS between requests as the library's
 * robots.txt asks (Crawl-Delay: 5). One year at a time because the search stops paging partway
 * through a large result: a search of the whole Daily Cal collection (about 19,800 records) ends
 * after about 5,200. It takes about 25 minutes. The `library` column is rebuilt from scratch each run; every
 * other column is kept as it is. Rows left with neither a Drive ID nor a library record are dropped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COLUMNS, parseCSV } from "../src/lib/issues.mjs";

const SEARCH = "https://digicoll.lib.berkeley.edu/search";
// The library's collections to search, by the name its search uses (`collection:'<name>'`)
// (There's no Berkeleyan collection: the library's Daily Cal collection starts in 1898.)
const COLLECTIONS = ["Daily Cal"];
const PAGE_SIZE = 200; // the most the search returns at once
// The years to search: the Daily Californian's first year through this one
const FIRST_YEAR = 1871;
const LAST_YEAR = new Date().getFullYear();
const DELAY_MS = 6000; // a little over robots.txt's Crawl-Delay of 5 seconds
const RETRIES = 3;
const CSV = resolve("data/issues.csv");

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** One page of a collection's records from one year, as MARCXML. */
async function fetchPage(collection, year, start) {
  const url = new URL(SEARCH);
  url.search = new URLSearchParams({
    p: `collection:'${collection}' AND year:${year}`,
    of: "xm", // MARCXML
    ot: "001,035,269", // record ID, identifier ("dailycal-YYYYMMDD"), date
    rg: String(PAGE_SIZE),
    jrec: String(start), // 1-based index of the first record
    ln: "en",
  }).toString();
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "dailycal-newsprint-scraper (+https://archives.dailycal.org)" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= RETRIES) throw new Error(`${url}: ${error.message}`, { cause: error });
      console.warn(`  ${error.message}; retrying in ${(DELAY_MS * attempt * 2) / 1000}s`);
      await sleep(DELAY_MS * attempt * 2);
    }
  }
}

/** The record ID and date ("YYYY-MM-DD") of each record in a page of MARCXML. */
function parseRecords(xml) {
  return [...xml.matchAll(/<record>([\s\S]*?)<\/record>/g)].map(([, record]) => {
    const id = record.match(/<controlfield tag="001">(\d+)<\/controlfield>/)?.[1];
    const field = (tag) =>
      record.match(
        new RegExp(`<datafield tag="${tag}"[^>]*>\\s*<subfield code="a">([^<]*)</subfield>`),
      )?.[1];
    // The date field, or else the date in an identifier like "dailycal-19640115"
    let date = field("269")
      ?.trim()
      .match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
    if (!date) {
      const digits = field("035")?.match(/(\d{4})(\d{2})(\d{2})$/);
      if (digits) date = `${digits[1]}-${digits[2]}-${digits[3]}`;
    }
    return { id, date };
  });
}

/** Every record in a collection, a year at a time. */
async function scrapeCollection(collection) {
  const records = [];
  const seen = new Set();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    let found = 0;
    for (let start = 1; ; start += PAGE_SIZE) {
      await sleep(DELAY_MS);
      const page = parseRecords(await fetchPage(collection, year, start));
      const fresh = page.filter(({ id }) => id && !seen.has(id));
      for (const { id } of fresh) seen.add(id);
      records.push(...fresh);
      found += fresh.length;
      // The last page is short; a page of records already seen means paging stopped advancing
      if (page.length < PAGE_SIZE || fresh.length === 0) break;
    }
    if (found) console.log(`  ${collection} ${year}: ${found} records (${records.length} in all)`);
  }
  return records;
}

/** A CSV cell, quoted when it has to be. */
const cell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// Each date's library record. When the library has more than one record for a date (a special
// edition, say), the lowest record ID is used.
const library = new Map();
let undated = 0;
let duplicates = 0;
for (const collection of COLLECTIONS) {
  console.log(`Searching the library's "${collection}" collection...`);
  const records = await scrapeCollection(collection);
  if (!records.length) {
    console.warn(`  No records found in "${collection}". Is that the collection's name?`);
  }
  for (const { id, date } of records) {
    if (!date) {
      undated++;
      continue;
    }
    const existing = library.get(date);
    if (existing) duplicates++;
    if (!existing || Number(id) < Number(existing)) library.set(date, id);
  }
}

// Merge into the CSV
const [header, ...rows] = parseCSV(readFileSync(CSV, "utf8"));
const oldColumns = header.map((name) => name.trim());
const byDate = new Map();
for (const cells of rows) {
  const row = Object.fromEntries(oldColumns.map((name, i) => [name, (cells[i] ?? "").trim()]));
  const date = [row.year, row.month.padStart(2, "0"), row.day.padStart(2, "0")].join("-");
  byDate.set(date, { ...row, library: "" });
}
let added = 0;
for (const [date, id] of library) {
  if (!byDate.has(date)) {
    const [year, month, day] = date.split("-").map(Number);
    byDate.set(date, { year, month, day, id: "", sponsor: "", note: "", library: "" });
    added++;
  }
  byDate.get(date).library = id;
}
const kept = [...byDate]
  .filter(([, row]) => row.id || row.library)
  .sort(([a], [b]) => a.localeCompare(b));
const both = kept.filter(([, row]) => row.id && row.library).length;
const libraryOnly = kept.filter(([, row]) => !row.id).length;
writeFileSync(
  CSV,
  [COLUMNS.join(","), ...kept.map(([, row]) => COLUMNS.map((name) => cell(row[name])).join(","))]
    .join("\n")
    .concat("\n"),
);

console.log(
  `\nThe library has ${library.size} dated issues (${duplicates} extra records for dates already` +
    ` found, ${undated} without a date were skipped).`,
);
console.log(
  `data/issues.csv now has ${kept.length} issues: ${both} here and at the library,` +
    ` ${libraryOnly} only at the library (${added} new), ${kept.length - both - libraryOnly} only here.`,
);
