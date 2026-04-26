import type { ContactAddress } from "@/domains/settings";
import {
  GOOGLE_MAPS_EMBED_BASE_URL,
  GOOGLE_MAPS_SEARCH_BASE_URL,
} from "@/core/utils/externalUrls";

type AddressLike = Partial<
  Pick<
    ContactAddress,
    | "address_line1"
    | "address_line2"
    | "city"
    | "state"
    | "pincode"
    | "country"
    | "google_maps_link"
    | "google_place_id"
    | "map_latitude"
    | "map_longitude"
  >
>;

interface GoogleMapsConfigOptions {
  address?: AddressLike | null;
  fallbackQuery: string;
  appName?: string;
  embedBaseUrl?: string;
  searchBaseUrl?: string;
}

interface GoogleMapsConfig {
  previewSrc: string;
  openUrl: string;
  invalidProvidedLink: boolean;
  hasExplicitPin: boolean;
}

const normalizeText = (value?: string) => value?.trim() || "";

const safeParseUrl = (value?: string) => {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
};

const isGoogleMapsUrl = (url: URL) => {
  if (!["https:", "http:"].includes(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "maps.app.goo.gl") {
    return true;
  }

  return hostname === "google.com" || hostname.endsWith(".google.com");
};

const decodeMapToken = (value?: string | null) => {
  if (!value) return "";

  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.replace(/\+/g, " ").trim();
  }
};

const normalizeCoordinate = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildQueryFromAddress = (
  address: AddressLike | null | undefined,
  fallbackQuery: string,
  appName?: string
) => {
  const parts = [
    normalizeText(appName),
    normalizeText(address?.address_line1),
    normalizeText(address?.address_line2),
    normalizeText(address?.city),
    normalizeText(address?.state),
    normalizeText(address?.pincode),
    normalizeText(address?.country),
  ].filter(Boolean);

  return parts.join(", ") || fallbackQuery;
};

const extractSearchLikeQuery = (url: URL) => {
  const paramKeys = ["q", "query", "destination", "daddr", "ll"];
  for (const key of paramKeys) {
    const value = decodeMapToken(url.searchParams.get(key));
    if (value) return value;
  }

  return "";
};

const extractPathQuery = (url: URL) => {
  const coordsMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (coordsMatch) {
    return `${coordsMatch[1]},${coordsMatch[2]}`;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const placeIndex = pathSegments.findIndex((segment) => segment === "place");
  if (placeIndex >= 0) {
    return decodeMapToken(pathSegments[placeIndex + 1]);
  }

  const searchIndex = pathSegments.findIndex((segment) => segment === "search");
  if (searchIndex >= 0) {
    return decodeMapToken(pathSegments[searchIndex + 1]);
  }

  return "";
};

const buildEmbedUrl = (query: string, embedBaseUrl?: string) => {
  const baseUrl = embedBaseUrl || GOOGLE_MAPS_EMBED_BASE_URL;
  return `${baseUrl}?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
};

const buildCoordinateQuery = (latitude: number, longitude: number) =>
  `${latitude},${longitude}`;

const buildOpenUrl = (query: string, searchBaseUrl?: string) => {
  const baseUrl = searchBaseUrl || GOOGLE_MAPS_SEARCH_BASE_URL;
  return `${baseUrl}?api=1&query=${encodeURIComponent(query)}`;
};

const buildPlaceOpenUrl = (query: string, placeId: string, searchBaseUrl?: string) => {
  const baseUrl = searchBaseUrl || GOOGLE_MAPS_SEARCH_BASE_URL;
  return `${baseUrl}?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(placeId)}`;
};

const extractPlaceId = (url: URL) => {
  const paramKeys = ["query_place_id", "place_id"];
  for (const key of paramKeys) {
    const value = decodeMapToken(url.searchParams.get(key));
    if (value) return value;
  }

  return "";
};

export const extractGoogleMapsPinData = (googleMapsLink?: string) => {
  const parsedLink = safeParseUrl(googleMapsLink);
  const trustedGoogleLink = parsedLink && isGoogleMapsUrl(parsedLink) ? parsedLink : null;

  if (!trustedGoogleLink) {
    return {
      map_latitude: undefined,
      map_longitude: undefined,
      google_place_id: undefined,
    };
  }

  const coordsMatch =
    trustedGoogleLink.toString().match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
    trustedGoogleLink.toString().match(/[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
    trustedGoogleLink.toString().match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);

  return {
    map_latitude: coordsMatch ? Number(coordsMatch[1]) : undefined,
    map_longitude: coordsMatch ? Number(coordsMatch[2]) : undefined,
    google_place_id: extractPlaceId(trustedGoogleLink) || undefined,
  };
};

export const getGoogleMapsConfig = ({
  address,
  fallbackQuery,
  appName,
  embedBaseUrl,
  searchBaseUrl,
}: GoogleMapsConfigOptions): GoogleMapsConfig => {
  const addressQuery = buildQueryFromAddress(address, fallbackQuery, appName);
  const latitude = normalizeCoordinate(address?.map_latitude);
  const longitude = normalizeCoordinate(address?.map_longitude);
  const googlePlaceId = normalizeText(address?.google_place_id);
  const rawLink = normalizeText(address?.google_maps_link);
  const parsedLink = safeParseUrl(rawLink);
  const trustedGoogleLink = parsedLink && isGoogleMapsUrl(parsedLink) ? parsedLink : null;
  const invalidProvidedLink = Boolean(rawLink) && !trustedGoogleLink;

  if (latitude !== undefined && longitude !== undefined) {
    const coordinateQuery = buildCoordinateQuery(latitude, longitude);
    return {
      previewSrc: buildEmbedUrl(coordinateQuery, embedBaseUrl),
      openUrl: googlePlaceId
        ? buildPlaceOpenUrl(addressQuery, googlePlaceId, searchBaseUrl)
        : buildOpenUrl(coordinateQuery, searchBaseUrl),
      invalidProvidedLink,
      hasExplicitPin: true,
    };
  }

  if (googlePlaceId) {
    return {
      previewSrc: buildEmbedUrl(addressQuery, embedBaseUrl),
      openUrl: buildPlaceOpenUrl(addressQuery, googlePlaceId, searchBaseUrl),
      invalidProvidedLink,
      hasExplicitPin: true,
    };
  }

  if (!trustedGoogleLink) {
    return {
      previewSrc: buildEmbedUrl(addressQuery, embedBaseUrl),
      openUrl: buildOpenUrl(addressQuery, searchBaseUrl),
      invalidProvidedLink,
      hasExplicitPin: false,
    };
  }

  const path = trustedGoogleLink.pathname.toLowerCase();
  const isEmbedLink = path.includes("/maps/embed");
  const extractedQuery =
    extractSearchLikeQuery(trustedGoogleLink) ||
    extractPathQuery(trustedGoogleLink) ||
    addressQuery;

  return {
    previewSrc: isEmbedLink
      ? trustedGoogleLink.toString()
      : buildEmbedUrl(extractedQuery, embedBaseUrl),
    openUrl: trustedGoogleLink.toString(),
    invalidProvidedLink: false,
    hasExplicitPin: true,
  };
};
