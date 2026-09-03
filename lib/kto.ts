/** 한국관광공사 반려동물 동반여행 서비스 (KorPetTourService2) 클라이언트 — 서버 전용 */

const BASE = 'https://apis.data.go.kr/B551011/KorPetTourService2'

/** 콘텐츠 타입 — 15(행사)는 실데이터 0건, 38(쇼핑)은 조건 데이터 0%라 제외 */
export const CONTENT_TYPES = {
  12: '관광지',
  14: '문화시설',
  28: '레포츠',
  32: '숙박',
  39: '음식점',
} as const

export type ContentTypeId = keyof typeof CONTENT_TYPES

function serviceKey() {
  const k = process.env.KTO_SERVICE_KEY
  if (!k) throw new Error('KTO_SERVICE_KEY 가 .env.local 에 없습니다')
  // 포털 발급 키는 URL 인코딩된 형태 — 디코딩해서 사용한다
  return decodeURIComponent(k)
}

export async function call<T = any>(
  op: string,
  params: Record<string, string | number> = {}
): Promise<{ items: T[]; totalCount: number }> {
  const qs = new URLSearchParams({
    serviceKey: serviceKey(),
    MobileOS: 'ETC',
    MobileApp: process.env.KTO_MOBILE_APP ?? 'MeongNyangPass',
    _type: 'json',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  const res = await fetch(`${BASE}/${op}?${qs}`, { cache: 'no-store' })
  const text = await res.text()

  // 인증 실패·한도 초과는 JSON이 아니라 XML로 온다
  if (text.trimStart().startsWith('<')) {
    const reason = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1] ?? 'UNKNOWN'
    throw new Error(`KTO API 오류 (${op}): ${reason}`)
  }

  const json = JSON.parse(text)
  const body = json?.response?.body
  const raw = body?.items

  // 결과 0건이면 items 가 빈 문자열로 온다
  if (!raw || raw === '') return { items: [], totalCount: 0 }

  const item = raw.item
  const items = Array.isArray(item) ? item : item ? [item] : []
  return { items, totalCount: Number(body.totalCount ?? items.length) }
}

/** numOfRows 에 상한이 없다. totalCount 보다 크면 전체를 반환한다 */
export const ALL = 99999
