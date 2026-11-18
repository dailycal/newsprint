// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import checkDist from "./src/lib/check-dist.mjs";
import { getAllIssues, monthSlug } from "./src/lib/issues.mjs";
import searchIndex from "./src/lib/search-index.mjs";

/** A built page's path: "https://archives.dailycal.org/a" -> "/a" */
const sitePath = (page) => new URL(page).pathname;

// Year and month pages with none of our scans (only links to the UC Berkeley Library) are noindex,
// so they're left out of the sitemap too
const scannedPeriods = new Set(
  getAllIssues()
    .filter((issue) => issue.id)
    .flatMap((issue) => [`/${issue.year}`, `/${issue.year}/${monthSlug(issue.month)}`]),
);
const libraryOnlyPeriods = new Set(
  getAllIssues()
    .flatMap((issue) => [`/${issue.year}`, `/${issue.year}/${monthSlug(issue.month)}`])
    .filter((path) => !scannedPeriods.has(path)),
);

export default defineConfig({
  // Canonical links, social previews and the sitemap always point here, even in a PR preview
  site: "https://archives.dailycal.org",

  // Pages have no trailing slash: /1964/november/12, built as 1964/november/12.html (Cloudflare
  // serves it there, and redirects /1964/november/12/ to it)
  trailingSlash: "never",
  build: {
    format: "file",
  },

  devToolbar: {
    enabled: false,
  },

  integrations: [
    sitemap({
      // /search and library-only years and months are noindex. No <lastmod>: an issue's print date
      // isn't when its page last changed, and Google ignores lastmod it finds inaccurate.
      filter: (page) => sitePath(page) !== "/search" && !libraryOnlyPeriods.has(sitePath(page)),
    }),
    // The /search page's index; see src/lib/search-index.mjs
    searchIndex(),
    // Fails the build if dist/ won't deploy to Cloudflare; see src/lib/check-dist.mjs. Keep it last.
    checkDist(),
  ],
});
