import type { PetSize } from './types'

/**
 * 동반가능동물(acmpyPsblCpam) 원문 → 조건 매핑표.
 *
 * 실데이터에 이 필드는 **148종**뿐이고 그게 831건 전부를 덮는다. 유한하고 작아서
 * 정규식으로 추측하는 대신 한 줄씩 손으로 옮겼다. 대문자 'KG'·합자 '㎏'·공백 없는
 * '제외15Kg이하' 같은 표기 편차가 여기서는 아예 문제가 되지 않는다.
 *
 * 각 항목은 두 명이 독립적으로 원문과 대조해 동의한 것이다.
 *
 * ## 원칙
 * - **원문에 없는 조건을 만들지 않는다.** "전 견종 동반 가능"은 빈 객체다.
 * - `false` 는 적지 않고 **생략**한다. 예컨대 excludeDangerous 를 false 로 박으면
 *   기타정보(etcAcmpyInfo)에 적힌 맹견 배제까지 덮어써 버린다.
 * - 나이·체고·마리수·계절처럼 **구조로 옮길 수 없는 조건**은 필드에 억지로 넣지 않고
 *   `note` 에 남기고 `needsAttention` 을 켠다. 판정을 느슨하게 만들어 초록불을 내는 게
 *   가장 나쁘기 때문이다.
 *
 * 표에 없는 값은 parseRules 의 정규식이 받는다 — 표는 정확도를, 정규식은 미지의 값을 맡는다.
 */
export interface CpamRule {
  noPets?: boolean
  serviceDogOnly?: boolean
  maxKg?: number
  /** '이하'·'이내'는 true, '미만'은 false */
  maxKgInclusive?: boolean
  allowedSizes?: PetSize[]
  excludeDangerous?: boolean
  /** 값이 아니라 "문의하라"는 안내 */
  inquiryOnly?: boolean
  /** 구조로 옮기지 못한 조건이 남아 있어 화면에서 확인을 권해야 한다 */
  needsAttention?: boolean
  /** 옮기지 못한 조건의 원문 요약 */
  note?: string
}

