import { call, CONTENT_TYPES, type ContentTypeId } from './kto'
import type { Place } from './types'
import prebuilt from '../data/places.json'

/**
 * 전국 장소 목록.
 *
 * 평소에는 data/places.json 을 읽는다. petTourSyncList2 응답이 8.9MB 라 실시간으로
 * 받으면 매 요청이 그만큼 느려지고, Next.js 데이터 캐시도 항목 상한 2MB 를 넘겨
 * 저장되지 않는다. 서버리스에서는 인스턴스가 자주 새로 떠서 그 비용을 계속 문다.
 *
 * 파일이 낡지 않게 하는 일은 배포 파이프라인이 맡는다 —
 * .github/workflows/collect.yml 이 매일 받아 커밋하고, 커밋이 곧 재배포다.
 *
 * 그 파이프라인이 멈추면 파일은 수집일에 굳는다. 그때를 대비해 파일이 STALE 을
 * 넘기면 실시간 조회로 넘어간다. 느리더라도 낡은 목록보다는 낫고,
 * 무엇보다 조용히 굳지 않는다.
 */
/** 파일을 믿는 기간. 배치가 매일 도니 사흘이면 두 번 넘게 실패한 것이다 */
const STALE = 3 * 24 * 60 * 60 * 1000
/** 실시간 조회로 넘어간 뒤의 재조회 주기 */
const TTL = 6 * 60 * 60 * 1000
const MAX_ROWS = 10000

let snapshot: { at: number; places: Place[] } | null = null
let loading: Promise<Place[]> | null = null

function toPlace(r: any): Place {
  return {
    contentid: String(r.contentid),
    contenttypeid: String(r.contenttypeid),
    title: r.title ?? '',
    addr1: r.addr1 ?? '',
    mapx: Number(r.mapx) || 0,
    mapy: Number(r.mapy) || 0,
    firstimage: r.firstimage ?? '',
    cat: CONTENT_TYPES[Number(r.contenttypeid) as ContentTypeId] ?? '기타',
    lclsSystm1: r.lclsSystm1 ?? '',
    lclsSystm2: r.lclsSystm2 ?? '',
    lclsSystm3: r.lclsSystm3 ?? '',
    regnCd: String(r.lDongRegnCd ?? r.regnCd ?? ''),
    signguCd: String(r.lDongSignguCd ?? r.signguCd ?? ''),
  }
}

async function fetchAll(): Promise<Place[]> {
  const { items } = await call<any>('petTourSyncList2', {
    showflag: 1,
    numOfRows: MAX_ROWS,
    pageNo: 1,
  })

  // 전국 목록이 0건인 상황은 정상일 수 없다. 빈 배열을 그대로 통과시키면 화면에
  // "이 조건에 맞는 장소가 없어요"로 조용히 뜨고, 상류 장애를 아무도 눈치채지 못한다.
  if (items.length === 0) throw new Error('전국 목록이 비어 있어요')

  return items.map(toPlace)
}

/** 배치가 받아둔 목록. 수집 전이면 비어 있다 */
const FILE: Place[] | null = (() => {
  const rows = (prebuilt as { places?: any[] }).places
  return rows?.length ? rows.map(toPlace) : null
})()

/** 파일을 받아둔 시각. 없거나 못 읽으면 0 — 낡은 것으로 친다 */
const FILE_AT = Date.parse((prebuilt as { collectedAt?: string }).collectedAt ?? '') || 0

/**
 * 파일을 그대로 써도 되는지. 배치가 도는 한 항상 참이라 API 호출이 아예 없다.
 * 모듈 로드 시점이 아니라 요청마다 따진다 — 서버가 며칠 떠 있어도 늙는 걸 알아챈다.
 */
const fileUsable = () => FILE !== null && Date.now() - FILE_AT < STALE

/**
 * 동시에 여러 요청이 들어와도 실제 호출은 한 번만 나가게 한다.
 * 파일이 낡아 실시간으로 넘어갔을 때만 도는 경로다.
 */
export async function catalog(): Promise<Place[]> {
  if (fileUsable()) return FILE!

  if (snapshot && Date.now() - snapshot.at < TTL) return snapshot.places
  if (loading) return loading

  loading = fetchAll()
    .then((places) => {
      snapshot = { at: Date.now(), places }
      return places
    })
    .finally(() => {
      loading = null
    })

  // 받아오지 못했는데 파일이라도 있으면 그걸 쓴다. 낡았어도 빈 목록보다 낫다
  return FILE ? loading.catch(() => FILE) : loading
}
