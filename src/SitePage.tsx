import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  getListingBadge,
  getListingDisplayStatus,
  getListings,
  isListingAvailable,
} from "./data/listings";
import { getNewsItems } from "./data/news";
import type { Listing } from "./types/listing";
import type { NewsItem } from "./types/news";

const HERO_LISTING_COUNT = 3;
type CardBackAsset = { file: string; game: string };
type CardBackManifest = {
  backs?: CardBackAsset[];
  // Backwards compatibility with the original filename-only manifest.
  files?: string[];
};

const FALLBACK_CARD_BACK_ASSETS: CardBackAsset[] = [
  { file: `${import.meta.env.BASE_URL}public/img/backs/pokemon-blue.jpg`, game: "Pokémon" },
  { file: `${import.meta.env.BASE_URL}public/img/backs/yugioh-back.jpg`, game: "Yugioh" },
  { file: `${import.meta.env.BASE_URL}public/img/backs/magic-back.jpg`, game: "magic" },
  { file: `${import.meta.env.BASE_URL}public/img/backs/onepiece-back.jpg`, game: "onepiece" },
];

function normalizeGameKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["pokemon", "pokemontcg"].includes(normalized)) return "pokemon";
  if (["yugioh", "yugiohtcg", "yugioh"].includes(normalized)) return "yugioh";
  if (["onepiece", "onepiecetcg"].includes(normalized)) return "onepiece";
  if (["magic", "mtg", "magicthegathering"].includes(normalized)) return "magic";
  return normalized;
}

function inferGameFromFilename(file: string) {
  const name = file.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name.includes("pokemon")) return "Pokémon";
  if (name.includes("yugioh") || name.includes("yuigioh")) return "Yugioh";
  if (name.includes("onepiece")) return "One Piece";
  if (name.includes("magic") || name.includes("mtg")) return "Magic";
  return "";
}

function chooseWeightedCardBacks(
  count: number,
  listings: Listing[],
  assets: CardBackAsset[],
) {
  const assetsByGame = new Map<string, CardBackAsset[]>();
  assets.forEach((asset) => {
    const key = normalizeGameKey(asset.game);
    if (!key) return;
    assetsByGame.set(key, [...(assetsByGame.get(key) ?? []), asset]);
  });

  // Listing tags are the primary source for the TCG mix. The structured game
  // field is used as a fallback for older listings without a game tag.
  const counts = new Map<string, number>();
  listings.forEach((listing) => {
    const taggedGame = listing.tags
      .map((tag) => inferGameFromFilename(tag))
      .find(Boolean);
    const game = taggedGame || listing.game;
    const key = normalizeGameKey(game);
    if (key && assetsByGame.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const weightedGames = [...counts.entries()];
  const total = weightedGames.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) {
    const available = assets.length ? assets : FALLBACK_CARD_BACK_ASSETS;
    return Array.from({ length: count }, () =>
      available[Math.floor(Math.random() * available.length)].file,
    );
  }

  return Array.from({ length: count }, () => {
    let roll = Math.random() * total;
    let selectedGame = weightedGames[weightedGames.length - 1][0];
    for (const [game, weight] of weightedGames) {
      roll -= weight;
      if (roll < 0) {
        selectedGame = game;
        break;
      }
    }
    const choices = assetsByGame.get(selectedGame)!;
    return choices[Math.floor(Math.random() * choices.length)].file;
  });
}

function pickRandomListing(listings: Listing[]) {
  return listings[Math.floor(Math.random() * listings.length)];
}

function pickHeroListings(listings: Listing[], savedIds: string[], count: number) {
  const remaining = listings.filter((listing) => isListingAvailable(listing));
  const chosen: Listing[] = [];

  // Fill each hero-card slot independently. Saved listings get first priority;
  // when none remain, choose randomly, preferring featured listings when any exist.
  while (chosen.length < count && remaining.length > 0) {
    const savedListings = remaining.filter((listing) => savedIds.includes(listing.id));
    const featuredListings = remaining.filter((listing) => listing.featured);
    const candidates = savedListings.length > 0
      ? savedListings
      : featuredListings.length > 0
        ? featuredListings
        : remaining;
    const selected = pickRandomListing(candidates);

    chosen.push(selected);
    remaining.splice(remaining.findIndex((listing) => listing.id === selected.id), 1);
  }

  return chosen;
}

function formatPrice(listing: Listing) {
  const { amount, currency, prefix } = listing.price;

  if (typeof amount !== "number" || !currency) {
    return prefix ?? "View listing";
  }

  try {
    const formatted = new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
    }).format(amount);

    return prefix ? `${prefix} ${formatted}` : formatted;
  } catch {
    return prefix ? `${prefix} ${amount}` : String(amount);
  }
}