export const CPAM_MAP: Record<string, CpamRule> = {
  // 595건 · 모든 견종을 받는다는 서술뿐 — 무게·크기·맹견 어느 제한도 없으므로 빈 객체.
  ["전 견종 동반 가능"]: {  },
  // 14건 · 맹견만 빼고 전 견종 허용이므로 excludeDangerous 만 켠다 — 크기·무게 제한은 원문에 없다
  ["맹견 제외 전 견종 동반 가능"]: { excludeDangerous: true },
  // 12건 · 견종 제한은 없으나 '이동장에 들어가는 크기'는 kg·크기 어느 필드로도 옮길 수 없는 입장 조건이라 note+직접확인으로 둔다
  ["이동장(켄넬)에 들어가는 전 견종 동반 가능"]: { needsAttention: true, note: "이동장(켄넬)에 들어가는 크기여야 하고 이동장 이용이 사실상 필수" },
  // 9건 · 동반 가능한 동물이 '반려견'이라고만 적혀 있고 무게·크기·견종 제한이 전혀 없다 — 원문에 없는 조건을 만들지 않고 빈 객체로 둔다.
  ["반려견"]: {  },
  // 7건 · 크기만 못 박은 값 — 소형견만 허용이므로 allowedSizes ['small'].
  ["소형견"]: { allowedSizes: ["small"] },
  // 6건 · '중소형견'은 소형+중형 허용, 대형견 배제
  ["중소형견 동반 가능"]: { allowedSizes: ["small", "medium"] },
  // 6건 · 맹견도 입마개만 쓰면 들어갈 수 있는 조건부 허용이라 배제가 아니다. 입마개 조건은 judge 의 MUZZLE_FOR_DANGEROUS 가 원문에서 그대로 읽으므로 별도 필
  ["전 견종 출입 가능(맹견의 경우, 입마개 착용 필수)"]: { note: "맹견은 입마개 착용 필수(조건부 허용)" },
  // 5건 · '이하'라 경계 포함, 다른 조건 없음
  ["9kg 이하 동반 가능"]: { maxKg: 9, maxKgInclusive: true },
  // 4건 · '이하'는 경계 포함이므로 maxKg 10 · inclusive true, 그 외 조건은 없다.
  ["10kg 이하 동반 가능"]: { maxKg: 10, maxKgInclusive: true },
  // 3건 · 안내견만 언급하고 다른 개를 받는다는 표현이 전혀 없다 — 안내견 전용.
  ["맹인 안내견"]: { serviceDogOnly: true },
  // 3건 · 위와 동일하게 안내견만 명시 — 안내견 전용.
  ["시각 장애인 안내견"]: { serviceDogOnly: true },
  // 3건 · '이하'는 경계 포함이라 15kg 인 아이도 가능
  ["15kg 이하 동반 가능"]: { maxKg: 15, maxKgInclusive: true },
  // 3건 · 괄호 안 '맹견 제외'가 유일한 제한
  ["전 견종 동반가능(맹견 제외)"]: { excludeDangerous: true },
  // 3건 · 값이 아니라 물어보라는 안내
  ["전화문의"]: { inquiryOnly: true },
  // 3건 · 아무 제한 없이 동반 가능하다는 서술뿐이라 빈 객체.
  ["반려동물 동반 가능"]: {  },
  // 3건 · '일부 견종'이 어떤 견종인지 알 수 없어 어떤 필드로도 옮길 수 없다 — 안전하게 직접 확인 권고.
  ["일부 견종 동반 가능"]: { needsAttention: true, note: "허용 견종이 무엇인지 원문에 명시되지 않음" },
  // 3건 · 주어 없이 첫머리에서 못 박은 전면 금지 — noPets.
  ["불가"]: { noPets: true },
  // 2건 · '소형견만' 이라 명시 — 중·대형견 불가.
  ["소형견만 동반 가능"]: { allowedSizes: ["small"] },
  // 2건 · 띄어쓰기만 다른 '전 견종 동반 가능' 과 같은 무제한 허용 — 빈 객체.
  ["전 견종 동반가능"]: {  },
  // 2건 · '맹견 제외' 는 명시적 배제. 동물등록 완료 요건은 구조화할 필드가 없어 note 로 옮기고 확인을 권한다.
  ["맹견 제외 동물 등록 완료한 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "동물등록 완료 필요" },
  // 2건 · '이하'는 경계 포함
  ["24kg 이하 동반 가능"]: { maxKg: 24, maxKgInclusive: true },
  // 2건 · 동반 가능 동물로 안내견만 적혀 있으므로 보조견 전용
  ["안내견"]: { serviceDogOnly: true },
  // 2건 · 제한을 말하지 않으므로 빈 객체 — 없는 조건을 만들지 않는다
  ["모든견종"]: {  },
  // 2건 · '맹견은 입장제한'은 명백한 배제라 excludeDangerous, 접종·등록 증빙은 표현할 수 없는 조건이라 note
  ["최근 1년이내 광견병 접종(증빙서류 필요) 을 완료한 등록된 반려견만 입장 가능(단, 맹견은 입장제한 )"]: { excludeDangerous: true, needsAttention: true, note: "최근 1년 이내 광견병 접종(증빙서류) + 동물등록 완료한 반려견만 입장" },
  // 2건 · 크기와 무게가 둘 다 적혀 있어 둘 다 채운다
  ["중, 소형견 (10kg 이하)"]: { maxKg: 10, maxKgInclusive: true, allowedSizes: ["small", "medium"] },
  // 2건 · '맹견 제외' 배제 + '이하' 경계 포함
  ["맹견 제외 10kg 이하 동반 가능"]: { maxKg: 10, maxKgInclusive: true, excludeDangerous: true },
  // 2건 · '이하'라 경계 포함
  ["12kg 이하 동반 가능"]: { maxKg: 12, maxKgInclusive: true },
  // 2건 · '맹견 제외'는 배제이고 '15kg 이하'는 경계 포함, 예방접종은 구조로 옮길 수 없어 note+확인 권고.
  ["맹견 제외 15kg 이하 예방 접종 완료한 전 견종 동반 가능"]: { maxKg: 15, maxKgInclusive: true, excludeDangerous: true, needsAttention: true, note: "예방접종 완료 필요" },
  // 2건 · 대형견 배제 → 중·소형견만, 맹견 배제 → excludeDangerous true.
  ["맹견 및 대형견 제외 동반 가능"]: { allowedSizes: ["small", "medium"], excludeDangerous: true },
  // 2건 · '전 견종 가능'이라 크기·무게·맹견 제한은 없고, 접종·등록 요건만 표현 불가라 note 로 남긴다.
  ["필수 예방접종 및 동물등록 완료한 전 견종 동반 가능"]: { needsAttention: true, note: "필수 예방접종 및 동물등록 완료 필요" },
  // 2건 · '이하'라 경계 포함, 다른 조건 없음.
  ["7kg 이하 반려동물"]: { maxKg: 7, maxKgInclusive: true },
  // 2건 · '이하'는 경계 포함 — maxKg 8, inclusive true.
  ["8kg 이하 동반 가능"]: { maxKg: 8, maxKgInclusive: true },
  // 2건 · 소형견만 허용 — allowedSizes ['small'].
  ["소형견 동반 가능"]: { allowedSizes: ["small"] },
  // 2건 · 크기와 무게가 둘 다 적혀 있어 둘 다 채운다 — '미만'이라 inclusive false.
  ["소형견 (4kg 미만)"]: { maxKg: 4, maxKgInclusive: false, allowedSizes: ["small"] },
  // 2건 · 보조견만 언급하고 다른 개를 받는다는 표현이 없다 — serviceDogOnly.
  ["보조견 동반 입장 가능"]: { serviceDogOnly: true },
  // 1건 · '맹견 제외' 명시. 예방접종 완료 요건은 필드로 못 옮기므로 note 로 남기고 확인 권고.
  ["맹견 제외 예방 접종 완료한 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "예방접종 완료 필요" },
  // 1건 · 원문은 크기·무게 등급을 말하지 않고 '이동장 안에 들어갈 것' 만 요구한다. 소형견으로 단정하면 원문에 없는 조건을 만드는 것이라 필드는 비우고 note+확인 권고로 둔다
  ["몸 전체가 유모차 및 이동장(켄넬) 안에 들어가는 전 견종 동반 가능"]: { needsAttention: true, note: "몸 전체가 유모차·이동장(켄넬) 안에 들어가야 함" },
  // 1건 · 제한 서술이 없는 전면 허용 — 빈 객체.
  ["전 견종 출입 가능"]: {  },
  // 1건 · '이하' 이므로 3kg 정확히도 가능 — 경계 포함.
  ["3kg 이하 동반 가능"]: { maxKg: 3, maxKgInclusive: true },
  // 1건 · '중소형견' 은 소형+중형 허용, 대형견 불가. 이동장 필수는 acmpyNeedMtr 이 아니라 이 필드에만 적혀 judge 의 needs 로 잡히지 않으므로 note+확인
  ["중소형견 동반 가능(이동장 이용 필수)"]: { allowedSizes: ["small", "medium"], needsAttention: true, note: "이동장 이용 필수" },
  // 1건 · 모든 반려견 허용 — 제한 서술 없음, 빈 객체.
  ["모든 반려견 출입가능"]: {  },
  // 1건 · 무게와 크기가 둘 다 적혀 있어 둘 다 채운다. '미만' 이므로 경계 배타(정확히 10kg 은 불가).
  ["10kg미만 소형견"]: { maxKg: 10, maxKgInclusive: false, allowedSizes: ["small"] },
  // 1건 · '맹견 제외' 배제 + '24kg 이하' 경계 포함 상한.
  ["맹견 제외 24kg 이하 동반 가능"]: { maxKg: 24, maxKgInclusive: true, excludeDangerous: true },
  // 1건 · 대문자 'KG' 표기지만 값은 10kg 이하(경계 포함). '소란하거나 사납지 않은' 은 맹견 배제가 아니라 기질 서술이라 excludeDangerous 로 옮기지 않는다 
  ["소란하거나 사납지 않은 10KG 이하 반려견"]: { maxKg: 10, maxKgInclusive: true, note: "소란하거나 사납지 않은 반려동물에 한함(기질 조건)" },
  // 1건 · 대형견을 오히려 허용하는 문장이라 크기 제한이 아니다. 마리수 제한만 있고 이는 표현할 수 없어 note+확인 권고.
  ["대형견 4~5마리까지 가능"]: { needsAttention: true, note: "대형견은 4~5마리까지(마리수 제한)" },
  // 1건 · '맹견 제외' 배제 + '14kg 이하' 경계 포함. 예방접종·동물등록 요건은 note 로.
  ["맹견 제외 14kg 이하 예방접종 및 동물등록 완료한 전 견종 동반 가능"]: { maxKg: 14, maxKgInclusive: true, excludeDangerous: true, needsAttention: true, note: "예방접종 및 동물등록 완료 필요" },
  // 1건 · 견종·무게 제한 없이 마리수만 제한한다. 표현할 수 없는 조건이라 note+확인 권고.
  ["1인 당 반려견 최대 1마리 가능"]: { needsAttention: true, note: "1인당 최대 1마리(마리수 제한)" },
  // 1건 · 사이트별로 허용 크기가 갈릴 뿐 소형·중형·대형 모두 받는 사이트가 있어 장소 전체로는 크기 제한이 없다. '중·소형견' 글자만 보고 allowedSizes 를 채우면 대형
  ["[사이트 별 동반 가능 반려견]\n- 1~9번 : 중·소형견 사이트\n- 10~16번 : 대형견 전용 사이트 (중·소형견 불가)\n- 17~19번(몽골천막에 4면 가림막 사이트) : 중·소형견 전용\n- 20~25번 : 중·소형견 사이트 (대형견 불가)\n*마사토 사이트와 블럭 사이트는 소형견만 가능합니다."]: { needsAttention: true, note: "예약 사이트 번호별로 허용 견종이 다름(1~9·20~25번 중소형견, 10~16번 대형견 전용, 17~19번 중소형견 전용, 마사토·블럭 사이트는 소형견만)" },
  // 1건 · 붙여 쓴 '전견종' 도 전 견종 허용 — 제한 없음, 빈 객체.
  ["전견종 동반 가능"]: {  },
  // 1건 · 확정적으로 표현 가능한 건 '17kg 이하'(경계 포함). '6개월 미만 대형견' 이라는 예외 허용은 나이 조건이라 필드로 옮길 수 없고, 이를 반영해 상한을 풀면 판정이 
  ["17kg 이하 또는 6개월 미만 대형견 동반 가능"]: { maxKg: 17, maxKgInclusive: true, needsAttention: true, note: "6개월 미만 대형견은 무게와 별개로 동반 가능(나이 조건) — 대형견은 문의 권장" },
  // 1건 · '맹견 제외' 배제. 예방접종·동물등록 요건은 note 로 옮기고 확인 권고.
  ["맹견 제외 필수 예방접종 및 동물등록 완료한 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "필수 예방접종 및 동물등록 완료 필요" },
  // 1건 · '맹견 … 제외' 로 맹견은 명시 배제. 질병 관련 제외는 건강한 반려동물이면 충족되는 일반 위생 조항이라 note 로만 남기고 확인 권고는 붙이지 않는다.
  ["맹견 및 가축 전염병에 걸렸거나 질병이 의심되는 반려동물 제외 전 견종 동반 가능"]: { excludeDangerous: true, note: "가축 전염병 감염·질병 의심 반려동물 제외" },
  // 1건 · 무게·크기가 둘 다 적혀 둘 다 채운다. '미만' 이라 경계 배타.
  ["7kg 미만 소형견"]: { maxKg: 7, maxKgInclusive: false, allowedSizes: ["small"] },
  // 1건 · '견동' 은 '견종' 오기. 괄호 안 '맹견 제외' 가 명시적 배제.
  ["전 견동 동반가능(맹견 제외)"]: { excludeDangerous: true },
  // 1건 · 개·고양이 모두 받는다는 대상 안내일 뿐 크기·무게·견종 제한이 없다 — 빈 객체.
  ["반려견 및 반려묘"]: {  },
  // 1건 · '5kg 이하' 인 개가 숙박 가능하다는 뜻 — 경계 포함 상한만 있고 다른 제한은 없다.
  ["5kg 이하 숙박가능한 견종"]: { maxKg: 5, maxKgInclusive: true },
  // 1건 · 무게만 필드로 옮기고 이동장 조건은 표현 불가라 note + 직접 확인 권고
  ["5kg 이하 동반 가능(이동장 이용 필수)"]: { maxKg: 5, maxKgInclusive: true, needsAttention: true, note: "이동장 이용 필수" },
  // 1건 · 합자 문자 ㎏(U+338F) 표기, '미만'이라 20kg 인 아이는 불가
  ["20㎏ 미만 동반 가능"]: { maxKg: 20, maxKgInclusive: false },
  // 1건 · 보조견 예외가 명시돼 있어 serviceDogOnly 가 정확한 표현 — 일반 반려견은 어차피 불가 판정
  ["불가(보조견만 가능)"]: { serviceDogOnly: true },
  // 1건 · '전 견종'의 오타로 보이며 제한 서술이 없어 빈 객체
  ["전 견동 동반 가능"]: {  },
  // 1건 · 무게는 필드로, 마리수는 표현할 수 없어 note + 직접 확인 권고
  ["9kg 이하 1마리 동반 가능"]: { maxKg: 9, maxKgInclusive: true, needsAttention: true, note: "1마리만 동반 가능" },
  // 1건 · 공백 없는 '제외15Kg이하' 표기 — 맹견 배제와 무게 상한 둘 다 채운다
  ["맹견 제외15Kg이하 동반 가능"]: { maxKg: 15, maxKgInclusive: true, excludeDangerous: true },
  // 1건 · '이하'는 경계 포함
  ["4kg 이하 동반 가능"]: { maxKg: 4, maxKgInclusive: true },
  // 1건 · 견종·크기 제한은 없고 예방접종 조건만 있어 note 로 남기고 직접 확인 권고
  ["예방접종을 완료한 전 견종 동반 가능"]: { needsAttention: true, note: "예방접종 완료 필요" },
  // 1건 · 대문자 KG 표기, 무게는 필드로 옮기고 '훈련된' 조건은 확인 불가라 note
  ["훈련된 5KG 이하 반려견"]: { maxKg: 5, maxKgInclusive: true, needsAttention: true, note: "훈련된 반려견에 한함" },
  // 1건 · 맹견 배제는 필드로, 등록 여부는 표현 불가라 note + 직접 확인 권고
  ["맹견 제외 반려동물 등록 완료한 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "반려동물 등록 완료 필요" },
  // 1건 · 크기·무게 제한 없이 배변훈련 조건만 있어 note 로만 남긴다
  ["배변훈련 된 반려동물"]: { needsAttention: true, note: "배변훈련 완료 필요" },
  // 1건 · '이하'는 경계 포함
  ["6kg 이하 동반 가능"]: { maxKg: 6, maxKgInclusive: true },
  // 1건 · 견종 제한은 없고 동물등록 조건만 있어 note + 직접 확인 권고
  ["동물 등록된 전 견종 동반 가능"]: { needsAttention: true, note: "동물등록 완료 필요" },
  // 1건 · 크기와 무게가 둘 다 적혀 있어 둘 다 채우고, 마리수는 note
  ["소형견 (5kg 이하) 1마리"]: { maxKg: 5, maxKgInclusive: true, allowedSizes: ["small"], needsAttention: true, note: "1마리만 동반 가능" },
  // 1건 · 법정 맹견 5종 배제 서술 — 그 외 제한은 없다
  ["- 동물보호법 시행규칙 제1조 2항에 근거한 맹견품종 제외(도사견, 아메리칸 핏불 테리어, 아메리칸 스태퍼드셔 테리어, 스태퍼드셔 불 테리어, 로트와일러 및 그 잡종의 개)"]: { excludeDangerous: true },
  // 1건 · '이내'는 경계 포함이며 소형견 명시가 함께 있어 둘 다 채운다
  ["5kg 이내 소형견"]: { maxKg: 5, maxKgInclusive: true, allowedSizes: ["small"] },
  // 1건 · 대형견 배제는 크기 허용 배열로 옮긴다 — 맹견 배제 서술은 없으므로 건드리지 않는다
  ["대형견 제외 전 견종 동반 가능"]: { allowedSizes: ["small", "medium"] },
  // 1건 · '안내견만 가능'이 잘린 표기 — 보조견 전용
  ["안내견만 가"]: { serviceDogOnly: true },
  // 1건 · '미만'이라 정확히 15kg 인 아이는 불가
  ["15kg 미만 까지만 가능"]: { maxKg: 15, maxKgInclusive: false },
  // 1건 · 일반 반려견 허용 서술이 없어 안전한 쪽으로 보조견 전용 처리하고, 구역 조건과 해석 여지는 note + 직접 확인 권고
  ["보조견 동반 입장 가능. 야외 좌석과 내부 1층만 허용됨."]: { serviceDogOnly: true, needsAttention: true, note: "야외 좌석과 내부 1층만 허용" },
  // 1건 · 공백 없는 '10kg미만' 표기, 경계 배타
  ["10kg미만의 애견"]: { maxKg: 10, maxKgInclusive: false },
  // 1건 · 무게는 필드로, 마리수는 표현 불가라 note + 직접 확인 권고
  ["10kg 이하 반려견 한마리"]: { maxKg: 10, maxKgInclusive: true, needsAttention: true, note: "한 마리만 동반 가능" },
  // 1건 · 제한이 없다는 선언이므로 빈 객체
  ["제한없음"]: {  },
  // 1건 · 소형견만 명시
  ["소형견 동반가능"]: { allowedSizes: ["small"] },
  // 1건 · 견종 제한은 없으나 이동장 필수는 필드로 옮길 수 없는 입장 조건
  ["전 견종 동반 가능(이동장 이용 필수)"]: { needsAttention: true, note: "이동장 이용 필수" },
  // 1건 · 무게·크기 둘 다 채우고, 마리수 제한은 표현 불가라 note
  ["4kg이하 소형견 최대 2마리 동반 가능"]: { maxKg: 4, maxKgInclusive: true, allowedSizes: ["small"], needsAttention: true, note: "최대 2마리" },
  // 1건 · 전 견종 — 아무 제한이 없으므로 빈 값
  ["전견종"]: {  },
  // 1건 · 견종 제한 없음. 마리수·이동장은 표현 불가한 입장 조건이라 note+직접확인
  ["전 견종 1마리 동반 가능(이동장 이용 필수)"]: { needsAttention: true, note: "1마리만 가능 · 이동장 이용 필수" },
  // 1건 · '크기나 견종 상관없이'(오타) — 제한이 없으므로 빈 값
  ["크기나 견종 상관업이 출입 가능"]: {  },
  // 1건 · '미만'이라 경계 배타, 크기·무게 둘 다 명시
  ["중/소형견 10kg 미만만 입실 가능"]: { maxKg: 10, maxKgInclusive: false, allowedSizes: ["small", "medium"] },
  // 1건 · 값이 아니라 문의 안내
  ["문의요망"]: { inquiryOnly: true },
  // 1건 · '이하' 경계 포함, 크기 표현은 없음
  ["5kg 이하 강아지"]: { maxKg: 5, maxKgInclusive: true },
  // 1건 · 소형견만 명시(원문 '소형견' 뒤 공백 2칸 그대로 유지)
  ["소형견  동반 가능"]: { allowedSizes: ["small"] },
  // 1건 · 대문자 KG, '미만'이라 정확히 8kg인 아이는 불가
  ["8KG 미만 반려견"]: { maxKg: 8, maxKgInclusive: false },
  // 1건 · 맹견 배제는 명시. 접종·등록은 필드로 옮길 수 없어 note
  ["맹견 제외 예방접종 및 반려동물 등록 완료한 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "예방접종 및 반려동물 등록 완료 필요" },
  // 1건 · '이하' 경계 포함, 마리수는 표현 불가
  ["7kg 이하 최대 3마리 동반 가능"]: { maxKg: 7, maxKgInclusive: true, needsAttention: true, note: "최대 3마리" },
  // 1건 · 맹견 배제 + 30kg 이하, 마리수는 note
  ["맹견 제외 30kg 이하 최대 1마리 동반 가능"]: { maxKg: 30, maxKgInclusive: true, excludeDangerous: true, needsAttention: true, note: "최대 1마리" },
  // 1건 · 합산 기준이라도 한 마리 상한은 10kg을 넘을 수 없으니 maxKg 10(이하)로 두고, 합산·마리수 조건은 note
  ["합쳐서 10kg이하 2마리까지 동반 가능"]: { maxKg: 10, maxKgInclusive: true, needsAttention: true, note: "2마리까지 · 10kg은 2마리 합산 기준" },
  // 1건 · '반려동물'이라는 대상 표기뿐이라 옮길 조건이 없다 — 빈 값
  ["반려동물"]: {  },
  // 1건 · 맹견 5종과 하이브리드는 출입 제한이라 excludeDangerous. 나이·접종 차수·견종 한정은 필드로 옮길 수 없어 note
  ["- 반려견만 동반 가능- 출입 제한 반려견 1) 법령으로 정해진 맹견 5종 및 5대 맹견의 하이브리드 반려견2) 생후 6개월 이전, 5차 예방접종이 완료 되지 않은 반려견"]: { excludeDangerous: true, needsAttention: true, note: "반려견만 동반 가능(고양이 등 제외) · 생후 6개월 이전이거나 5차 예방접종 미완료 시 출입 제한" },
  // 1건 · 맹견만 배제, 나머지 제한 없음
  ["- 맹견 제외 전 견종 동반가능"]: { excludeDangerous: true },
  // 1건 · 보조견이 언급되지만 반려견도 함께 가능하므로 serviceDogOnly 아님. 크기·무게 제한 없음
  ["반려견 / 보조견 동반 가능"]: { note: "반려견·보조견 대상 — 고양이 등 다른 동물은 언급 없음" },
  // 1건 · 소·중형견 15kg 이하만 확정 허용이고 대형견은 문의 조건부라 안전하게 제외, 맹견은 명시적 불가
  ["소형견~중형견(15kg 이하) 가능, 대형견(15kg 이상)은 사전 문의 필수* 맹견, 털이 많이 빠지는견은 불가"]: { maxKg: 15, maxKgInclusive: true, allowedSizes: ["small", "medium"], excludeDangerous: true, needsAttention: true, note: "대형견(15kg 이상)은 사전 문의 필수 · 털이 많이 빠지는 견종 불가" },
  // 1건 · '미만'이라 경계 배타
  ["10kg 미만 반려견"]: { maxKg: 10, maxKgInclusive: false },
  // 1건 · 소형견만 가능, 마리수는 표현 불가라 note
  ["소형견 1마리"]: { allowedSizes: ["small"], needsAttention: true, note: "1마리" },
  // 1건 · '맹견은 입장제한'은 명시적 배제이고, 접종 증빙·등록 요건은 필드로 옮길 수 없어 확인 권고.
  ["최근 1년이내 광견병 접종(증빙서류 필요) 을 완료한 등록된 반려견만 입장 가능(단, 맹견은 입장제한)"]: { excludeDangerous: true, needsAttention: true, note: "최근 1년 이내 광견병 접종 증빙서류 및 동물등록 완료 필요" },
  // 1건 · 주어가 맹견뿐이라 전면 금지(noPets)가 아니라 맹견 배제로만 읽는다.
  ["맹견 동반 불가"]: { excludeDangerous: true },
  // 1건 · 무게·크기가 둘 다 적혀 있어 둘 다 채우고('미만'이라 경계 배타), 괄호의 맹견 입장 불가로 배제까지 성립.
  ["15kg 미만 중소형견만 입장 가능(맹견 및 대형견 입장 불가)"]: { maxKg: 15, maxKgInclusive: false, allowedSizes: ["small", "medium"], excludeDangerous: true },
  // 1건 · 중·소형견을 받으므로 안내견 전용이 아니며, '15kg 미만' 경계 배타 + 대형견 제외를 함께 채우고 케이지·배변 요건은 note.
  ["대형견 제외 15kg 미만의 중, 소형견 입장 가능케이지나 반려견 유모차 이용배변봉투 지참 및 배변처리 필수시각장애인 안내견, 청각장애인 도우미견 입장 가능"]: { maxKg: 15, maxKgInclusive: false, allowedSizes: ["small", "medium"], needsAttention: true, note: "케이지 또는 반려견 유모차 이용, 배변봉투 지참 및 배변처리 필수" },
  // 1건 · 소형견·10kg 이하를 둘 다 채우고, 마리수 합산 규정은 표현할 수 없어 note+확인 권고.
  ["소형견(10kg이하) 한마리 동반 가능(두마리일 경우 두마리 합쳐서 10kg이하)"]: { maxKg: 10, maxKgInclusive: true, allowedSizes: ["small"], needsAttention: true, note: "1마리 기준, 2마리 동반 시 합산 10kg 이하" },
  // 1건 · 맹견만 배제되고 크기·무게 제한은 없으며, 나이·등록·접종은 구조로 못 옮겨 note 로 남긴다.
  ["맹견 제외 생후 6개월 이상 반려동물등록 및 종합예방접종이 완료된 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "생후 6개월 이상, 반려동물등록 및 종합예방접종 완료 필요" },
  // 1건 · 원문에 숫자나 견종 크기가 없어 allowedSizes 를 지어내지 않되, 이동장에 들어가야 한다는 실질 제한이 있으므로 확인을 권한다.
  ["반려동물 유모차 및 이동장(켄넬)에 들어가는 전 견종 동반 가능"]: { needsAttention: true, note: "반려동물 유모차·이동장(켄넬)에 들어가는 크기만 가능" },
  // 1건 · 중·소형견 허용은 명시적이지만 원문 스스로 상세 기준을 문의하라고 해 확인 권고를 붙인다.
  ["중소형견 동반 가능(상세 기준 사전 확인 필요)"]: { allowedSizes: ["small", "medium"], needsAttention: true, note: "상세 기준 사전 확인 필요" },
  // 1건 · 대문자 표기일 뿐 '10kg 이하'와 같은 뜻이라 경계 포함으로 매핑.
  ["10KG 이하 반려견"]: { maxKg: 10, maxKgInclusive: true },
  // 1건 · '이하'라 경계 포함, 다른 조건 없음.
  ["15kg 이하 반려견"]: { maxKg: 15, maxKgInclusive: true },
  // 1건 · '미만'은 경계 배타라 정확히 10kg 인 아이는 불가.
  ["10kg 미만"]: { maxKg: 10, maxKgInclusive: false },
  // 1건 · 무게 상한만 필드로 옮기고 접종 요건은 note+확인 권고.
  ["예방접종 완료한 20kg 이하 동반 가능"]: { maxKg: 20, maxKgInclusive: true, needsAttention: true, note: "예방접종 완료 필요" },
  // 1건 · 소형견 전용 + 12kg 미만을 둘 다 채우고, 체고 40cm 기준은 표현할 수 없어 note 로 남긴다.
  ["소형견 전용 펜션으로 40cm 이하, 12kg 미만의 소형견, (몸무게 초과 시 문의, 대형견 불가)."]: { maxKg: 12, maxKgInclusive: false, allowedSizes: ["small"], needsAttention: true, note: "체고 40cm 이하, 몸무게 초과 시 문의" },
  // 1건 · 제한이 전혀 없으므로 빈 객체.
  ["모든 견종 동반 가능"]: {  },
  // 1건 · '이하'라 경계 포함, 다른 조건 없음.
  ["15kg 이하 반려견 동반가능"]: { maxKg: 15, maxKgInclusive: true },
  // 1건 · 반려동물 속성 제한은 없고 이용 구역만 한정돼 있어 note 로 남기고 확인을 권한다.
  ["가능 (실외좌석만 가능)"]: { needsAttention: true, note: "실외좌석만 동반 가능" },
  // 1건 · '맹견 X'는 맹견 배제 표기이고, 등록·접종 요건은 구조로 옮길 수 없어 note+확인 권고.
  ["동물등록을 완료한 반려견, \n예방접종 4차 이상 완료한 반려견,\n맹견 X"]: { excludeDangerous: true, needsAttention: true, note: "동물등록 완료 및 예방접종 4차 이상 필요" },
  // 1건 · 개는 소형견만 허용된다고 못 박았으므로 allowedSizes ['small'] — 고양이 허용 여부는 견종 판정에 영향이 없다.
  ["가능(소형견, 고양이)"]: { allowedSizes: ["small"] },
  // 1건 · 동물 속성이 아니라 구역만 한정한 값이라 필드로 옮길 게 없고, 일부 구역 제한이므로 확인을 권한다.
  ["베이커리존 제외갤러리&스튜디오동&야외테라스만"]: { needsAttention: true, note: "베이커리존 제외, 갤러리·스튜디오동·야외테라스만 동반 가능" },
  // 1건 · 제한 없이 동반 입장 가능하다는 서술뿐이라 빈 객체.
  ["반려동물 동반입장 가능"]: {  },
  // 1건 · 무게 상한만 필드로 옮기고 마리수·추가비용은 표현할 수 없어 note+확인 권고.
  ["10kg이하  1마리까지 가능. 단 1마리당  2만원 추가비용."]: { maxKg: 10, maxKgInclusive: true, needsAttention: true, note: "1마리까지, 마리당 2만원 추가 비용" },
  // 1건 · '미만'이라 경계 배타이고 '중, 소형견'은 중·소형 허용이라 둘 다 채운다.
  ["8kg 미만의 중, 소형견"]: { maxKg: 8, maxKgInclusive: false, allowedSizes: ["small", "medium"] },
  // 1건 · '맹견품종 제외'는 명시적 배제라 excludeDangerous true — 법정 5종 밖 품종·등록 요건은 필드로 못 옮겨 note+확인 권고.
  ["- 동물보호법 시행규칙 제1조 2항에 근거한 맹견품종 제외(도사견, 아메리칸 핏불 테리어, 아메리칸 스태퍼드셔 테리어, 스태퍼드셔 불 테리어, 로트와일러 및 그 잡종의 개)- 동물보호법 상 맹견으로 표기되지 않았으나 위압감을 주거나 공격성향이 강한 품종 제외(도고 아르헨티노, 케인코르소, 오브차카, 티베탄 마스티프, 울프독 등)- 기타 다른 반려견이나 사람에게 피해를 줄 수 있는 개 제외- 반려동물 등록이 되어 있지 않은 개 제외"]: { excludeDangerous: true, needsAttention: true, note: "법정 맹견 외 추가 제외 품종(도고 아르헨티노·케인코르소·오브차카·티베탄 마스티프·울프독 등), 공격성 있는 개 제외, 반려동물 등록 필수" },
  // 1건 · 소형견만 허용이라 ['small'] — 이동장 필수는 이 필드들로 표현할 수 없어 note+확인 권고.
  ["소형견 동반 가능(이동장 이용 필수)"]: { allowedSizes: ["small"], needsAttention: true, note: "이동장 이용 필수" },
  // 1건 · 대형견 제한이 '계절 한정'이라 allowedSizes로 옮기면 원문에 없는 상시 배제를 만든다 — 계절 조건은 note+확인 권고.
  ["- 대형견은 여름에만 동반 가능합니다.(야외테이블 이용 가능 계절, 보호자의 각별한 주의를 요청드립니다.)\n- 고양이나 다른 반려동물도 입장 가능하나, 동물에 따라 필요한 경우 케이지를 이용해야 합니다."]: { needsAttention: true, note: "대형견은 여름(야외테이블 이용 계절)에만 동반 가능, 동물에 따라 케이지 필요" },
  // 1건 · 맹견 제외+12kg 미만은 필드로 옮기고, 체고·나이·등록 조건은 표현 불가라 note+확인 권고.
  ["맹견 제외 체중 12kg 미만, 체고 40cm 미만, 4개월령 이상 10세 미만의 동물등록을 마친 전 견종 동반 가능"]: { maxKg: 12, maxKgInclusive: false, excludeDangerous: true, needsAttention: true, note: "체고 40cm 미만, 4개월령 이상 10세 미만, 동물등록 필수" },
  // 1건 · 제한이 하나도 없는 전면 허용 — 빈 객체.
  ["전 견종  동반 가능"]: {  },
  // 1건 · 대문자 'Kg' 표기지만 값은 동일 — 9kg 이하, 경계 포함.
  ["9Kg 이하 동반 가능"]: { maxKg: 9, maxKgInclusive: true },
  // 1건 · 견종·크기·무게 제한은 없고 현장 재량 조건만 있어 필드로 못 옮긴다 — 헛걸음 방지를 위해 확인 권고.
  ["전 견종 동반 가능(단, 짖음, 공격성이 심한 반려견은 현장에서 입장 제한될 수 있음)"]: { needsAttention: true, note: "짖음·공격성이 심한 반려견은 현장에서 입장 제한될 수 있음" },
  // 1건 · 견종 제한은 없으나 동물등록 요건은 표현할 수 없어 note+확인 권고.
  ["동물 등록 완료한 전 견종 동반 가능"]: { needsAttention: true, note: "동물등록 완료 필요" },
  // 1건 · '이하'는 경계 포함 — maxKg 10, inclusive true.
  ["10kg 이하 반려견"]: { maxKg: 10, maxKgInclusive: true },
  // 1건 · 소형견만 허용이라 ['small'] — '훈련된'은 판정 불가 조건이라 note+확인 권고.
  ["훈련된 소형견"]: { allowedSizes: ["small"], needsAttention: true, note: "훈련된 개에 한함" },
  // 1건 · 맹견 제외만 필드로 옮기고 예방접종·월령은 표현 불가라 note+확인 권고.
  ["맹견 제외 예방접종 완료한 3개월 이상의 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "예방접종 완료, 3개월령 이상" },
  // 1건 · 크기·무게 제한은 없고 마리수 조건뿐 — 필드로 못 옮겨 note+확인 권고.
  ["1인 당 최대 반려견 2마리 가능"]: { needsAttention: true, note: "1인당 최대 2마리" },
  // 1건 · 소형견만 허용이라 ['small'] — 마리수 제한은 표현 불가라 note+확인 권고.
  ["소형견(1마리)"]: { allowedSizes: ["small"], needsAttention: true, note: "1마리" },
  // 1건 · 마리수 조건만 있고 크기·무게 언급이 없다 — note+확인 권고.
  ["객실 당 반려견 1마리"]: { needsAttention: true, note: "객실당 1마리" },
  // 1건 · '만'으로 못 박은 소형견 전용 — allowedSizes ['small'].
  ["소형견만 가능"]: { allowedSizes: ["small"] },
  // 1건 · 공백 없는 '10kg이하' 표기지만 값은 동일 — 10kg 이하, 경계 포함.
  ["10kg이하 동반 가능"]: { maxKg: 10, maxKgInclusive: true },
  // 1건 · 맹견 제외는 필드로, 동물등록 요건은 표현 불가라 note+확인 권고.
  ["맹견 제외 동물등록 완료한 전 견종 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "동물등록 완료 필요" },
  // 1건 · 개·고양이 모두 가능하고 어떤 제한도 없다 — 빈 객체.
  ["가능(강아지, 고양이)"]: {  },
  // 1건 · 전면 금지가 아니라 특정 품종군 배제인데 견종을 특정할 수 없다 — noPets로 읽지 않고 확인 권고.
  ["털날림 많은 종은 불가"]: { needsAttention: true, note: "털날림 많은 종은 불가" },
  // 1건 · 동반 가능한 동물 종류만 나열했고 제한 조건이 없다 — 빈 객체.
  ["개, 고양이"]: {  },
  // 1건 · 크기와 무게가 둘 다 적혀 있어 둘 다 채운다 — '미만'이라 inclusive false.
  ["소형견 10kg 미만"]: { maxKg: 10, maxKgInclusive: false, allowedSizes: ["small"] },
  // 1건 · '입장불가' 는 해수욕장 개장 기간이라는 계절 조건에 붙은 것이지 전면 금지가 아니라 noPets 로 두지 않는다. 맹견은 입마개 조건부 허용. 계절 조건은 표현할 수 없어
  ["- 해수용장 개장시에는 입장불가\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수"]: { needsAttention: true, note: "해수욕장 개장 기간에는 입장 불가(계절 조건) · 배변봉투 지참 및 배변처리 필수 · 맹견은 입마개 착용 필수" },
  // 1건 · '10kg 이하' 라 경계 포함. 다만 케이스를 포함한 무게라 실제 아이 무게 상한은 10kg 보다 낮고, 케이스 길이 조건도 있어 확인을 권한다.
  ["케이스 포함 무게 10kg 이하이고 케이스 길이 100cm 이내 동반 가능"]: { maxKg: 10, maxKgInclusive: true, needsAttention: true, note: "케이스(이동장) 포함 무게 기준이라 실제 반려동물 무게 상한은 더 낮음 · 케이스 길이 100cm 이내" },
  // 1건 · 40cm는 무게가 아니라 체고라 maxKg에 절대 넣지 않고 note로만 남긴다
  ["맹견 제외 40cm 이하 동반 가능"]: { excludeDangerous: true, needsAttention: true, note: "체고 40cm 이하" },
  // 1건 · 맹견을 배제한 게 아니라 입마개 조건부 허용이므로 excludeDangerous false — 그 외 제한 없음.
  ["전 견종 동반가능(맹견 입마개 착용 시 입장 가능)"]: { note: "맹견은 입마개 착용 시 입장 가능" },}

/** 표기 편차를 흡수해 조회한다 — 앞뒤 공백과 연속 공백만 정규화한다 */
export function lookupCpam(text: string): CpamRule | null {
  const t = text.trim()
  if (!t) return null
  return CPAM_MAP[t] ?? CPAM_MAP[t.replace(/\s+/g, ' ')] ?? null
}
