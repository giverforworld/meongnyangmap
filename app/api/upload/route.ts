import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { boardReady, sbUpload } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 사진 업로드 — 게시글·리뷰가 같이 쓴다.
 *
 * 브라우저가 먼저 1,400px 안으로 줄여 JPEG 로 보낸다(lib/photo.ts). 그래도 여기서
 * 종류와 크기를 다시 본다 — 요청은 화면을 거치지 않고도 올 수 있다.
 * 파일 이름은 버리고 무작위 이름을 쓴다. 남의 사진을 덮어쓸 길을 두지 않는다.
 */
const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * 한 주소에서 10분에 30장. 글쓰기와 달리 사진은 지워지지 않는 저장소를 먹어서,
 * 아무 제한이 없으면 스크립트 하나로 버킷을 채울 수 있다. 서버리스라 인스턴스마다
 * 따로 세지만, 그래도 없는 것보다 훨씬 낫다. 실제 사람이 닿을 숫자는 아니다.
 */
const WINDOW_MS = 10 * 60 * 1000
const PER_WINDOW = 30
const hits = new Map<string, number[]>()
function allow(ip: string) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (list.length >= PER_WINDOW) return false
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear() // 메모리가 무한히 자라지 않게
  return true
}

/** 확장자가 아니라 내용의 첫 바이트로 종류를 확인한다 */
function sniff(buf: Uint8Array): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length > 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  return null
}

export async function POST(req: Request) {
  if (!boardReady) return NextResponse.json({ error: '사진 저장소가 연결되지 않았어요' }, { status: 503 })
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!allow(ip)) return NextResponse.json({ error: '사진을 너무 많이 올렸어요. 잠시 후 다시 시도해주세요' }, { status: 429 })
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) return bad('사진 파일이 없어요')
    if (file.size > MAX_BYTES) return bad('사진은 5MB 까지 올릴 수 있어요')

    const buf = await file.arrayBuffer()
    const type = sniff(new Uint8Array(buf))
    if (!type) return bad('JPEG · PNG · WebP 사진만 올릴 수 있어요')

    const d = new Date()
    const path = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${TYPES[type]}`
    const url = await sbUpload(path, buf, type)
    return NextResponse.json({ url })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })
