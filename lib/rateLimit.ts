/**
 * 아주 단순한 IP 별 호출 제한 — 서버 인스턴스 메모리에 둔다.
 *
 * 인스턴스마다 따로 세므로 정확한 한도는 아니지만, 스크립트로 한 장소에 '입장 거부'를
 * 수백 건 꽂아 넣는 식의 조작을 막는 데는 충분하다. 사진 업로드 라우트가 먼저 같은 방식을 썼다.
 */
const buckets = new Map<string, number[]>()

export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= limit) return false
  list.push(now)
  buckets.set(key, list)
  if (buckets.size > 5000) buckets.clear() // 메모리가 무한히 자라지 않게
  return true
}

/** 요청의 IP — Vercel 은 x-forwarded-for 첫 값 */
export const ipOf = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'

/** 한국 시간 기준 오늘(YYYY-MM-DD). 서버는 UTC 라 자정~9시 사이 '오늘'이 하루 어긋난다 */
export function todayKST(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
