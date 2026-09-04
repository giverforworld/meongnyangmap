# 데이터 출처 지도 — 어느 컬럼이 어느 API에서 왔나

Supabase 테이블의 모든 컬럼이 어떤 오퍼레이션의 어떤 필드에서 왔는지 적는다.
`raw jsonb` 에 원본이 통째로 남아 있으니, 표에 없는 필드도 거기서 확인할 수 있다.

---

## 먼저 — 오퍼레이션이 몇 개인가

**공식 명세는 11개, 포털 활용신청 목록은 13개다.**

[공식 명세](https://api.visitkorea.or.kr/#/useKorPetTour) `KorPetTourService2` v1.1 (2024-10-22 시작):

```
 1 areaBasedList2       지역기반 관광정보 조회
 2 locationBasedList2   위치기반 관광정보 조회
 3 searchKeyword2       키워드 검색 조회
 4 detailCommon2        공통정보 조회      (상세정보1)
 5 detailIntro2         소개정보 조회      (상세정보2)
 6 detailInfo2          반복정보 조회      (상세정보3)
 7 detailImage2         이미지정보 조회    (상세정보4)
 8 detailPetTour2       반려동물 동반여행 조회 (상세정보5)
 9 petTourSyncList2     동기화 목록 조회
10 ldongCode2           법정동 코드 조회
11 lclsSystmCode2       분류체계 코드 조회
```

**`areaCode2` 와 `categoryCode2` 는 이 명세에 없다.** 포털 활용신청에는 있고 호출하면 응답도 하지만,
공식 문서에서 빠진 구버전이다. 번호 체계도 다르다(서울이 `ldongCode2` 에선 `11`, `areaCode2` 에선 `1`).
**새 코드에 쓰면 안 된다** — DB에는 비교 목적으로만 넣어 뒀다.

> 데이터 갱신주기는 **일 1회**라고 명세에 적혀 있다. 일 배치로 받는 지금 방식과 맞는다.

---

## 우리가 쓰는 것 — 11개 중 8개

| # | 오퍼레이션 | 쓰나 | 어디에 |
|---|---|---|---|
| 9 | `petTourSyncList2` | ✅ | `places` 전량 (1콜) |
| 8 | `detailPetTour2` | ✅ | `pet_rules` — **이 서비스의 핵심** |
| 4 | `detailCommon2` | ✅ | `place_details.overview` · `homepage` |
| 5 | `detailIntro2` | ✅ | `place_details` 영업시간·휴무일·주차·전화 |
| 6 | `detailInfo2` | ✅ | `place_details.extras` |
| 7 | `detailImage2` | ✅ | `place_details.images` |
| 10 | `ldongCode2` | ✅ | `codes` (source=`ldong`) |
| 11 | `lclsSystmCode2` | ✅ | `codes` (source=`lcls`) |
| 1 | `areaBasedList2` | ❌ | `petTourSyncList2` 로 대체 — 아래 설명 |
| 2 | `locationBasedList2` | ❌ | 브라우저 거리계산으로 대체 |
| 3 | `searchKeyword2` | ❌ | 전국 목록 위 SQL/필터로 대체 |
| — | `areaCode2` | ⚠️ | `codes` (source=`area`) — 비교용 |
| — | `categoryCode2` | ⚠️ | `codes` (source=`category`) — 비교용 |

### 안 쓰는 3개, 왜

**`areaBasedList2`** — 지역·타입별로 나눠 부르는 목록이다. 타입당 1콜이라 한 지역에 7콜이 든다.
`petTourSyncList2` 가 **전국 9,691건을 1콜**에 주고 내용이 완전히 같아서(서울 3,170 · 부산 653 ·
경기 2,606 로 건수까지 일치) 통째로 대체했다.

**`locationBasedList2`** — 좌표 주변을 서버가 계산해 준다. 그런데 사용자 좌표를 서버로 보내면
저장 여부와 무관하게 위치기반서비스사업자 신고 대상이 된다. `places` 에 좌표가 100% 있으니
**브라우저에서 직접 거리를 계산**하고 가까운 contentid 만 서버에 되묻는다. 위치가 단말을 안 떠난다.

**`searchKeyword2`** — `contentTypeId` 파라미터가 없어 타입 필터가 안 되고 쇼핑이 잔뜩 섞인다.
전국 목록이 이미 있으니 SQL 이 더 정확하고 빠르다.

---

## `places` — petTourSyncList2

| 컬럼 | 원본 필드 | 비고 |
|---|---|---|
| `contentid` | `contentid` | 모든 테이블의 연결 키 |
| `contenttypeid` | `contenttypeid` | 12 관광지 · 14 문화시설 · 15 행사 · 28 레포츠 · 32 숙박 · 38 쇼핑 · 39 음식점 |
| `cat` | (파생) | `contenttypeid` 를 한글 이름으로 |
| `title` `addr1` | 동일 | |
| `mapx` `mapy` | 동일 | mapx=경도, mapy=위도. **순서 주의** |
| `firstimage` | `firstimage` | 98% 채워짐 |
| `lcls_systm1/2/3` | 동일 | 분류체계 3단계 |
| `regn_cd` | `lDongRegnCd` | 법정동 시도 |
| `signgu_cd` | `lDongSignguCd` | 법정동 시군구 |
| `modifiedtime` | `modifiedtime` | 변경 감지에 쓸 수 있다 |
| `showflag` | `showflag` | 1=표출, 0=숨김(459건) |
| `raw` | 응답 전체 | |

**`areacode`·`sigungucode` 는 빈 문자열로 온다.** 법정동 코드(`lDong*`)를 써야 한다.

---

## `pet_rules` — detailPetTour2

원본 9필드를 그대로 두고, `parseRules` 가 뽑아낸 구조를 나란히 둔다.
**파싱 품질을 눈으로 대조하라고 이렇게 만들었다.**

### 원본 (전부 자연어)

| 컬럼 | 원본 필드 | 채움률 | 비고 |
|---|---|---:|---|
| `acmpy_type_cd` | `acmpyTypeCd` | 98% | `전구역 동반가능` / `일부구역 동반가능` 2종 |
| `acmpy_psbl_cpam` | `acmpyPsblCpam` | 87% | **148종의 자유 텍스트.** 판정의 핵심 |
| `acmpy_need_mtr` | `acmpyNeedMtr` | 84% | 쉼표로 구조화됨 |
| `etc_acmpy_info` | `etcAcmpyInfo` | — | 개행 없이 `- ` 로만 이어지기도 |
| `rela_*` 5개 | 동일 | 0~11% | 채움률이 낮아 판정에 안 쓴다 |

### 파싱 결과

| 컬럼 | 뜻 | 어디서 |
|---|---|---|
| `zone` | `all` / `partial` / `unknown` | `acmpyTypeCd` |
| `no_pets` | 전면 동반 불가 | `acmpyPsblCpam` |
| `service_dog_only` | 안내견·보조견만 | `acmpyPsblCpam` |
| `max_kg` | 무게 상한 | `acmpyPsblCpam` → 없으면 `etcAcmpyInfo` |
| `max_kg_inclusive` | `이하`면 true, `미만`이면 false | 〃 |
| `allowed_sizes` | 허용 크기 | `acmpyPsblCpam` |
| `exclude_dangerous` | 맹견 배제 | `acmpyPsblCpam` + `etcAcmpyInfo` |
| `needs` | 준비물 | `acmpyNeedMtr` (`기타`·`자유이용` 제외) |
| `notes` | 현장 규정 목록 | `etcAcmpyInfo` |
| `zone_hint` | 어디가 막혔는지 | `notes` 중 제한 문장 |
| `completeness` | A/B/C | 실질 정보가 있는 필드 수 |
| `attention` | **구조로 못 옮긴 조건** | 나이·체고·마리수·계절 등 |

`acmpy_psbl_cpam` 은 148종뿐이라 [`lib/cpamMap.ts`](../lib/cpamMap.ts) 에서 **한 줄씩 손으로 매핑**한다.
표에 없는 값만 정규식이 받는다.

---

## `place_details` — detail 4종 (장소당 4콜)

**타입마다 필드명이 다르다.** 그래서 여기서 통일한다.

| 컬럼 | 오퍼레이션 | 원본 필드 |
|---|---|---|
| `overview` | `detailCommon2` | `overview` — 사람이 쓴 소개글 (91~100%) |
| `homepage` | `detailCommon2` | `homepage` — `<a href>` 에서 URL 추출 (25~91%) |
| `usetime` | `detailIntro2` | 12 `usetime` · 32 `checkintime` · 39 `opentimefood` … |
| `restdate` | `detailIntro2` | 12 `restdate` · 39 `restdatefood` · 14 `restdateculture` … |
| `parking` | `detailIntro2` | 12 `parking` · 32 `parkinglodging` … |
| `tels` | `detailIntro2` | 12 `infocenter` · 32 `infocenterlodging` · **39 `infocenterfood`** |
| `extras` | `detailInfo2` | `infoname` + `infotext` — 입장료·화장실 … |
| `images` | `detailImage2` | `originimgurl` + `cpyrhtDivCd` |

**목록의 `tel` 은 항상 비어 있다.** 전화번호는 `detailIntro2` 에만 있고 타입마다 이름이 다르다.

**`cpyrhtDivCd`** — `Type1` 은 출처만 밝히면 되고, **`Type3` 은 변경 금지**(자르기·필터·글자 넣기 불가).

---

## `codes` — 코드표 4종

| `source` | 오퍼레이션 | depth | 예 |
|---|---|---|---|
| `ldong` | `ldongCode2` | 1 시도 · 2 시군구 | `11` 서울특별시 → `110` 종로구 |
| `lcls` | `lclsSystmCode2` | 1~3 | `NA` → `NA02` → `NA020900` |
| `area` | `areaCode2` ⚠️ | 1 | `1` 서울 — **구버전, 번호가 다름** |
| `category` | `categoryCode2` ⚠️ | 1 | `A01` 자연 — 구버전 |

**`ldong` 을 써야 한다.** 강원은 `42` 가 아니라 **`51`** 이고, 틀린 코드를 넣으면 오류 없이 0건이 나온다.

---

## `sync_runs` — 호출 이력

배치가 언제 어떤 오퍼레이션을 몇 콜 불렀는지 남긴다. 한도(개발계정 오퍼레이션당 일 1,000건)를
어디서 썼는지 추적하는 용도다.

```sql
select operation, sum(api_calls) calls, sum(rows) rows, max(finished_at) last
from sync_runs group by 1 order by 2 desc;
```
