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
- `tags`: Lowercase search terms that are not already obvious from the title
- `status`: `available`, `sold`, or `draft`; only available items are shown
- `featured`: Manually promotes a popular item; it shows a `Popular` badge and
  sorts before non-featured listings
- `createdAt`: An ISO date in `YYYY-MM-DD` format; listings from today or the
  previous two calendar days automatically show a `New` badge
- `theme`: `blue`, `red`, `gold`, `orange`, `mint`, or `violet`

Keep the file as valid JSON: property names and text use double quotes, and the
last property in an object does not have a trailing comma.
