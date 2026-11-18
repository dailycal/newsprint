# Newsprint

Source for [archive.dailycal.org](https://archive.dailycal.org/): The Daily Californian's print archive. Every digitized issue has its own page, with the scan (a PDF in Google Drive) and the full text of every page, and the whole archive is searchable.

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
| `npm run deploy` | Build and deploy the site to Cloudflare |

Always run `npm run build` and `npm run lint` before pushing. GitHub Actions also runs both on every commit and pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

**Deploying:** the site is entirely static. It's hosted on Cloudflare as a Worker named `newsprint` that only serves static assets (configured in [`wrangler.jsonc`](wrangler.jsonc)). `npm run deploy` builds the site and uploads `dist/` with `wrangler deploy` (run `npx wrangler login` first). The build fails if `dist/` wouldn't deploy: a file over Cloudflare's 25 MiB limit, more than 20,000 files, or a build input (the CSV or OCR text) that ended up in it ([`src/lib/check-dist.mjs`](src/lib/check-dist.mjs)).

**Previews:** every pull request from a branch in this repository gets its own copy of the site at `https://pr<number>.archive.dailycal.org`, deleted when the pull request is closed ([`.github/workflows/preview.yml`](.github/workflows/preview.yml)). [`wrangler.jsonc`](wrangler.jsonc) sets the custom domain `archive.dailycal.org` for both production and previews, and turns off `*.workers.dev` addresses for both, so the site is only ever served on dailycal.org. The workflow needs the repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.

## Data

Everything is built from two files in [`data/`](data/), which are never deployed:

- **`issues.csv`**: one row per issue, with the columns `year,month,day,id,sponsor,note`. `id` is the Google Drive file ID of the issue's PDF (in `Public/Newsprint/<year>/dailycal_YYYYMMDD_issue.pdf`). `sponsor` is who sponsored its digitization, if anyone. `note` is a brief warning about the scan, like missing pages, and is blank for almost every issue. To add an issue, add a row.
- **`ocr.tar.gz`**: the OCR text of every issue, one `<year>/dailycal_YYYYMMDD_issue.txt` per issue (`tar -xzf data/ocr.tar.gz` unpacks it). To update it, put the text files in a folder and run `npm run pack-ocr -- <folder>`. The build warns about any issue without text; it's still built, and searchable by its date and sponsor.

The PDFs have to be viewable by anyone with the link for the embeds to work.

## Pages

| URL | Page |
| :-- | :-- |
| `/` | The "Newsprint" banner with search and a random issue, then a grid of every month since 1871, with digitized months linked |
| `/1964` | A calendar of each digitized month that year |
| `/1964/november` | The month's calendar, with each issue linked |
| `/1964/november/12` | An issue: the PDF in Google Drive's viewer, and its text in a collapsed section (on the page for search engines) |
| `/search?q=...` | Full-text search, with a decade filter and date sorting |
| `/about`, `/sponsor` | The old site's pages; sponsors link to the months they sponsored |

The old archive's URLs (`/issues/1964/11/12/`, `/issues/1964/11/`) redirect here with 301s, generated into `dist/_redirects` at build time ([`src/lib/legacy-redirects.mjs`](src/lib/legacy-redirects.mjs)).

**SEO:** each page has a canonical link, a description, Open Graph and X card tags, and JSON-LD structured data (each issue is a `PublicationIssue` of the Daily Californian, with breadcrumbs). `robots.txt` and the sitemap (`/sitemap-index.xml`) are generated at build time.

**Search** is [Pagefind](https://pagefind.app/), which runs in the browser. At the end of the build, [`src/lib/search-index.mjs`](src/lib/search-index.mjs) indexes each issue's date, sponsor and full text straight from `data/`, into `dist/pagefind/`.

## Project structure

```
data/                 issues.csv and ocr.tar.gz (build inputs, not deployed)
scripts/pack-ocr.mjs  Packs OCR text files into data/ocr.tar.gz
src/
  pages/              The pages above; [year]/[month]/[day].astro is an issue
  layouts/Layout.astro  The old site's navbar and footer
  components/         Head.astro (SEO tags), Calendar.astro (a month's calendar)
  lib/                Reading the data, and the build steps: search index, redirects, checks
  styles/             Bootstrap 3 (as the old site served it) and the old site's styles
  config/site.ts      Site-wide names and links
```

The look is the old newsprint.dailycal.org site's: its Bootstrap 3 stylesheet and its own styles, without jQuery (the navbar's menu and the calendars are plain HTML and a few lines of script).
