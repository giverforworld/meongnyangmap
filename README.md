# 멍냥맵

우리 아이 기준으로 반려동물 동반 입장 가능 여부를 판정해 헛걸음을 막아주는 서비스.
2026 관광데이터 활용 공모전 웹·앱 구현 부문 · 지정과제 6번.

출처: ⓒ한국관광공사

## 실행

```bash
npm run dev
```

> ⚠️ 이 머신에서는 Next.js 첫 부팅이 매우 느립니다(수 분). `next --version`만 90초 이상 걸립니다.
> 포트가 열릴 때까지 기다리세요.

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## 구조

```
lib/
  kto.ts        한국관광공사 KorPetTourService2 클라이언트 (서버 전용)
  petTour.ts    자연어 조건 파서 + 판정 엔진   ← 서비스의 핵심
  types.ts      타입 정의
app/
  api/regions/  ldongCode2 — 시도·시군구 269건을 1콜로
  api/places/   areaBasedList2 ×5 + detailPetTour2 — 목록 + 동반 조건
  page.tsx      멍냥맵 화면 (헤더 / 필터 / 리스트 / 지도 / 상세 패널)
```

## 판정 엔진

`detailPetTour2`가 주는 조건은 코드가 아니라 **자연어 문장**이다.
이 모호함이 지정과제 6번이 지목한 문제의 원인이므로, 파싱해서 판정으로 바꾸는 것이 서비스의 핵심이다.

| 필드 | 채움률 | 처리 |
|---|---:|---|
| `acmpyTypeCd` 동반구분 | 97% | `전구역`(62%) / `일부구역`(38%) 2종 |
| `acmpyPsblCpam` 동반가능동물 | 57% | 84종 자유 텍스트 → 무게·크기·견종 파싱 |
| `acmpyNeedMtr` 동반시 필요사항 | 52% | 콤마 split → 준비물 체크리스트 |
| `etcAcmpyInfo` 기타 동반정보 | 51% | `- ` split → 규정 리스트 |

나머지 5개 필드는 0~11%라 판정에 쓰지 않는다.

### 판정 결과

- 🟢 **입장 가능** — 조건 충족
- 🟡 **조건부 가능** — 일부 구역만 / 준비물 미보유 / 정보 부족
- 🔴 **불가** — 무게·크기 초과, 동반 불가 (지도에서 숨김)

정보가 없으면 판정을 지어내지 않고 `조건 정보 충실도 C등급`으로 표시한다.
예: 광안리해수욕장은 `일부구역 동반가능`이지만 어느 구역인지 API에 없다.

## 데이터

전체 9,693건 중 **실사용 1,046건**.

- 쇼핑(38) 8,647건은 약국·안경원·의원 등 노이즈 → 제외
- 행사(15)는 0건
- `locationBasedList2`는 서버가 쇼핑을 이미 제외하지만, `areaBasedList2`·`searchKeyword2`는 포함하므로 직접 필터링

## 환경변수

`.env.local` (git 제외됨)

```
KTO_SERVICE_KEY=<공공데이터포털 일반 인증키>
KTO_MOBILE_APP=MeongNyangPass
```

`MobileApp` 값은 전 호출 동일하게 유지한다 — 활용 통계 집계 기준이자 운영계정 승인 요건.

## 남은 작업

- [x] 카카오맵 SDK 연동 (`NEXT_PUBLIC_KAKAO_MAP_KEY` 필요)
- [ ] 리뷰 기능 (Supabase)
- [ ] 멍냥 커뮤니티 (동네별 게시판)
- [ ] 전화 확인 버튼 → `detailIntro2`의 타입별 `infocenter*` 연결
- [ ] 배포 → 운영계정 신청 (일 1,000건 → 100,000건)

## 참고

- [`../PET_API_GUIDE.md`](../PET_API_GUIDE.md) — API 명세·활용 방안
- [`../API USING GUIDE.md`](../API%20USING%20GUIDE.md) — 터미널 실행 명령
- [`../PET API 실행결과.md`](../PET%20API%20실행결과.md) — 실측 검증 기록