const marketplaceProfiles = [
  {
    owner: "Blue Byte",
    location: "United Kingdom",
    marketplace: "eBay",
    description: "View all Blue Byte listings on eBay.",
    href: "https://www.ebay.co.uk/usr/bitpixeltcg",
    color: "blue",
    sectionAnchor: "blue-byte-marketplaces",
  },
  {
    owner: "Blue Byte",
    location: "United Kingdom",
    marketplace: "Cardmarket",
    description: "Browse Blue Byte's complete Cardmarket inventory.",
    href: "https://www.cardmarket.com/en/Pokemon/Users/Asymptotic-Wanderer",
    color: "blue",
    sectionAnchor: null,
  },
  {
    owner: "Red Pixel",
    location: "Sweden",
    marketplace: "Tradera",
    description: "View all Red Pixel auctions and listings on Tradera.",
    href: "https://www.tradera.com/profile/items/6354053/linus8888",
    color: "red",
    sectionAnchor: "red-pixel-marketplaces",
  },
  {
    owner: "Red Pixel",
    location: "Sweden",
    marketplace: "Cardmarket",
    description: "Browse Red Pixel's complete Cardmarket inventory.",
    href: "https://www.cardmarket.com/en/Pokemon/Users/Flabb",
    color: "red",
    sectionAnchor: null,
  },
] as const;

const SAVED_COOKIE = "bit_pixel_saved";

