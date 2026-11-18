// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import checkDist from "./src/lib/check-dist.mjs";
import legacyRedirects from "./src/lib/legacy-redirects.mjs";
import searchIndex from "./src/lib/search-index.mjs";

/** A built page's path: "https://archive.dailycal.org/a" -> "/a" */
const sitePath = (page) => new URL(page).pathname;

export default defineConfig({
  // Canonical links, social previews and the sitemap always point here, even in a PR preview
  site: "https://archive.dailycal.org",

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
      // /search is noindex. No <lastmod>: an issue's print date isn't when its page last changed,
      // and Google ignores lastmod it finds inaccurate.
      filter: (page) => sitePath(page) !== "/search",
    }),
    // The /search page's index; see src/lib/search-index.mjs
    searchIndex(),
    // 301s from the old archive site's URLs; see src/lib/legacy-redirects.mjs
    legacyRedirects(),
    // Fails the build if dist/ won't deploy to Cloudflare; see src/lib/check-dist.mjs. Keep it last.
    checkDist(),
  ],
});
