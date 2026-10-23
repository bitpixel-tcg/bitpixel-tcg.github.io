# Editing the Bit Pixel catalogue

The public catalogue is generated from `listings.json`. Add, edit, or remove
objects in that array to update the website; no React changes are required.

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
- `game`: `Pokémon`, `One Piece`, or `Magic`
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
  marked in the catalogue
- `availableTo`: Optional ISO date or date/time for auction listings. Once this
  time is reached, an otherwise available listing is automatically displayed as
  `Expired`. Omit this field for listings that will be marked sold or
  unavailable manually. For precise auction endings, include the timezone, for
  example `"2026-10-24T20:15:00+01:00"`
- `featured`: Manually promotes a popular item; it shows a `Popular` badge and
  sorts before non-featured listings
- `createdAt`: An ISO date in `YYYY-MM-DD` format; listings from today or the
  previous two calendar days automatically show a `New` badge
- `theme`: `blue`, `red`, `gold`, `orange`, `mint`, or `violet`

Keep the file as valid JSON: property names and text use double quotes, and the
last property in an object does not have a trailing comma.