function readSavedListings() {
  if (typeof document === "undefined") return [];

  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${SAVED_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!value) return [];

  try {
    const saved: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function PixelMark() {
  return (
    <span className="pixel-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 17.2s-6.5-3.8-6.5-8.7A3.7 3.7 0 0 1 10 6a3.7 3.7 0 0 1 6.5 2.5c0 4.9-6.5 8.7-6.5 8.7Z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 4 12 12M16 4 4 16" />
    </svg>
  );
}

export default function SitePage({ page }: { page: "home" | "catalogue" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedGame, setSelectedGame] = useState<Listing["game"] | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string[]>(readSavedListings);
  const [savedOnly, setSavedOnly] = useState(
    () => page === "catalogue" && searchParams.get("saved") === "1",
  );
  const [listings, setListings] = useState<Listing[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [cardBackAssets, setCardBackAssets] = useState<CardBackAsset[]>(FALLBACK_CARD_BACK_ASSETS);
  const [cardBacks, setCardBacks] = useState<string[]>(() =>
    chooseWeightedCardBacks(4, [], FALLBACK_CARD_BACK_ASSETS),
  );
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageZoomOrigin, setImageZoomOrigin] = useState("50% 50%");
  const [catalogueStatus, setCatalogueStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    getListings()
      .then((data) => {
        setListings(data);
        setCatalogueStatus("ready");
      })
      .catch(() => setCatalogueStatus("error"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`${import.meta.env.BASE_URL}img/card-backs.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Card-back manifest is not available");
        return response.json() as Promise<CardBackManifest>;
      })
      .then((manifest) => {
        const explicitBacks = (manifest.backs ?? [])
          .filter((back) =>
            back && typeof back.file === "string" && /\.jpe?g$/i.test(back.file) &&
            typeof back.game === "string" && back.game.trim().length > 0,
          )
          .map((back) => ({
            file: `${import.meta.env.BASE_URL}img/${back.file.replace(/^\/+/, "")}`,
            game: back.game,
          }));

        const legacyBacks = (manifest.files ?? [])
          .filter((file) => typeof file === "string" && /\.jpe?g$/i.test(file))
          .map((file) => ({
            file: `${import.meta.env.BASE_URL}img/${file.replace(/^\/+/, "")}`,
            game: inferGameFromFilename(file),
          }))
          .filter((back) => back.game.length > 0);

        const candidates = explicitBacks.length ? explicitBacks : legacyBacks;
        if (!cancelled && candidates.length > 0) setCardBackAssets(candidates);
      })
      .catch(() => {
        // Keep the built-in Pokémon and Yu-Gi-Oh backs as a safe fallback.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (listings.length === 0) return;
    setCardBacks(chooseWeightedCardBacks(4, listings, cardBackAssets));
  }, [listings, cardBackAssets]);

  useEffect(() => {
    if (page !== "home") return;

    getNewsItems()
      .then(setNewsItems)
      .catch(() => setNewsItems([]));
  }, [page]);

  useEffect(() => {
    document.cookie = `${SAVED_COOKIE}=${encodeURIComponent(JSON.stringify(saved))}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }, [saved]);

  useEffect(() => {
    const section = searchParams.get("section");

    window.requestAnimationFrame(() => {
      if (section) {
        document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    });
  }, [page, searchParams]);

  useEffect(() => {
    setSavedOnly(page === "catalogue" && searchParams.get("saved") === "1");
  }, [page, searchParams]);

  useEffect(() => {
    if (!selectedListing) return;

    setImageZoomed(false);
    setImageZoomOrigin("50% 50%");
    setSelectedImageIndex(0);

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedListing(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedListing]);

  const availableGames = useMemo(
    () => Array.from(new Set(listings.map((listing) => listing.game))),
    [listings],
  );

  const heroListings = useMemo(
    () => pickHeroListings(listings, saved, HERO_LISTING_COUNT),
    [listings, saved],
  );

  const availableTags = useMemo(() => {
    if (!selectedGame) return [];

    const gameListings = listings.filter((listing) => listing.game === selectedGame);
    const facets = new Map<string, { label: string; count: number }>();

    gameListings.forEach((listing) => {
      const listingFacets = new Map<string, string>();
      [listing.category, listing.productType, ...listing.tags].forEach((tag) => {
        const key = tag.trim().toLowerCase();
        if (key && key !== selectedGame.toLowerCase()) {
          listingFacets.set(key, tag);
        }
      });

      listingFacets.forEach((label, key) => {
        const current = facets.get(key);
        facets.set(key, {
          label: current?.label ?? label,
          count: (current?.count ?? 0) + 1,
        });
      });
    });

    return Array.from(facets.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [listings, selectedGame]);

  const visibleProducts = useMemo(() => {
    return listings.filter((product) => {
      const matchesGame = !selectedGame || product.game === selectedGame;
      const productFacets = [
        product.category,
        product.productType,
        ...product.tags,
      ].map((tag) => tag.toLowerCase());
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => productFacets.includes(tag));
      const matchesSaved = !savedOnly || saved.includes(product.id);
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        `${product.title} ${product.description} ${product.game} ${product.category} ${product.productType} ${product.seller} ${product.tags.join(" ")}`
          .toLowerCase()
          .includes(query);
      return matchesGame && matchesTags && matchesSaved && matchesSearch;
    });
  }, [listings, saved, savedOnly, search, selectedGame, selectedTags]);

  const resetFilters = () => {
    setSelectedGame(null);
    setSelectedTags([]);
    setSearch("");
    setSavedOnly(false);
  };

  const openSavedListings = () => {
    if (page === "home") {
      navigate("/catalogue?saved=1");
      return;
    }

    setSavedOnly((current) => !current);
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  };

  const selectedListingBadge = selectedListing
    ? getListingBadge(selectedListing)
    : null;
  const selectedListingStatus = selectedListing
    ? getListingDisplayStatus(selectedListing)
    : null;
  const selectedListingUnavailable = selectedListingStatus !== "Available";

  return (
    <main>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Bit Pixel home">
          <PixelMark />
          <span>
            BIT <b>PIXEL</b>
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/catalogue">Catalogue</Link>
          <Link to={`${page === "home" ? "/" : "/catalogue"}?section=marketplaces`}>
            Marketplaces
          </Link>
          <a href="mailto:bitpixeltcg@hotmail.com">Contact</a>
        </nav>

        <button
          className={`saved-button ${savedOnly ? "is-active" : ""}`}
          type="button"
          aria-pressed={savedOnly}
          onClick={openSavedListings}
        >
          Saved <span>{saved.length}</span>
        </button>
      </header>

      {page === "home" && (
      <>
      <section className="hero">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span />
            TWO COLLECTORS · ONE CATALOGUE
          </div>
          <h1>
            Good finds,
            <br />
            one <em>pixel</em>
            <br />
            at a time.
          </h1>
          <div className="hero-actions">
            <Link className="primary-button" to="/catalogue">
              Browse the catalogue <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-art" aria-label="Featured trading card selection">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="feature-card feature-card--back feature-card--back-one">
              <img
                src={cardBacks[0]}
                alt="Trading card back"
              />
            </div>
            <div className="feature-card feature-card--back feature-card--back-two">
              <img
                src={cardBacks[1]}
                alt=""
              />
            </div>
            <div className="feature-card feature-card--back feature-card--yugioh-one">
              <img
                src={cardBacks[2]}
                alt="Trading card back"
              />
            </div>
            <div className="feature-card feature-card--back feature-card--yugioh-two">
              <img
                src={cardBacks[3]}
                alt=""
              />
            </div>
            {heroListings.map((listing, index) => (
              <button
                className={`feature-card feature-card--front feature-card--front-${index + 1} tone-${listing.theme}`}
                type="button"
                onClick={() => setSelectedListing(listing)}
                aria-label={`View details for ${listing.title}`}
                key={listing.id}
              >
                <img
                  src={listing.images[0]}
                  alt={`${listing.title} listing`}
                />
                <div>
                  <span>
                    {listing.game} ·{" "}
                    {(saved.includes(listing.id) ? "Saved find" : "Catalogue find").toUpperCase()}
                  </span>
                  <strong>{listing.title}</strong>
                </div>
              </button>
            ))}
            <span className="pixel-spark spark-two" />
          </div>

          <section className="hero-news" aria-labelledby="news-title">
            <div className="hero-news-heading">
              <h2 id="news-title">News</h2>
              <span>Latest from Bit Pixel</span>
            </div>
            <div className="news-feed">
              {newsItems.length > 0 ? (
                newsItems.map((item, index) => (
                  <article className="news-item" key={item.id}>
                    <div>
                      <span className="news-item-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.summary}</p>
                      </div>
                    </div>
                    <div className="news-item-foot">
                      <span>{item.dateLabel}</span>
                      {item.href && (
                        <a href={item.href} target="_blank" rel="noreferrer">
                          {item.linkLabel ?? "Read more"} <ArrowIcon />
                        </a>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="news-empty">
                  <p>More Bit Pixel news is being prepared.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="hero-footnote">
          <span>↓</span> SCROLL TO EXPLORE
        </div>
      </section>
      </>
      )}

      {page === "catalogue" && (
      <section className="catalogue" id="catalogue">
        <div className="section-heading">
          <div>
            <span className="section-index">01 / THE CATALOGUE</span>
            <h2>Fresh in the market</h2>
          </div>
          <p>
            We scout, compare, and link you straight to the listing.
            <br />
            No middleman - just good finds.
          </p>
        </div>

        <div className="catalogue-tools">
          <div className="catalogue-filters">
            <div className="filter-list" aria-label="Filter by trading card game">
              <button
                className={
                  !selectedGame && selectedTags.length === 0 && !savedOnly
                    ? "active"
                    : ""
                }
                type="button"
                onClick={resetFilters}
              >
                All finds
              </button>
              {availableGames.map((game) => (
                <button
                  key={game}
                  className={selectedGame === game ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setSelectedGame(game);
                    setSelectedTags([]);
                  }}
                >
                  {game}
                </button>
              ))}
            </div>

            {selectedGame && availableTags.length > 0 && (
              <div className="facet-panel">
                <div className="facet-heading">
                  <span>Refine {selectedGame}</span>
                  {selectedTags.length > 0 && (
                    <button type="button" onClick={() => setSelectedTags([])}>
                      Clear tags
                    </button>
                  )}
                </div>
                <div className="facet-list" aria-label={`Refine ${selectedGame} listings`}>
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.key);
                    return (
                      <button
                        key={tag.key}
                        className={isSelected ? "active" : ""}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedTags((current) =>
                            isSelected
                              ? current.filter((value) => value !== tag.key)
                              : [...current, tag.key],
                          )
                        }
                      >
                        {tag.label}
                        <span>{tag.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <label className="search-field">
            <SearchIcon />
            <span className="sr-only">Search catalogue</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the catalogue"
            />
          </label>
        </div>

        {catalogueStatus === "loading" ? (
          <div className="empty-state" role="status">
            <PixelMark />
            <h3>Opening the catalogue…</h3>
            <p>Gathering the latest finds from both sellers.</p>
          </div>
        ) : catalogueStatus === "error" ? (
          <div className="empty-state" role="alert">
            <PixelMark />
            <h3>The catalogue could not be loaded.</h3>
            <p>Check that public/data/listings.json contains valid JSON.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : visibleProducts.length > 0 ? (
          <div className="product-grid">
            {visibleProducts.map((product) => {
              const isSaved = saved.includes(product.id);
              const productBadge = getListingBadge(product);
              const productStatus = getListingDisplayStatus(product);
              const productUnavailable = productStatus !== "Available";
              return (
                <article
                  className={`product-card ${productUnavailable ? "is-unavailable" : ""}`}
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${product.title}`}
                  onClick={() => setSelectedListing(product)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedListing(product);
                    }
                  }}
                >
                  <div className={`product-image tone-${product.theme}`}>
                    <img src={product.images[0]} alt="" />
                    {productBadge && <span className="product-tag">{productBadge}</span>}
                    {productUnavailable && (
                      <span className="listing-status-banner">{productStatus}</span>
                    )}
                    <button
                      type="button"
                      className={`save-toggle ${isSaved ? "is-saved" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSaved((current) =>
                          isSaved
                            ? current.filter((id) => id !== product.id)
                            : [...current, product.id],
                        );
                      }}
                      aria-label={isSaved ? `Unsave ${product.title}` : `Save ${product.title}`}
                    >
                      <HeartIcon filled={isSaved} />
                    </button>
                  </div>
                  <div className="product-info">
                    <span className="product-game">{product.game}</span>
                    <h3>{product.title}</h3>
                    <p>{product.description}</p>
                    <div className="product-meta">
                      <div>
                        <span>LISTED BY</span>
                        <b className={product.seller === "Blue Byte" ? "blue-dot" : "red-dot"}>
                          {product.seller}
                        </b>
                      </div>
                      {product.marketplaceUrl ? (
                        <a
                          href={product.marketplaceUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View ${product.title} on ${product.marketplace}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span>{formatPrice(product)}</span>
                          <ArrowIcon />
                        </a>
                      ) : (
                        <span className="marketplace-unavailable">
                          No marketplace link
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <PixelMark />
            <h3>{savedOnly ? "No saved cards in this hand." : "No cards in this hand."}</h3>
            <p>
              {savedOnly
                ? "Save a listing with the heart button, or return to the full catalogue."
                : "Try another search or reset the filters."}
            </p>
            <button
              type="button"
              onClick={savedOnly ? () => setSavedOnly(false) : resetFilters}
            >
              {savedOnly ? "Show all listings" : "Reset catalogue"}
            </button>
          </div>
        )}
      </section>
      )}

      <footer
        className={`marketplace-footer ${
          page === "catalogue" ? "marketplace-footer--compact" : ""
        }`}
        id="marketplaces"
      >
        <div className="footer-heading">
          <div>
            <span className="section-index">
              {page === "home" ? "01" : "02"} / FIND OUR STOCK
            </span>
            <h2>Shop on your<br />preferred market.</h2>
          </div>
          <p>
            Jump directly to either seller’s profile and see every live listing
            on the marketplace you already use.
          </p>
        </div>

        <div className="profile-grid">
          {marketplaceProfiles.map((profile, index) => (
            <a
              className={`profile-link profile-link--${profile.color}`}
              href={profile.href}
              target="_blank"
              rel="noreferrer"
              key={`${profile.owner}-${profile.marketplace}`}
              id={profile.sectionAnchor ?? undefined}
            >
              <div className="profile-link-top">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <ArrowIcon />
              </div>
              <div>
                <span className="profile-owner">
                  {profile.owner} · {profile.location}
                </span>
                <h3>{profile.marketplace}</h3>
                <p>{profile.description}</p>
              </div>
            </a>
          ))}
        </div>

        {page === "home" && (
          <div className="footer-bar">
            <Link className="brand brand--footer" to="/">
              <PixelMark />
              <span>BIT <b>PIXEL</b></span>
            </Link>
            <a href="mailto:bitpixeltcg@hotmail.com">bitpixeltcg@hotmail.com</a>
            <Link to="/catalogue">Browse catalogue</Link>
            <span>© 2025 BIT PIXEL</span>
          </div>
        )}
      </footer>

      {selectedListing && (
        <div
          className="listing-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedListing(null);
          }}
        >
          <section
            className="listing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="listing-modal-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelectedListing(null)}
              aria-label="Close listing details"
              autoFocus
            >
              <CloseIcon />
            </button>

            <div className="modal-gallery">
              <div
                className={`modal-image tone-${selectedListing.theme} ${imageZoomed ? "is-zoomed" : ""} ${selectedListingUnavailable ? "is-unavailable" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={
                  imageZoomed
                    ? `Reset image zoom for ${selectedListing.title}`
                    : `Zoom image for ${selectedListing.title}`
                }
                aria-pressed={imageZoomed}
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                  setImageZoomOrigin(`${x}% ${y}%`);
                }}
                onMouseLeave={() => {
                  if (!imageZoomed) setImageZoomOrigin("50% 50%");
                }}
                onClick={() => setImageZoomed((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setImageZoomed((current) => !current);
                  }
                }}
              >
                <img
                  src={selectedListing.images[selectedImageIndex] ?? selectedListing.images[0]}
                  alt={`${selectedListing.title}, image ${selectedImageIndex + 1}`}
                  style={{ transformOrigin: imageZoomOrigin }}
                />
                {selectedListingBadge && (
                  <span className="product-tag">{selectedListingBadge}</span>
                )}
                {selectedListingUnavailable && (
                  <span className="listing-status-banner">{selectedListingStatus}</span>
                )}
                <span className="modal-image-index">
                  {selectedImageIndex + 1} / {selectedListing.images.length} ·{" "}
                  {selectedListing.id}
                </span>
                <span className="modal-zoom-hint">
                  {imageZoomed ? "Click to reset" : "Click image to zoom"}
                </span>
              </div>

              {selectedListing.images.length > 1 && (
                <div
                  className={`modal-thumbnails ${selectedListingUnavailable ? "is-unavailable" : ""}`}
                  aria-label="Listing images"
                >
                  {selectedListing.images.map((image, index) => (
                    <button
                      className={selectedImageIndex === index ? "active" : ""}
                      type="button"
                      key={`${image}-${index}`}
                      onClick={() => {
                        setSelectedImageIndex(index);
                        setImageZoomed(false);
                        setImageZoomOrigin("50% 50%");
                      }}
                      aria-label={`View image ${index + 1} of ${selectedListing.images.length}`}
                      aria-pressed={selectedImageIndex === index}
                    >
                      <img src={image} alt="" />
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-content">
              <div className="modal-kicker">
                <span>{selectedListing.game}</span>
                <span className={selectedListingUnavailable ? "is-unavailable" : ""}>
                  {selectedListingStatus}
                </span>
              </div>
              <h2 id="listing-modal-title">{selectedListing.title}</h2>

              <div className="modal-purchase">
                <div>
                  <span>LISTED BY</span>
                  <b
                    className={
                      selectedListing.seller === "Blue Byte" ? "blue-dot" : "red-dot"
                    }
                  >
                    {selectedListing.seller}
                  </b>
                </div>
                {selectedListing.marketplaceUrl ? (
                  <a
                    href={selectedListing.marketplaceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <small>{formatPrice(selectedListing)}</small>
                      View on {selectedListing.marketplace}
                    </span>
                    <ArrowIcon />
                  </a>
                ) : (
                  <span className="marketplace-unavailable">
                    No marketplace link available
                  </span>
                )}
              </div>

              <p className="modal-description">{selectedListing.description}</p>

              <dl className="listing-details">
                <div>
                  <dt>Listing type</dt>
                  <dd>{selectedListing.productType}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedListing.category}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{selectedListing.language}</dd>
                </div>
                <div>
                  <dt>Condition</dt>
                  <dd>{selectedListing.condition}</dd>
                </div>
              </dl>

              <div className="modal-tags">
                <span>SEARCH TAGS</span>
                <div>
                  {selectedListing.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

            </div>
          </section>
        </div>
      )}
    </main>
  );
}
