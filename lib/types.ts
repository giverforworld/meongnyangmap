export type PetSize = 'small' | 'medium' | 'large'

export interface Pet {
  key: string
  name: string
  breed: string
  kg: number
  emoji: string
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
  allowedSizes: PetSize[] | null
  excludeDangerous: boolean
  needs: string[]
  notes: string[]
  zoneHint: string | null
  /** A: 4개 핵심 필드 모두 · B: 일부 결손 · C: 동반구분만 */
  completeness: 'A' | 'B' | 'C'
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

export interface Place {
  contentid: string
  contenttypeid: string
  title: string
  addr1: string
  mapx: number
  mapy: number
  firstimage: string
  cat: string
  rules: PetRules | null
}
