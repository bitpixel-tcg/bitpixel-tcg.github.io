# Bit Pixel card-back images

Place your `.jpg` / `.jpeg` card-back images in this folder and register each image in `card-backs.json`, including the TCG it represents.

Example:

```json
{
  "backs": [
    { "file": "pokemon-blue.jpg", "game": "Pokémon" },
    { "file": "yugioh-black.jpg", "game": "Yugioh" },
    { "file": "one-piece.jpg", "game": "One Piece" },
    { "file": "magic.jpg", "game": "Magic" }
  ]
}
```

The homepage counts the TCGs represented by the current non-draft listings, using recognizable TCG names in listing tags first and the listing's `game` field as a fallback. For each background card, it rolls a TCG according to those listing proportions, then randomly chooses one of the registered card-back images for that TCG.

For example, if the listings are 95% Pokémon and 5% Yu-Gi-Oh, the background card backs will use those same odds (subject to random variation across the four cards). Multiple images can be registered for the same game; they share that game's probability and are selected randomly after the game is rolled.

The browser cannot automatically enumerate every file in a public folder, so every image must be listed in the manifest. The existing `public/pokemon-card-back.jpg` and `public/yugioh-card-back.jpg` files are used as fallbacks until categorized images are registered.

Supported game labels include Pokémon, Yugioh / Yu-Gi-Oh, One Piece, and Magic / MTG. Other TCGs can use their listing's `game` value as the `game` value in the manifest.
