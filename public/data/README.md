# Editing the Bit Pixel catalogue

The public catalogue is generated from `listings.json`. Add, edit, or remove
objects in that array to update the website; no React changes are required.

## Images

An `image` can be either:

- A full external URL beginning with `https://`
- A repository image placed in `public/listing-images/`, referenced as
  `listing-images/example.webp`

WebP or AVIF images are recommended to keep the catalogue fast.

## Important fields

- `id`: A unique, permanent slug such as `sv151-etb-001`
- `game`: `Pokémon`, `One Piece`, or `Magic`
- `category`: `Sealed`, `Singles`, or `Accessories`
- `seller`: `Blue Byte` or `Red Pixel`
- `marketplace`: `Cardmarket`, `eBay`, `Tradera`, or `Other`
- `marketplaceUrl`: The complete URL visitors should open
- `tags`: Lowercase search terms that are not already obvious from the title
- `status`: `available`, `sold`, or `draft`; only available items are shown
- `featured`: Featured items are sorted before the rest
- `createdAt`: An ISO date in `YYYY-MM-DD` format
- `theme`: `blue`, `red`, `gold`, `orange`, `mint`, or `violet`
- `badge`: Optional short label such as `New` or `Limited`

Keep the file as valid JSON: property names and text use double quotes, and the
last property in an object does not have a trailing comma.
