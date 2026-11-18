/**
 * Builds the site's search index (with Pagefind) at the end of `astro build`, into dist/pagefind/,
 * which the /search page loads.
 *
 * It doesn't crawl the built pages. Each issue is one record made straight from data/issues.csv
 * and its OCR text (data/ocr.tar.gz): the issue's date (so "November 1964" finds it), its sponsor,
 * then the full text of every page. The /search page leaves the date and sponsor out of the
 * passage it shows with each result, since it shows them above the passage already.
 *
 * In `npm run dev`, /pagefind/ is served from the last build's dist/pagefind/ (if there is one), so
 * search works in the dev server too once the site has been built.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import * as pagefind from "pagefind";
import { getIssues } from "./issues.mjs";
import { ocrText } from "./ocr.mjs";

/** The words searched before an issue's text, which results don't repeat in their passage. */
export const recordPrefix = (issue) =>
  issue.sponsor ? `${issue.label}. Sponsored by ${issue.sponsor}.` : `${issue.label}.`;

const TYPES = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

/** @returns {import("astro").AstroIntegration} */
export default function searchIndex() {
  let distDir;
  return {
    name: "search-index",
    hooks: {
      "astro:config:done": ({ config }) => {
        distDir = fileURLToPath(config.outDir);
      },

      "astro:server:setup": ({ server, logger }) => {
        const root = join(distDir, "pagefind");
        if (!existsSync(root)) {
          logger.warn(
            "Search needs a search index: run `npm run build`, then restart the dev server.",
          );
        }
        server.middlewares.use("/pagefind", (req, res, next) => {
          const path = normalize(
            join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)),
          );
          if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile())
            return next();
          res.setHeader("Content-Type", TYPES[extname(path)] ?? "application/octet-stream");
          createReadStream(path).pipe(res);
        });
      },

      "astro:build:done": async ({ dir, logger }) => {
        const issues = getIssues();
        const { index, errors } = await pagefind.createIndex({ forceLanguage: "en" });
        if (!index) throw new Error(`Pagefind: ${errors.join(", ")}`);

        let withText = 0;
        for (const issue of issues) {
          const text = ocrText(issue.key);
          if (text.trim()) withText++;
          const added = await index.addCustomRecord({
            url: issue.path,
            content: `${recordPrefix(issue)}\n${text}`,
            language: "en",
            meta: {
              title: issue.label,
              sponsor: issue.sponsor,
              note: issue.note,
              // How many words the passage shown with a result skips (see recordPrefix)
              skip: String(recordPrefix(issue).split(/\s+/).filter(Boolean).length),
            },
            filters: {
              decade: [`${Math.floor(issue.year / 10) * 10}s`],
              year: [String(issue.year)],
            },
            sort: { date: issue.iso },
          });
          if (added.errors.length) throw new Error(`Pagefind: ${added.errors.join(", ")}`);
        }

        const written = await index.writeFiles({
          outputPath: fileURLToPath(new URL("pagefind", dir)),
        });
        if (written.errors.length) throw new Error(`Pagefind: ${written.errors.join(", ")}`);
        await pagefind.close();

        if (withText < issues.length) {
          logger.warn(
            `${issues.length - withText} of ${issues.length} issues have no OCR text in data/ocr.tar.gz, so they're only searchable by date and sponsor. Run \`npm run pack-ocr\` once the OCR is done.`,
          );
        }
        logger.info(`Indexed ${issues.length} issues for search (${withText} with their text).`);
      },
    },
  };
}
