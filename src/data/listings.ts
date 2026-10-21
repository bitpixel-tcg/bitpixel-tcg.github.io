import type { Listing } from "../types/listing";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export type ListingDisplayStatus = "Available" | "Expired" | "Sold" | "Unavailable";

export function getListingDisplayStatus(
  listing: Listing,
  now = new Date(),
): ListingDisplayStatus {
  if (listing.status === "sold") return "Sold";
  if (listing.status === "unavailable") return "Unavailable";

  if (listing.status === "available" && listing.availableTo) {
    const availableTo = Date.parse(listing.availableTo);
    if (!Number.isNaN(availableTo) && availableTo <= now.getTime()) {
      return "Expired";
    }
  }

  return "Available";
}

export function isListingAvailable(listing: Listing, now = new Date()) {
  return (
    listing.status === "available" &&
    getListingDisplayStatus(listing, now) === "Available"
  );
}

export function isNewListing(createdAt: string, today = new Date()) {
  const [year, month, day] = createdAt.split("-").map(Number);
  if (!year || !month || !day) return false;

  const listingDate = Date.UTC(year, month - 1, day);
  const currentDate = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const ageInDays = (currentDate - listingDate) / DAY_IN_MS;

  return ageInDays >= 0 && ageInDays <= 2;
}

export function getListingBadge(listing: Listing) {
  if (!isListingAvailable(listing)) return null;
  if (listing.featured) return "Popular";
  if (isNewListing(listing.createdAt)) return "New";
  return null;
}

// This is the only data-access function used by the catalogue. A future
// Supabase implementation can replace this fetch without changing the UI.
export async function getListings(): Promise<Listing[]> {
  // Listings change independently of the application bundle. The timestamp
  // prevents GitHub Pages and returning browsers from serving an older copy.
  const listingsUrl = new URL(
    `${import.meta.env.BASE_URL}data/listings.json`,
    window.location.href,
  );
  listingsUrl.searchParams.set("updated", Date.now().toString());

  const response = await fetch(listingsUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load listings (${response.status})`);
  }

  const listings: unknown = await response.json();

  if (!Array.isArray(listings)) {
    throw new Error("Listings data must be an array");
  }

  const now = new Date();

  return (listings as Listing[])
    .filter((listing) => listing.status !== "draft")
    .sort(
      (a, b) =>
        Number(isListingAvailable(b, now)) - Number(isListingAvailable(a, now)) ||
        Number(b.featured) - Number(a.featured) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
}
