/**
 * Every digitized issue, from data/issues.csv: one row per issue with its date, the ID of its PDF
 * in Google Drive, who sponsored its digitization (if anyone), and a note about anything odd (a
 * fragment, missing pages). Pages, the calendars, the sitemap and the search index are all built
 * from this list.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// From the project root (where astro runs): pages are bundled elsewhere, so import.meta.url won't do
const CSV = resolve("data/issues.csv");
const COLUMNS = ["year", "month", "day", "id", "sponsor", "note"];

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
 * @property {string} id Google Drive file ID of the issue's PDF
 * @property {string} sponsor who sponsored its digitization, or ""
 * @property {string} note a warning about the scan (e.g. missing pages), or ""
 * @property {string} key "YYYYMMDD", as in the PDF's and OCR text's file names
 * @property {string} iso "YYYY-MM-DD"
 * @property {string} path the issue's page, e.g. "/1964/november/12"
 * @property {string} label e.g. "Thursday, November 12, 1964"
 * @property {string} shortLabel e.g. "November 12, 1964"
 */

/** Splits CSV text (RFC 4180: quoted fields may hold commas, quotes and line breaks) into rows. */
function parseCSV(text) {
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
 * Every issue, oldest first. Throws, naming the row, if the CSV has a bad or repeated date.
 * @returns {Issue[]}
 */
export function getIssues() {
  if (cache) return cache;
  const [header, ...rows] = parseCSV(readFileSync(CSV, "utf8"));
  if (header.join(",") !== COLUMNS.join(",")) {
    throw new Error(`data/issues.csv's columns should be ${COLUMNS.join(",")}`);
  }
  const seen = new Set();
  cache = rows
    .map((cells, index) => {
      const [year, month, day] = cells.slice(0, 3).map(Number);
      const [id, sponsor, note] = cells.slice(3).map((cell) => (cell ?? "").trim());
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
      if (!/^[\w-]{20,}$/.test(id)) {
        throw new Error(`data/issues.csv line ${line}: "${id}" isn't a Google Drive file ID`);
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
 * The issues grouped by year, then month: Map<year, Map<month, Issue[]>>, in order.
 * @returns {Map<number, Map<number, Issue[]>>}
 */
export function issuesByMonth() {
  const years = new Map();
  for (const issue of getIssues()) {
    if (!years.has(issue.year)) years.set(issue.year, new Map());
    const months = years.get(issue.year);
    if (!months.has(issue.month)) months.set(issue.month, []);
    months.get(issue.month).push(issue);
  }
  return years;
}

/** The PDF in Google Drive's viewer, for an <iframe> */
export const drivePreviewURL = (issue) => `https://drive.google.com/file/d/${issue.id}/preview`;
/** The PDF's page in Google Drive */
export const driveViewURL = (issue) => `https://drive.google.com/file/d/${issue.id}/view`;
/** A direct download of the PDF */
export const driveDownloadURL = (issue) =>
  `https://drive.google.com/uc?export=download&id=${issue.id}`;
