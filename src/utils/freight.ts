/**
 * freight.ts — Biblioteca de Cálculo de Frete por Regiões Geográficas
 *
 * Implementa o algoritmo Ray-Casting (point-in-polygon) para identificar
 * em qual região mapeada o endereço do cliente se encontra e calcular
 * automaticamente o valor do frete correspondente.
 *
 * Funciona igual ao iFood/Uber Eats: 100% baseado em polígonos do mapa.
 */

/**
 * Algoritmo Ray-Casting — verifica se um ponto (lat, lng) está dentro de um polígono.
 * @param lat Latitude do ponto
 * @param lng Longitude do ponto
 * @param coordinates Array de coordenadas GeoJSON [lng, lat][]
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  coordinates: [number, number][]
): boolean {
  if (!coordinates || coordinates.length < 3) return false;
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const xi = coordinates[i][1]; // lat
    const yi = coordinates[i][0]; // lng
    const xj = coordinates[j][1]; // lat
    const yj = coordinates[j][0]; // lng
    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Extrai as coordenadas do polígono de um objeto GeoJSON, tolerante a variações de formato.
 */
function extractCoordinates(geometry: any): [number, number][] | null {
  try {
    if (geometry?.type === 'Polygon' && Array.isArray(geometry?.coordinates?.[0])) {
      return geometry.coordinates[0];
    }
    if (geometry?.geometry?.type === 'Polygon' && Array.isArray(geometry?.geometry?.coordinates?.[0])) {
      return geometry.geometry.coordinates[0];
    }
    return null;
  } catch {
    return null;
  }
}

export interface FreightResult {
  fee: number | null;
  regionId: string | null;
  regionName: string | null;
  isOutOfRange: boolean;
}

/**
 * Calcula o frete para um par de coordenadas consultando as regiões ativas no banco.
 * Se o ponto estiver dentro de uma região, retorna o preço configurado.
 * Se estiver fora de todas as regiões, retorna isOutOfRange: true.
 *
 * @param lat Latitude do endereço de entrega
 * @param lng Longitude do endereço de entrega
 * @param supabase Instância do cliente Supabase
 */
export async function calculateDeliveryFee(
  lat: number,
  lng: number,
  supabase: any
): Promise<FreightResult> {
  if (!lat || !lng) {
    return { fee: null, regionId: null, regionName: null, isOutOfRange: false };
  }

  try {
    const { data: regions, error } = await supabase
      .from('regions')
      .select('id, name, geometry, price, delivery_fee')
      .or('is_active.is.null,is_active.eq.true');

    if (error || !regions || regions.length === 0) {
      console.warn('[freight] Nenhuma região encontrada ou erro:', error?.message);
      return { fee: null, regionId: null, regionName: null, isOutOfRange: false };
    }

    for (const region of regions) {
      const coords = extractCoordinates(region.geometry);
      if (!coords) continue;

      if (pointInPolygon(lat, lng, coords)) {
        const fee = Number(region.price ?? region.delivery_fee ?? 0);
        console.log(`[freight] ✅ Região encontrada: ${region.name} — R$ ${fee.toFixed(2)}`);
        return {
          fee,
          regionId: region.id,
          regionName: region.name,
          isOutOfRange: false,
        };
      }
    }

    console.warn('[freight] ⚠️ Endereço fora de todas as regiões mapeadas.');
    return { fee: null, regionId: null, regionName: null, isOutOfRange: true };
  } catch (err: any) {
    console.error('[freight] Erro inesperado:', err?.message);
    return { fee: null, regionId: null, regionName: null, isOutOfRange: false };
  }
}

/**
 * Geocodifica um endereço textual para coordenadas lat/lng
 * usando a API gratuita do OpenStreetMap (Nominatim).
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null;
  try {
    const query = encodeURIComponent(address + ', Brasil');
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
