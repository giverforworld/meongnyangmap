import { call, CONTENT_TYPES, type ContentTypeId } from './kto'
import type { Place } from './types'
import prebuilt from '../data/places.json'

/**
 * 전국 장소 목록.
 *
 * 일 배치(`npm run collect`)가 petTourSyncList2 로 전국 9,691건을 받아 data/places.json 에
 * 넣어 둔다. 화면은 그 파일을 읽는다 — 콜드 스타트 7.3초가 0초가 되고, 상류가 장애를
 * 겪어도 목록은 그대로 뜬다. 배치가 매일 도니 API 호출은 계속 일어난다.
 *
 * 파일이 비어 있으면(수집 전) 예전처럼 실시간으로 받는다.
 */
const TTL = 5 * 60 * 1000
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

/** 동시에 여러 요청이 들어와도 실제 호출은 한 번만 나가게 한다 */
export async function catalog(): Promise<Place[]> {
  if (FILE) return FILE

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

  return loading
}
