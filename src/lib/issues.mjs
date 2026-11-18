/**
 * Every known issue, from data/issues.csv: one row per issue with its date, the ID of its PDF in
 * Google Drive (if we have a scan), who sponsored its digitization (if anyone), a note about
 * anything odd (a fragment, missing pages), and its record in the UC Berkeley Library's digital
 * collections (if the library has it; filled in by scripts/scrape-library.mjs). Issues we have
 * scanned get their own pages; issues only the library has are linked to from the calendars.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// From the project root (where astro runs): pages are bundled elsewhere, so import.meta.url won't do
const CSV = resolve("data/issues.csv");
export const COLUMNS = ["year", "month", "day", "id", "sponsor", "note", "library"];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The month in URLs: 11 -> "november" */
export const monthSlug = (month) => MONTHS[month - 1].toLowerCase();

/** "november" -> 11, or undefined */
export const monthFromSlug = (slug) => {
  const index = MONTHS.findIndex((name) => name.toLowerCase() === slug);
  return index === -1 ? undefined : index + 1;
};

/**
 * @typedef {object} Issue
 * @property {number} year
 * @property {number} month 1-12
 * @property {number} day
 * @property {string} id Google Drive file ID of the issue's PDF, or "" if only the library has it
 * @property {string} sponsor who sponsored its digitization, or ""
 * @property {string} note a warning about the scan (e.g. missing pages), or ""
 * @property {string} library the issue's record ID in the UC Berkeley Library's digital
 *   collections, or ""
 * @property {string} libraryURL the library's page for the issue, or ""
 * @property {string} key "YYYYMMDD", as in the PDF's and OCR text's file names
 * @property {string} iso "YYYY-MM-DD"
 * @property {string} path the issue's page, e.g. "/1964/november/12" (only issues with an `id`
 *   have one)
 * @property {string} label e.g. "Thursday, November 12, 1964"
 * @property {string} shortLabel e.g. "November 12, 1964"
 */

/** Splits CSV text (RFC 4180: quoted fields may hold commas, quotes and line breaks) into rows. */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        value += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(value);
      value = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += c;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

/** @type {Issue[] | undefined} */
let cache;

/**
 * Every issue we have a scan of (and so a page for), oldest first.
 * @returns {Issue[]}
 */
export const getIssues = () => getAllIssues().filter((issue) => issue.id);

/**
 * Every issue in the CSV, oldest first, including those only the library has. Throws, naming the
 * row, if the CSV has a bad or repeated date, or a bad ID.
 * @returns {Issue[]}
 */
export function getAllIssues() {
  if (cache) return cache;
  const [header, ...rows] = parseCSV(readFileSync(CSV, "utf8"));
  if (header.join(",") !== COLUMNS.join(",")) {
    throw new Error(`data/issues.csv's columns should be ${COLUMNS.join(",")}`);
  }
  const seen = new Set();
  cache = rows
    .map((cells, index) => {
      const [year, month, day] = cells.slice(0, 3).map(Number);
      const [id, sponsor, note, library] = cells.slice(3).map((cell) => (cell ?? "").trim());
      const date = new Date(Date.UTC(year, month - 1, day));
      const line = index + 2;
      if (
        !Number.isInteger(year) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        throw new Error(
          `data/issues.csv line ${line}: ${cells.slice(0, 3).join("-")} isn't a date`,
        );
      }
      if (id && !/^[\w-]{20,}$/.test(id)) {
        throw new Error(`data/issues.csv line ${line}: "${id}" isn't a Google Drive file ID`);
      }
      if (library && !/^\d+$/.test(library)) {
        throw new Error(`data/issues.csv line ${line}: "${library}" isn't a library record ID`);
      }
      if (!id && !library) {
        throw new Error(`data/issues.csv line ${line}: needs an id, a library record, or both`);
      }
      const iso = date.toISOString().slice(0, 10);
      if (seen.has(iso)) throw new Error(`data/issues.csv line ${line}: ${iso} is listed twice`);
      seen.add(iso);
      const shortLabel = `${MONTHS[month - 1]} ${day}, ${year}`;
      return {
        year,
        month,
        day,
        id,
        sponsor,
        note,
        library,
        libraryURL: library ? `https://digicoll.lib.berkeley.edu/record/${library}` : "",
        key: iso.replaceAll("-", ""),
        iso,
        path: `/${year}/${monthSlug(month)}/${day}`,
        label: `${weekday.format(date)}, ${shortLabel}`,
        shortLabel,
      };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));
  return cache;
}

/**
 * Every issue, including those only the library has, grouped by year, then month:
 * Map<year, Map<month, Issue[]>>, in order.
 * @returns {Map<number, Map<number, Issue[]>>}
 */
export function issuesByMonth() {
  const years = new Map();
  for (const issue of getAllIssues()) {
    if (!years.has(issue.year)) years.set(issue.year, new Map());
    const months = years.get(issue.year);
    if (!months.has(issue.month)) months.set(issue.month, []);
    months.get(issue.month).push(issue);
  }
  return years;
}

/**
 * How many of some issues are scanned here and how many are only at the library, e.g.
 * "12 scanned here, 3 at the UC Berkeley Library".
 * @param {Issue[]} issues
 */
export function countSummary(issues) {
  const scanned = issues.filter((issue) => issue.id).length;
  const atLibrary = issues.length - scanned;
  return [
    scanned && `${scanned.toLocaleString("en-US")} scanned here`,
    atLibrary && `${atLibrary.toLocaleString("en-US")} at the UC Berkeley Library`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The PDF in Google Drive's viewer, for an <iframe> */
export const drivePreviewURL = (issue) => `https://drive.google.com/file/d/${issue.id}/preview`;
/** The PDF's page in Google Drive */
export const driveViewURL = (issue) => `https://drive.google.com/file/d/${issue.id}/view`;
/** A direct download of the PDF */
export const driveDownloadURL = (issue) =>
  `https://drive.google.com/uc?export=download&id=${issue.id}`;
