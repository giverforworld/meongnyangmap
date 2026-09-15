/**
 * 목록에서 빼는 장소 — 운영 판단.
 *
 * 데이터에는 있지만 서비스에 싣지 않기로 한 곳. 배치가 매일 목록을 새로 받아오므로
 * 파일에서 지워 봐야 다음 날 되살아난다. 그래서 읽는 쪽에서 거른다.
 * 지도·핫플레이스·내 주변·장소 검색·글 연결 전부 catalog/curate 를 거치므로 여기 한 곳이면 된다.
 */
export const EXCLUDED_IDS: ReadonlySet<string> = new Set([
  '2402981', // 대림동 차이나타운 (2026-09-15)
])

export const isExcluded = (contentid: string) => EXCLUDED_IDS.has(String(contentid))
