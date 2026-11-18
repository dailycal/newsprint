# Newsprint

Source for [archives.dailycal.org](https://archives.dailycal.org/): The Daily Californian's print archive. Every digitized issue has its own page, with the scan (a PDF in Google Drive) and the full text of every page, and the whole archive is searchable.

## Install, build, deploy

**Requirements:** Node >=22.12.0.

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at `http://localhost:4321`. Search uses the last build's index, so run `npm run build` first. |
| `npm run build` | Build the static site, with its search index, to `dist/` |
| `npm run preview` | Serve the built `dist/` locally, to check the real production output |
| `npm run lint` | Check code style with ESLint and Prettier |
| `npm run lint:fix` | Fix ESLint and Prettier style errors |
| `npm run pack-ocr [-- <folder>]` | Pack the OCR text into `data/ocr.tar.gz` (see [Data](#data)) |
| `npm run scrape-library` | Update `data/issues.csv`'s `library` column from the UC Berkeley Library's digital collections (see [Data](#data)) |
| `npm run deploy` | Build and deploy the site to Cloudflare |

Always run `npm run build` and `npm run lint` before pushing.

**Deploying:** the site is entirely static. It's hosted on Cloudflare as a Worker named `newsprint` that only serves static assets (configured in [`wrangler.jsonc`](wrangler.jsonc)). `npm run deploy` builds the site and uploads `dist/` with `wrangler deploy` (run `npx wrangler login` first). The build fails if `dist/` wouldn't deploy: a file over Cloudflare's 25 MiB limit, more than 20,000 files, or a build input (the CSV or OCR text) that ended up in it ([`src/lib/check-dist.mjs`](src/lib/check-dist.mjs)).

**Domain:** [`wrangler.jsonc`](wrangler.jsonc) attaches the custom domain `archives.dailycal.org` to the Worker on deploy. `*.workers.dev` addresses and preview URLs are turned off, so the site is only ever served at archives.dailycal.org.

## Data

Everything is built from two files in [`data/`](data/), which are never deployed:

- **`issues.csv`**: one row per issue, with the columns `year,month,day,id,sponsor,note,library`. `id` is the Google Drive file ID of the issue's PDF (in `Public/Newsprint/<year>/dailycal_YYYYMMDD_issue.pdf`), blank if we don't have a scan. `sponsor` is who sponsored its digitization, if anyone. `note` is a brief warning about the scan, like missing pages, and is blank for almost every issue. `library` is the issue's record ID in the [UC Berkeley Library's digital collections](https://digicoll.lib.berkeley.edu/), if it's there. Every row needs an `id`, a `library` record, or both. To add an issue, add a row.
- **The `library` column** comes from [`scripts/scrape-library.mjs`](scripts/scrape-library.mjs) (`npm run scrape-library`). It searches the library's "Daily Cal" collection (about 19,800 issues, from 1898) a year at a time, since the library's search stops paging partway through a large result, 6 seconds apart (the library's `robots.txt` asks for 5). It rewrites the column, adding a row for each date only the library has. It takes about 25 minutes; keep runs rare.
- **`ocr.tar.gz`**: the OCR text of every issue, one `<year>/dailycal_YYYYMMDD_issue.txt` per issue (`tar -xzf data/ocr.tar.gz` unpacks it). To update it, put the text files in a folder and run `npm run pack-ocr -- <folder>`. The build warns about any issue without text; it's still built, and searchable by its date and sponsor.

The PDFs have to be viewable by anyone with the link for the embeds to work.

## Pages

| URL | Page |
| :-- | :-- |
| `/` | The "Newsprint" banner with search and a random issue, then an index of every month since 1871: months with our scans in blue, months only the library has in light blue |
| `/1964` | A calendar of each month that year with an issue here or at the library |
| `/1964/november` | The month's calendar. Issues we have link to their page; issues only the library has are a lighter blue and link to its copy |
| `/1964/november/12` | An issue: the PDF in Google Drive's viewer, and its text in a collapsed section (on the page for search engines) |
| `/search?q=...` | Full-text search, with a decade filter and date sorting |
| `/about`, `/sponsor` | The old site's pages; sponsors link to the months they sponsored |

**SEO:** each page has a canonical link, a description, Open Graph and X card tags, and JSON-LD structured data (each issue is a `PublicationIssue` of the Daily Californian, with breadcrumbs). `robots.txt` and the sitemap (`/sitemap-index.xml`) are generated at build time.

**Search** is [Pagefind](https://pagefind.app/), which runs in the browser. At the end of the build, [`src/lib/search-index.mjs`](src/lib/search-index.mjs) indexes each issue's date, sponsor and full text straight from `data/`, into `dist/pagefind/`. Issues only the UC Berkeley Library has aren't in that index (Pagefind writes a file per issue, and their ~19,000 would go over Cloudflare's file limit). Instead, a search for a date ("March 2, 1910", "1910-03-02", "3/2/1910") lists that day's issue first, ours or the library's, and a search for a month links to its calendar, using `/search-dates.json` ([`src/pages/search-dates.json.ts`](src/pages/search-dates.json.ts)). Every search also links to the same search of the library's own full text.

## Project structure

```
data/                 issues.csv and ocr.tar.gz (build inputs, not deployed)
scripts/pack-ocr.mjs  Packs OCR text files into data/ocr.tar.gz
scripts/scrape-library.mjs  Finds the library's issues for data/issues.csv
src/
  pages/              The pages above; [year]/[month]/[day].astro is an issue
  layouts/Layout.astro  The old site's navbar and footer
  components/         Head.astro (SEO tags), Calendar.astro (a month's calendar)
  lib/                Reading the data, and the build steps: search index, checks
  styles/             Bootstrap 3 (as the old site served it) and the old site's styles
  config/site.ts      Site-wide names and links
```

The look is the old newsprint.dailycal.org site's: its Bootstrap 3 stylesheet and its own styles, without jQuery (the navbar's menu and the calendars are plain HTML and a few lines of script).
