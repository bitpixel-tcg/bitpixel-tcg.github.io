import type { Listing } from "../types/listing";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
  if (listing.featured) return "Popular";
  if (isNewListing(listing.createdAt)) return "New";
  return null;
}

// This is the only data-access function used by the catalogue. A future
// Supabase implementation can replace this fetch without changing the UI.
export async function getListings(): Promise<Listing[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/listings.json`);

  if (!response.ok) {
    throw new Error(`Could not load listings (${response.status})`);
  }

  const listings: unknown = await response.json();

  if (!Array.isArray(listings)) {
    throw new Error("Listings data must be an array");
  }

  return (listings as Listing[])
    .filter((listing) => listing.status === "available")
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
}
