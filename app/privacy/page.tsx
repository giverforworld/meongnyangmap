import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 · 멍냥맵',
  description: '멍냥맵이 어떤 정보를 어떻게 다루는지',
}

/**
 * 개인정보처리방침.
 *
 * 구글 OAuth 앱을 '프로덕션'으로 게시하려면 공개된 개인정보처리방침 URL 이 필요하다(콘솔 브랜딩).
 * 그 요건 때문에 만들었지만 내용은 코드가 실제로 하는 것만 적는다 — 없는 절차·없는 수집을 쓰지 않는다.
 * 수집 항목이 바뀌면 이 페이지도 같이 바꾼다: 로그인(lib/auth.ts), 프로필(lib/petsRemote.ts),
 * 글·리뷰·댓글·사진(app/api/*), 위치(app/page.tsx — 서버로 보내지 않음).
 */
const EFFECTIVE = '2026년 9월 17일'
const CONTACT = 'larry800000@gmail.com'

export default function Privacy() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="jua" style={{ margin: 0, fontSize: 26, color: '#2B2420' }}>개인정보처리방침</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', lineHeight: 1.6 }}>
            멍냥맵(meongnyangmap.vercel.app)이 어떤 정보를 어떤 목적으로 다루는지 적습니다. 시행일 {EFFECTIVE}.
          </p>
        </header>

        <Section title="1. 로그인 없이도 쓸 수 있어요">
          <p>
            멍냥맵의 모든 기능은 로그인 없이 쓸 수 있습니다. 로그인은 반려동물 프로필을 여러 기기에서 같이 쓰고,
            글·리뷰·댓글에 계정 이름을 붙이고 싶을 때만 선택합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 정보">
          <Table rows={[
            ['소셜 로그인 (카카오 · 구글)', '소셜 계정의 고유 식별자, 이름(닉네임), 프로필 사진 주소. 구글 로그인 시 구글이 전달하는 이메일은 인증 서비스에 계정 정보로 보관될 뿐 화면에 표시하거나 다른 용도로 쓰지 않습니다. 카카오 로그인은 이메일을 요청하지 않습니다.'],
            ['반려동물 프로필', '이름, 종(강아지/고양이), 몸무게, 아이콘, 챙길 수 있는 것(이동장·입마개), 맹견 여부. 로그인하지 않으면 사용 중인 브라우저에만 저장되고 서버로 보내지 않습니다. 로그인하면 계정에 저장됩니다.'],
            ['글 · 리뷰 · 댓글', '작성한 내용, 첨부한 사진, 연결한 장소. 로그인 상태로 쓰면 계정 이름·프로필 사진·반려동물 이름이 작성자 표시로 함께 저장됩니다. 로그인하지 않고 쓰면 직접 적은 닉네임과 삭제용 비밀번호(해시로만 저장)가 저장됩니다.'],
            ['사진', '업로드 전에 브라우저에서 크기를 줄이고 촬영 정보(EXIF: 위치·기기 등)를 제거한 뒤 올립니다. 올린 사진은 누구나 볼 수 있는 공개 저장소에 놓입니다.'],
            ['내 위치', "'내 주변 탐색'은 브라우저 안에서만 거리를 계산합니다. 좌표를 서버로 보내거나 저장하지 않습니다."],
            ['접속 기록', '사진 업로드 남용을 막기 위해 요청 IP 를 서버 메모리에서 짧게(10분) 세고 버립니다. 호스팅 서비스(Vercel)가 남기는 표준 접속 로그가 있습니다.'],
          ]} />
        </Section>

        <Section title="3. 쓰는 목적">
          <ul>
            <li>등록한 반려동물 기준으로 장소의 동반 가능 여부를 판정해 보여주기</li>
            <li>로그인한 계정에 프로필을 저장해 다른 기기에서도 같은 판정을 받기</li>
            <li>글·리뷰·댓글의 작성자 표시와 본인 삭제</li>
            <li>서비스 남용(무분별한 업로드) 방지</li>
          </ul>
        </Section>

        <Section title="4. 보관과 삭제">
          <ul>
            <li>글·리뷰·댓글은 작성자가 직접 삭제할 수 있습니다(로그인 글은 본인 계정, 비로그인 글은 비밀번호).</li>
            <li>반려동물 프로필은 등록 화면에서 언제든 수정·삭제할 수 있고, 로그아웃하면 그 기기에서 지워집니다.</li>
            <li>계정 자체와 계정에 남은 정보의 삭제는 아래 연락처로 요청하시면 확인 후 지웁니다.</li>
            <li>브라우저에 저장된 정보(로그인 세션, 비로그인 프로필)는 브라우저 저장소를 지우면 사라집니다.</li>
          </ul>
        </Section>

        <Section title="5. 맡기는 곳 (처리 위탁)">
          <Table rows={[
            ['Supabase', '로그인(인증), 데이터베이스, 사진 저장소'],
            ['Vercel', '웹 서비스 호스팅'],
            ['카카오 · 구글', '소셜 로그인. 각 사의 동의 화면에서 허용한 정보만 받습니다'],
            ['카카오맵', '지도 표시. 지도 타일을 받는 과정에서 브라우저가 카카오에 접속합니다'],
            ['한국관광공사', '장소 정보(반려동물 동반여행 API). 개인정보를 보내지 않습니다'],
          ]} />
        </Section>

        <Section title="6. 쿠키와 브라우저 저장소">
          <p>
            광고·추적용 쿠키는 쓰지 않습니다. 로그인 세션과 비로그인 반려동물 프로필을 브라우저 저장소(localStorage)에 둡니다.
          </p>
        </Section>

        <Section title="7. 문의">
          <p>
            개인정보에 관한 문의·삭제 요청: <a href={`mailto:${CONTACT}`} style={{ color: '#E85D3D' }}>{CONTACT}</a>
          </p>
          <p style={{ color: '#A08872' }}>
            이 방침이 바뀌면 이 페이지에 시행일과 함께 갱신합니다. 멍냥맵은 2026 관광데이터 활용 공모전 출품작이며, 장소 정보의 출처: ⓒ한국관광공사
          </p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: '#5C5347', lineHeight: 1.7 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#2B2420' }}>{title}</h2>
      <div className="privacy-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, auto) 1fr', columnGap: 14, rowGap: 10, alignItems: 'baseline' }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <span style={{ color: '#A08872', fontWeight: 700, wordBreak: 'keep-all' }}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}
