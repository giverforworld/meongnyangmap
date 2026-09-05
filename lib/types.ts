export type PetSize = 'small' | 'medium' | 'large'

export interface Pet {
  key: string
  name: string
  breed: string
  kg: number
  emoji: string
  /** 프로필 사진. 파일이 없거나 못 읽으면 emoji 로 되돌아간다 */
  photo?: string
  size: PetSize
  sizeLabel: string
  hasCage: boolean
  hasMuzzle: boolean
  isDangerous: boolean
}

/** detailPetTour2 원본 9필드 */
export interface PetTourRaw {
  contentid: string
  acmpyTypeCd?: string
  acmpyPsblCpam?: string
  acmpyNeedMtr?: string
  etcAcmpyInfo?: string
  relaAcdntRiskMtr?: string
  relaPosesFclty?: string
  relaFrnshPrdlst?: string
  relaRntlPrdlst?: string
  relaPurcPrdlst?: string
}

/** 자연어 조건을 구조화한 결과 */
export interface PetRules {
  zone: 'all' | 'partial' | 'unknown'
  noPets: boolean
  serviceDogOnly: boolean
  maxKg: number | null
  /**
   * maxKg 의 경계 포함 여부 — 원문이 '미만'이면 false, '이하'·'이내'면 true, maxKg 가 null 이면 null.
   * 선택 필드인 이유: 미리 받아둔 스냅샷(data/petRules.json)에는 이 키가 없다.
   * 없으면(undefined) 종전대로 '이하'(경계 포함)로 읽어 기존 판정을 그대로 유지한다.
   */
  maxKgInclusive?: boolean | null
  allowedSizes: PetSize[] | null
  excludeDangerous: boolean
  needs: string[]
  notes: string[]
  zoneHint: string | null
  /** A: 4개 핵심 필드 모두 · B: 일부 결손 · C: 동반구분만 */
  completeness: 'A' | 'B' | 'C'
  /**
   * 나이·체고·마리수·계절처럼 구조로 옮길 수 없는 조건이 원문에 남아 있을 때의 안내문.
   * 판정을 느슨하게 만드는 대신 화면에서 직접 확인을 권한다.
   */
  attention: string | null
  raw: PetTourRaw
}

export type JudgeStatus = 'ok' | 'cond' | 'no'

export interface Check {
  icon: '✓' | '!' | '✕'
  color: string
  text: string
}

export interface Judgement {
  status: JudgeStatus
  why?: string
  checks: Check[]
}

/**
 * 목록(areaBasedList2)에서 오는 정보만 담는다. 동반 조건은 장소당 1콜이라
 * 목록과 함께 받지 않고, 화면에 실제로 그려질 때 따로 조회한다.
 */
export interface Place {
  contentid: string
  contenttypeid: string
  title: string
  addr1: string
  mapx: number
  mapy: number
  firstimage: string
  cat: string
  /** 분류체계 — 쇼핑처럼 큰 덩어리를 세분류로 나눠 거르는 데 쓴다 */
  lclsSystm1: string
  lclsSystm2: string
  lclsSystm3: string
  /** 법정동 시도·시군구 코드. 전국 목록에서 지역을 걸러내는 데 쓴다 */
  regnCd: string
  signguCd: string
}

/** 상세 패널에서 쓰는 부가 정보. 타입마다 필드명이 달라 여기서 통일한다 */
export interface Detail {
  /** detailCommon2 */
  overview: string
  homepage: string
  /** detailIntro2 */
  usetime: string
  restdate: string
  parking: string
  tels: string[]
  /** detailInfo2 — 입장료·시설 안내. 없는 곳이 많다 */
  extras: { name: string; text: string }[]
  /** detailImage2 — Type3 은 변경 금지 */
  images: { url: string; copyright: string }[]
}

/** 조건 조회 상태 — '아직 안 받음'과 '받았는데 미등록'은 다른 상태다 */
export type RulesEntry =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'done'; rules: PetRules | null }

/** 카드·핀에 표시할 상태. 판정 2종 + 조건을 아직 못 받은 2종 */
export type CardState = 'ok' | 'cond' | 'loading' | 'failed'
