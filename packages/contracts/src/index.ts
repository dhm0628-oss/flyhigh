export type ContentType = "film" | "series" | "episode" | "trailer" | "bonus";

export interface ContentCard {
  id: string;
  slug: string;
  title: string;
  author?: string;
  synopsis: string;
  type: ContentType;
  posterUrl: string;
  previewUrl?: string;
  durationSeconds: number;
  releaseYear?: number;
  tags: string[];
  isPremium: boolean;
}

export interface CollectionRow {
  id: string;
  title: string;
  items: ContentCard[];
}

export interface HomeFeedResponse {
  featured: ContentCard | null;
  featuredItems?: ContentCard[];
  rows: CollectionRow[];
}

export interface ViewerProfile {
  id: string;
  email: string;
  displayName: string;
  subscriptionStatus: "active" | "inactive" | "trialing" | "past_due";
}

export interface PlaybackAuthorization {
  contentId: string;
  allowed: boolean;
  reason?: "requires_subscription" | "geo_blocked" | "unavailable";
  playbackUrl?: string;
  expiresAt?: string;
}
