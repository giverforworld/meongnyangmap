import Link from 'next/link'

/**
 * 페스티벌 — 아직 데이터가 없다.
 *
 * 관광공사 API 의 행사/공연/축제(contentTypeId 15)는 반려동물 동반여행 서비스에
 * 전국 0건이다. 팝업은 공공데이터 자체가 없다. 빈 껍데기를 두는 대신
 * 무엇이 없고 어디서 채울 것인지를 그대로 적는다.
 */
export default function Festival() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="jua" style={{ margin: 0, fontSize: 26, color: '#2B2420' }}>
            반려동물 페스티벌
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', lineHeight: 1.6 }}>
            축제·팝업·원데이 클래스처럼 <b style={{ color: '#2B2420' }}>기간이 정해진 이벤트</b>를 모읍니다.
            지금은 채우는 중이에요.
          </p>
        </header>

        <section style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#2B2420' }}>왜 아직 비어 있나요</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 9, fontSize: 13, alignItems: 'baseline' }}>
            <span style={{ color: '#A08872', whiteSpace: 'nowrap' }}>축제·행사</span>
            <span style={{ color: '#5C5347' }}>
              한국관광공사 반려동물 동반여행 API 에 <b>전국 0건</b>입니다. 타입 코드(15)는 있는데 등록된 데이터가 없어요.
            </span>
            <span style={{ color: '#A08872', whiteSpace: 'nowrap' }}>팝업</span>
            <span style={{ color: '#5C5347' }}>공공데이터에 아예 없습니다. 직접 모아야 하는 영역이에요.</span>
          </div>
        </section>

        <section style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#2B2420' }}>어떻게 채울 건가요</h2>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#5C5347', lineHeight: 1.6 }}>
            <li>일반 관광 API 의 축제 정보를 가져와, <b>반려동물 동반 가능 여부를 직접 조사해 얹습니다.</b> 그 조합은 지금 어디에도 없는 데이터예요.</li>
            <li>팝업·원데이 클래스는 공식 채널에서 모으고, <b>출처 링크와 확인한 날짜를 함께</b> 답니다.</li>
            <li>확인되지 않은 정보는 올리지 않습니다. 헛걸음을 막으려고 만든 서비스인데 우리가 헛걸음을 만들 수는 없으니까요.</li>
          </ol>
        </section>

        <p style={{ margin: 0, fontSize: 13, color: '#8A7A65', lineHeight: 1.6 }}>
          그동안은{' '}
          <Link href="/hotplace" style={{ color: '#E85D3D', fontWeight: 700 }}>핫플레이스</Link>
          에서 상시 운영하는 곳을 둘러보세요. 규정이 확실한 곳만 골라 뒀어요.
        </p>
      </div>
    </div>
  )
}
