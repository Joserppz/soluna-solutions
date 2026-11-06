/**
 * Galería (diseño pág. 13): las fotos y videos se suben directo a Cloudinary con una
 * firma que da la API (la clave secreta nunca llega al navegador). Después se registran
 * en el álbum. JPG, PNG, WEBP o MP4, hasta 10 archivos por vez.
 */
import type { AssetIn, UploadSignature } from '../api/types'

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
]
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,.mp4'
export const MAX_FILES = 10
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

/** Por qué un archivo no se puede subir, o null si sí. */
export function fileProblem(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type))
    return `«${file.name}» no es JPG, PNG, WEBP ni MP4.`
  const video = file.type.startsWith('video/')
  const limit = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > limit)
    return `«${file.name}» pesa más de ${limit / (1024 * 1024)} MB.`
  return null
}

/** Miniatura de Cloudinary: 400 px de ancho (para un video, su primer cuadro). */
export function thumbnailUrl(url: string, kind: AssetIn['kind']): string {
  if (kind === 'video')
    return url
      .replace('/upload/', '/upload/so_0,w_400/')
      .replace(/\.\w+$/, '.jpg')
  return url.replace('/upload/', '/upload/w_400/')
}

interface CloudinaryUpload {
  public_id: string
  secure_url: string
  resource_type: string
  width?: number
  height?: number
  bytes: number
}

export class UploadError extends Error {}

/** Sube un archivo a Cloudinary con la firma y devuelve lo que se registra en el álbum. */
export async function uploadToCloudinary(
  file: File,
  signed: UploadSignature,
  fetcher: typeof fetch = fetch,
): Promise<AssetIn> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', signed.apiKey)
  form.append('timestamp', String(signed.timestamp))
  form.append('folder', signed.folder)
  form.append('allowed_formats', signed.allowedFormats)
  form.append('signature', signed.signature)
  let response: Response
  try {
    response = await fetcher(signed.uploadUrl, { method: 'POST', body: form })
  } catch {
    throw new UploadError(
      `No pudimos subir «${file.name}»: revisa la conexión e intenta de nuevo.`,
    )
  }
  if (!response.ok)
    throw new UploadError(
      `Cloudinary no aceptó «${file.name}». Intenta de nuevo o prueba con otro archivo.`,
    )
  const result = (await response.json()) as CloudinaryUpload
  const kind = result.resource_type === 'video' ? 'video' : 'imagen'
  return {
    publicId: result.public_id,
    url: result.secure_url,
    thumbnailUrl: thumbnailUrl(result.secure_url, kind),
    kind,
    width: result.width ?? null,
    height: result.height ?? null,
    sizeBytes: result.bytes,
  }
}

/** «24 fotos», «1 video», «3 fotos y 1 video» */
export function assetCountLabel(images: number, videos: number): string {
  const parts: string[] = []
  if (images) parts.push(`${images} ${images === 1 ? 'foto' : 'fotos'}`)
  if (videos) parts.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`)
  return parts.length ? parts.join(' y ') : 'Sin fotos todavía'
}
