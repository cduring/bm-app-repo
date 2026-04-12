/**
 * Geocodes a Canadian FSA via Mapbox Places and returns a privacy-jittered pin.
 */
export async function resolvePostalCode(fsa: string): Promise<{
  latitude: number;
  longitude: number;
  locationLabel: string;
} | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fsa)}.json?country=ca&types=postcode&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const json = await response.json();
  if (!json.features || json.features.length === 0) return null;

  const feature = json.features[0];
  const [lng, lat] = feature.center as [number, number];

  // Build a clean "City, Province" label from the context hierarchy
  const ctx: { id: string; text: string }[] = feature.context ?? [];
  const city = ctx.find((c) => c.id.startsWith("place."))?.text;
  const province = ctx.find((c) => c.id.startsWith("region."))?.text;
  const locationLabel =
    city && province
      ? `${city}, ${province}`
      : (city ??
        feature.place_name?.split(",").slice(1, 3).join(",").trim() ??
        fsa);

  // ±0.009 degrees ≈ ±~900 m privacy jitter
  const jitter = () => (Math.random() - 0.5) * 0.018;
  return { latitude: lat + jitter(), longitude: lng + jitter(), locationLabel };
}
