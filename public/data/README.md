# Editing the Bit Pixel catalogue

The public catalogue is generated from `listings.json`. Add, edit, or remove
objects in that array to update the website; no React changes are required.

The landing-page news feed is generated from `news.json`. Items appear in file
order and support `id`, `title`, `summary`, and `dateLabel`. Optional
`href` and `linkLabel` fields add an external link to a news item; use the
complete `https://` URL.

## Images

`images` is a JSON list containing one or more image paths. The first image is
used as the catalogue cover; every image is available in the listing detail
gallery.

Each entry can be either:

- A full external URL beginning with `https://`
- A repository image placed in `public/listing-images/`, referenced as
  `listing-images/example.webp`

WebP or AVIF images are recommended to keep the catalogue fast.

```json
"images": [
  "listing-images/example-front.webp",
  "listing-images/example-back.webp"
]
```

## Important fields

- `id`: A unique, permanent slug such as `sv151-etb-001`
- `ebayItemId`: Added automatically for eBay listings; it is the number in the
  listing's eBay link (`ebay.co.uk/itm/<number>`) and lets the hourly sync
  match each entry to eBay. Leave it alone on synced listings. Entries without
  it are treated as manual and are never changed or removed by the sync
- `game`: `Pokémon`, `One Piece`, `Magic`, or `Yugioh`
- `category`: `Sealed`, `Singles`, or `Accessories`
- `seller`: `Blue Byte` or `Red Pixel`
- `marketplace`: `Cardmarket`, `eBay`, `Tradera`, or `Other`
- `marketplaceUrl`: The complete URL visitors should open
- `price`: Normally includes numeric `amount`, three-letter `currency`, and an
  optional `prefix`. For auctions without a displayed price, omit `amount` and
  `currency` and use a prefix such as `"Bid now"`
- `tags`: Lowercase search terms that are not already obvious from the title
- `status`: `available`, `sold`, `unavailable`, or `draft`; all except drafts
  are shown. Sold and unavailable listings remain interactive but are visually
  marked in the catalogue. Sold and expired
  listings link to the seller's sold-items page; unavailable listings have no
  link
- `availableTo`: Optional ISO date or date/time for auction listings. Once this
  time is reached, an otherwise available listing is automatically displayed as
  `Expired`. Omit this field for listings that will be marked sold or
  unavailable manually. For precise auction endings, include the timezone, for
  example `"2026-10-24T20:15:00+01:00"`
- `endedAt`: Added automatically by the eBay sync, as a `YYYY-MM-DD` date, when
  a listing is found to have ended. The sync marks it `sold` (eBay's API cannot
  tell a sale from a listing that was withdrawn or ended unsold; set `status`
  to `unavailable` by hand for those, and the sync will leave it alone). Ended
  listings stay on the site and send visitors to the seller's sold-items page.
  The workflow sets `KEEP_ENDED_DAYS` very high so they are never removed
  automatically; lower it (the script's own default is 30) to have the sync
  delete ended listings after that many days. Delete this field to restart the
  countdown, or if a listing is relisted
- `featured`: Manually promotes a popular item; it shows a `Popular` badge and
  sorts before non-featured listings
- `createdAt`: An ISO date in `YYYY-MM-DD` format; listings from today or the
  previous two calendar days automatically show a `New` badge
- `theme`: `blue`, `red`, `gold`, `orange`, `mint`, or `violet`

Keep the file as valid JSON: property names and text use double quotes, and the
last property in an object does not have a trailing comma.

## Automatic eBay updates

A scheduled GitHub Action (`.github/workflows/update-listings.yml`) runs
`scripts/sync_ebay_listings.py` hourly. For listings that have an `ebayItemId`
it refreshes only `title`, `price`, `availableTo`, and `status`; everything
else in this file (description, tags, featured, theme, images, and so on) is
yours and is never overwritten. New eBay listings are appended automatically
with best-guess `game`, `category`, `language`, and `tags`, so check and refine
them when you can. `listings-meta.json` records when eBay was last checked.