'use client'

/**
 * 사진을 올리기 전에 브라우저에서 줄인다.
 *
 * 폰 사진은 한 장에 3~8MB 다. 그대로 올리면 느리고 저장소도 금방 찬다.
 * 긴 변 1,400px · JPEG 0.82 면 화면에서 차이가 없고 200~400KB 로 떨어진다.
 * 줄이지 못하는 형식(HEIC 등)은 원본을 그대로 보내고 서버가 종류를 본다.
 */
const MAX_EDGE = 1400
const QUALITY = 0.82

export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  let bitmap: ImageBitmap
  try {
    // EXIF 회전을 반영해 준다 — 옆으로 누운 사진이 올라가지 않게
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', QUALITY))
  return blob ?? file
}

/** 줄여서 올리고 공개 URL 을 받는다. 실패하면 사유를 던진다 */
export async function uploadPhoto(file: File): Promise<string> {
  const blob = await shrinkImage(file)
  const form = new FormData()
  form.append('file', blob, 'photo.jpg')
  const r = await fetch('/api/upload', { method: 'POST', body: form })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? '사진을 올리지 못했어요')
  return d.url as string
}
