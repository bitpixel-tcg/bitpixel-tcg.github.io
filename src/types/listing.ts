export type ListingGame = "Pokémon" | "One Piece" | "Magic" | "Yugioh";
export type ListingSeller = "Blue Byte" | "Red Pixel";
export type ListingStatus = "available" | "sold" | "unavailable" | "draft";

export type Listing = {
  id: string;
  title: string;
  description: string;
  game: ListingGame;
  category: "Sealed" | "Singles" | "Accessories";
  productType: string;
  language: string;
  condition: string;
  seller: ListingSeller;
  price: {
    amount?: number;
    currency?: string;
    prefix?: string;
  };
  images: string[];
  marketplace: "Cardmarket" | "eBay" | "Tradera" | "Other";
  marketplaceUrl?: string;
  tags: string[];
  featured: boolean;
  status: ListingStatus;
  availableTo?: string;
  createdAt?: string;
  theme: "blue" | "red" | "gold" | "orange" | "mint" | "violet";
};
