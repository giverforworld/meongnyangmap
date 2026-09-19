/** 한국관광공사 OpenAPI 클라이언트 — 서버 전용 */
import { boardReady, sbInsertMany } from './supabase'

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

/**
 * 이 프로세스가 지금까지 공사 API 를 부른 횟수(서비스/오퍼레이션별).
 * 배치가 끝날 때 찍어 GitHub Actions 로그에 남기고, 서버에서는 KTO_LOG=1 이면 호출마다 한 줄 남긴다.
 * 공공데이터포털 마이페이지에는 호출 통계가 없다(한도만 보인다) — 그래서 아래 기록기가 Supabase
 * `kto_calls` 에 호출 1건을 1행으로 남긴다. 배치·Vercel·로컬이 같은 키를 쓰니 거기가 유일한 합계다.
 */
export const stats = { total: 0, byOp: {} as Record<string, number> }

/** 포털 활용신청 상세기능 이름. 표에 코드 대신 이 이름이 찍힌다 */
export const OP_NAMES: Record<string, string> = {
  petTourSyncList2: '반려동물 동반여행 정보 동기화 목록 조회',
  detailPetTour2: '반려동물 동반여행 조회',
  detailCommon2: '공통 정보 조회',
  detailIntro2: '소개 정보 조회',
  detailInfo2: '반복 정보 조회',
  detailImage2: '이미지정보조회',
  areaBasedList2: '지역기반 관광정보조회',
  locationBasedList2: '위치기반 관광정보 조회',
  searchKeyword2: '키워드 조회',
  areaCode2: '지역코드 조회',
  categoryCode2: '서비스분류코드조회',
  ldongCode2: '법정동 코드 조회',
  lclsSystmCode2: '분류체계 코드 조회',
  basedList: '고캠핑 기본 정보 목록 조회',
  locgoRegnVisitrDDList: '지역별 방문자수 일별 집계',
  tatsCnctrRatedList: '관광지 집중률 조회',
}

/** 어디서 부른 호출인지 — 환경변수로 자동 판별 */
const SOURCE = process.env.GITHUB_ACTIONS ? 'batch' : process.env.VERCEL ? 'server' : 'local'

type CallRow = {
  at: string
  source: string
  service: string
  op: string
  op_name: string
  rows: number
  ok: boolean
  error: string | null
  ms: number
}

/**
 * 아직 Supabase 에 넣지 않은 호출 행. 호출마다 INSERT 를 날리면 배치(하루 최대 1만 콜)가 두 배로
 * 느려지므로 모아서 보낸다 — 서버는 호출 끝마다 `flushStats()` 를 기다리고(Vercel 은 응답 뒤
 * 프로세스가 멈출 수 있어서), 배치는 `bufferStats()` 로 모아 두다가 CHUNK 마다·끝날 때 보낸다.
 * 기록이 실패해도 공사 API 호출은 성공으로 친다. 통계가 빠지는 쪽이 화면이 죽는 쪽보다 낫다.
 *
 * 실패하면 되돌려 두고 RETRY_AFTER 뒤에 다시 시도한다. 간격 없이 매 호출마다 전부를 다시 보내면
 * 한 번 실패한 뒤로 페이로드가 호출 수의 제곱으로 자란다. 그래도 계속 실패하면 오래된 행부터
 * 버린다(MAX_PENDING) — 메모리와 전송량에 상한이 있어야 한다.
 */
const CHUNK = 500
const MAX_PENDING = 5000
const RETRY_AFTER = 30_000

let pending: CallRow[] = []
let buffered = false
let flushing: Promise<void> | null = null
let retryAt = 0
/** 마지막 저장 실패 사유와 상한에 걸려 버린 행 수 — 배치가 끝날 때 report() 가 찍는다 */
export const flushState = { lastError: null as string | null, dropped: 0 }

/** 배치처럼 오래 사는 프로세스에서 부른다. 끝날 때 `flushStats(true)` 를 잊지 말 것 */
export function bufferStats() {
  buffered = true
}

async function drain(force: boolean) {
  if (!force && Date.now() < retryAt) return
  while (pending.length > 0) {
    const rows = pending.splice(0, CHUNK)
    try {
      if (boardReady) await sbInsertMany('kto_calls', rows)
      flushState.lastError = null
    } catch (e) {
      // 되돌려 놓는다 — RETRY_AFTER 뒤의 flush 가 다시 시도한다
      pending = rows.concat(pending)
      if (pending.length > MAX_PENDING) {
        flushState.dropped += pending.length - MAX_PENDING
        pending.splice(0, pending.length - MAX_PENDING)
      }
      retryAt = Date.now() + RETRY_AFTER
      flushState.lastError = (e as Error).message
      if (process.env.KTO_LOG === '1') console.log(`[kto] 호출 기록 저장 실패: ${flushState.lastError}`)
      return
    }
  }
}

/**
 * 모아 둔 호출 행을 Supabase 에 넣는다. 동시에 여러 번 불려도 INSERT 는 한 번씩만 나간다.
 * `force` 는 프로세스가 끝날 때 — 재시도 간격을 무시하고, 진행 중인 flush 에 합류만 한 게 아니라
 * 남은 행이 있으면 한 번 더 시도한다. 돌려주는 값은 아직 저장 못 한 행 수.
 */
export async function flushStats(force = false): Promise<number> {
  if (!flushing) flushing = drain(force).finally(() => { flushing = null })
  await flushing
  if (force && pending.length > 0) {
    flushing = drain(true).finally(() => { flushing = null })
    await flushing
  }
  return pending.length
}

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

  const key = `${service}/${op}`
  stats.total++
  stats.byOp[key] = (stats.byOp[key] ?? 0) + 1
  if (process.env.KTO_LOG === '1') console.log(`[kto] ${key}`)

  const row: CallRow = {
    at: new Date().toISOString(),
    source: SOURCE,
    service,
    op,
    op_name: OP_NAMES[op] ?? op,
    rows: 0,
    ok: true,
    error: null,
    ms: 0,
  }
  const t0 = Date.now()
  try {
    const out = await request<T>(op, `${BASE}/${service}/${op}?${qs}`)
    row.rows = out.items.length
    return out
  } catch (e) {
    row.ok = false
    row.error = (e as Error).message.slice(0, 300)
    throw e
  } finally {
    row.ms = Date.now() - t0
    pending.push(row)
    // 서버(Vercel)는 응답 뒤 프로세스가 멈출 수 있어 여기서 기다린다. 배치는 CHUNK 마다 흘려 보낸다
    if (!buffered) await flushStats()
    else if (pending.length >= CHUNK) void flushStats()
  }
}

async function request<T>(op: string, url: string): Promise<{ items: T[]; totalCount: number }> {
  const res = await fetch(url, { cache: 'no-store' })
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
