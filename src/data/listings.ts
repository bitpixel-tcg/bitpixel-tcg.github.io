import type { Listing } from "../types/listing";

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
