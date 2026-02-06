interface Image {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SimplifiedArtist {
  href: string;
  id: string;
  name: string;
  type: "artist";
  uri: string;
}

export interface Artist extends SimplifiedArtist {
  followers: {
    total: number;
  };
  genres: string[];
  images: Image[];
  popularity: number;
}

export interface SimplifiedAlbum {
  album_type: "album" | "single" | "compilation";
  total_tracks: number;
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: "year" | "month" | "day";
  type: "album";
  uri: string;
  artists: SimplifiedArtist[];
}

interface SimplifiedTrack {
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  href: string;
  id: string;
  name: string;
  track_number: number;
  type: "track";
  uri: string;
  is_local: boolean;
}

export interface Track extends SimplifiedTrack {
  album: SimplifiedAlbum;
  artists: SimplifiedArtist[];
  external_ids?: {
    isrc: string;
    ean: string;
    upc: string;
  };
  popularity: number;
}

interface Items<T> {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: T[];
}

export interface SeveralArtistsResponse {
  artists: Artist[];
}

export type TopArtistsResponse = Items<Artist>;

export type TopTracksResponse = Items<Track>;

export interface RecentlyPlayedResponse {
  items: Array<{
    track: Track;
    played_at: string;
    context: {
      type: string;
      uri: string;
    } | null;
  }>;
  next: string | null;
  cursors: {
    after: string;
    before: string;
  } | null;
  limit: number;
}
