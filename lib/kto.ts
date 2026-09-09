/** 한국관광공사 OpenAPI 클라이언트 — 서버 전용 */

const BASE = 'https://apis.data.go.kr/B551011'

/**
 * 서비스마다 경로가 다르고 인증키는 하나를 공유한다(공공데이터포털은 계정당 1키).
 * 기본값은 반려동물 동반여행 — 이 서비스가 판정의 근거라 대부분의 호출이 여기로 간다.
 */
export const SERVICE = {
  pet: 'KorPetTourService2',
  camping: 'GoCamping',
} as const

/**
 * 콘텐츠 타입 — API가 제공하는 7종 전부를 받는다. 무엇을 볼지는 화면 필터가 정한다.
 * 15(행사)는 현재 전 지역 0건이지만, 데이터가 생기면 자동으로 잡히도록 남겨둔다.
 */
export const CONTENT_TYPES = {
  12: '관광지',
  14: '문화시설',
  15: '행사',
  28: '레포츠',
  32: '숙박',
  38: '쇼핑',
  39: '음식점',
} as const

export type ContentTypeId = keyof typeof CONTENT_TYPES

function serviceKey() {
  const k = process.env.KTO_SERVICE_KEY
  if (!k) throw new Error('KTO_SERVICE_KEY 가 .env.local 에 없습니다')
  // 포털 발급 키는 URL 인코딩된 형태 — 디코딩해서 사용한다
  return decodeURIComponent(k)
}

/**
 * Next.js 데이터 캐시(`next: { revalidate }`)는 쓰지 않는다 —
 * petTourSyncList2 응답이 8.9MB 라 캐시 항목 상한 2MB 를 넘겨 저장에 실패하고
 * 경고만 쌓인다. 재조회를 막는 일은 부르는 쪽이 직접 한다.
 */
export async function call<T = any>(
  op: string,
  params: Record<string, string | number> = {},
  service: string = SERVICE.pet
): Promise<{ items: T[]; totalCount: number }> {
  const qs = new URLSearchParams({
    serviceKey: serviceKey(),
    MobileOS: 'ETC',
    MobileApp: process.env.KTO_MOBILE_APP ?? 'MeongNyangPass',
    _type: 'json',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  const res = await fetch(`${BASE}/${service}/${op}?${qs}`, { cache: 'no-store' })
  const text = await res.text()

  // 인증 실패·한도 초과는 JSON이 아니라 XML로 온다
  if (text.trimStart().startsWith('<')) {
    const reason = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1] ?? 'UNKNOWN'
    throw new Error(`KTO API 오류 (${op}): ${reason}`)
  }

  const json = JSON.parse(text)

  // 한도 초과·인증 실패는 XML 말고 이 JSON 봉투로도 온다. 봉투가 달라서
  // response.body 가 undefined 가 되고, 놓치면 아래에서 '결과 0건'으로
  // 통과해 화면에는 '조건 정보 미등록'으로 잘못 표시된다.
  const err = json?.OpenAPI_ServiceResponse?.cmmMsgHeader
  if (err) {
    // 코드(errMsg)와 한글 설명(returnAuthMsg)을 함께 남긴다. 한글만 남기면
    // 호출한 쪽에서 '한도 초과'인지 코드로 판별할 수 없다.
    const code = err.errMsg ?? 'UNKNOWN'
    const why = err.returnAuthMsg ? ` — ${err.returnAuthMsg}` : ''
    throw new Error(`KTO API 오류 (${op}): ${code}${why}`)
  }

  const header = json?.response?.header
  if (header?.resultCode && header.resultCode !== '0000') {
    throw new Error(`KTO API 오류 (${op}): ${header.resultMsg ?? header.resultCode}`)
  }

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
