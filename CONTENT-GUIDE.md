# How to edit the content

## Case studies (the 3 hero projects)
Files: `src/content/work/*.md`. Top block = settings, below it = the case study text.

Settings (between the `---` lines): `title`, `brand`, `category`, `summary` (one line, shown on the home page), `youtube` (video ID),
`start` (second the home-page preview starts at), `theme` (`paper`, `ink` or `signal`), `order` (1, 2, 3), `cta_offer` (which offer the button preselects).
Optional, shown in the facts row when you add them: `role`, `tools` (a list), `year`.

Body: every `## Heading` becomes a chapter. Short paragraphs. One idea per chapter. Suggested chapters:

    ## The brief          what you set out to do, and why this brand
    ## The idea           the single idea the piece hangs on
    ## Design             type, colour, grid, frames
    ## Motion             easing, timing, rhythm; what you animated and how
    ## Sound              if relevant
    ## What we learned    honest notes. Spec work has no "results": say what you would change

Images: put files in `public/images/work/` and use `![caption](/images/work/file.webp)`.
Rules: no invented numbers, no client claims. Spec projects are labelled "Spec project" automatically.
Before publishing the Segwise page, confirm "spec project" is accurate for it.

## More work strip (home page)
File: `src/data/more-work.js`. One line per project: `id` (YouTube ID), `title`, `line` (your one sentence).

## Offers and prices
File: `src/data/offers.js`. These are the prices the live site showed before the rebuild ($749 / $1,049 / $1,349, INR 69,000 / 99,000 / 1,29,000). Change them here, once.

## Site settings
File: `src/site.config.js`. CONFIRM `url` is your real domain: canonical tags, the sitemap and link previews use it.
Also update `public/robots.txt` (the Sitemap line) if the domain differs.

## Commands
    npm install
    npm run dev        # local preview at http://localhost:4321
    npm run build      # what Vercel runs
