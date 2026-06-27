/**
 * Otimização de imagens do Supabase Storage.
 *
 * Reescreve URLs públicas do Storage (`/storage/v1/object/public/...`) para o
 * endpoint de transformação de imagens (`/storage/v1/render/image/public/...`),
 * que aplica:
 *  - Transcoding automático para formatos modernos (WebP/AVIF) quando o browser suporta
 *  - Compressão por qualidade (quality)
 *  - Redimensionamento responsivo (width/height) reduzindo o tamanho do download
 *  - Cabeçalhos de cache (Cache-Control) com longa duração na CDN
 *
 * URLs que não são do Storage (ou já transformadas) são retornadas sem alteração.
 */

const OBJECT_PUBLIC = "/storage/v1/object/public/";
const RENDER_PUBLIC = "/storage/v1/render/image/public/";

export interface ImageOptimizeOptions {
  /** Largura alvo em pixels (redimensionamento). */
  width?: number;
  /** Altura alvo em pixels (opcional). */
  height?: number;
  /** Qualidade de compressão (20-100). Padrão 70. */
  quality?: number;
  /** Modo de ajuste. Padrão "cover". */
  resize?: "cover" | "contain" | "fill";
}

export function optimizeStorageImage(
  url: string | null | undefined,
  options: ImageOptimizeOptions = {},
): string {
  if (!url || typeof url !== "string") return url ?? "";

  // Só transforma URLs públicas do Storage que ainda não passaram pelo render.
  if (!url.includes(OBJECT_PUBLIC) || url.includes(RENDER_PUBLIC)) {
    return url;
  }

  const { width, height, quality = 70, resize = "cover" } = options;

  const transformed = url.replace(OBJECT_PUBLIC, RENDER_PUBLIC);

  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  if (height) params.set("height", String(height));
  params.set("quality", String(quality));
  params.set("resize", resize);

  const separator = transformed.includes("?") ? "&" : "?";
  return `${transformed}${separator}${params.toString()}`;
}
