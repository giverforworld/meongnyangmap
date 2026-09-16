'use client'

import { useEffect, useState } from 'react'
import type { Pet } from '@/lib/types'
import { AVATARS, avatarBg, sizeLabelOf, type PetInput } from '@/lib/pets'
import type { Species } from '@/lib/types'
import PetFace from './PetFace'
import { sizeOf } from '@/lib/petTour'
import type { Session } from '@supabase/supabase-js'
import { authReady } from '@/lib/supabaseBrowser'
import { GOOGLE_LOGIN_READY, GOOGLE_PENDING } from '@/lib/authProviders'

/**
 * 프로필 칩과 등록 화면.
 *
 * 지도와 핫플레이스가 같은 것을 쓴다 — 한쪽에서 등록한 아이가 다른 쪽에서 안 보이면
 * "우리 아이 기준"이라는 말이 무너진다.
 *
 * 크기와 맹견 여부는 묻지 않고 무게·견종에서 계산한다. "우리 애가 중형견인가?"는
 * 사람마다 답이 갈리는 질문이고, 틀리면 판정이 통째로 어긋난다.
 */


const field: React.CSSProperties = {
  font: 'inherit',
  fontSize: 14.5,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1.5px solid #EAE3D6',
  background: '#FFFFFF',
  color: '#2B2420',
  outline: 'none',
  width: '100%',
}

interface Props {
  /** 등록 전이면 null */
  pet: Pet | null
  pets: Pet[]
  list: PetInput[]
  activeKey: string | null
  onSelect: (key: string) => void
  onAdd: (input: Omit<PetInput, 'key'>) => void
  onUpdate: (key: string, input: Omit<PetInput, 'key'>) => void
  onRemove: (key: string) => void
  /** 좁은 화면의 상단 메뉴에 들어갈 때는 한 줄로 */
  compact?: boolean
  /** 로그인 — 선택이다. 없어도 브라우저 저장으로 전부 된다 */
  session?: Session | null
  syncing?: boolean
  onSignIn?: (provider: 'kakao' | 'google') => void
  onSignOut?: () => void
}

export default function PetSwitch({
  pet, pets, list, activeKey,
  onSelect, onAdd, onUpdate, onRemove, compact = false,
  session = null, syncing = false, onSignIn, onSignOut,
}: Props) {
  const [open, setOpen] = useState(false)
  /** 편집 중인 아이의 key. 'new' 면 새로 등록 */
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <>
      <button
        className="hov-accent"
        onClick={() => setOpen(true)}
        title={pet ? '눌러서 아이를 바꾸거나 프로필 수정' : '프로필을 등록하면 등록한 아이 기준으로 동반 가능 여부를 알려드려요'}
        style={{
          display: 'flex', alignItems: 'center', gap: compact ? 6 : 11, flex: 'none',
          fontFamily: 'inherit', fontSize: compact ? 13 : 16, cursor: 'pointer', borderRadius: 99,
          // 등록 전에는 이 서비스의 첫 단계라 주황으로 꽉 채운다. 등록 뒤에는 연하게 물러난다
          ...(pet
            ? { background: '#FFF4EF', border: '1.5px solid #F3C9BB', color: '#2B2420', padding: compact ? '3px 11px 3px 3px' : '6px 20px 6px 7px', minWidth: compact ? undefined : 150 }
            : { background: '#E85D3D', border: '1.5px solid #E85D3D', color: '#FFFFFF', padding: compact ? '3px 11px 3px 3px' : '6px 20px 6px 7px', boxShadow: '0 4px 14px rgba(232,93,61,.32)' }),
        }}
      >
        {!pet ? (
          // 등록 전 — 아직 누구 기준으로도 거르지 않는다. 칩은 등록을 권하는 자리다
          <>
            <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: compact ? 28 : 40, height: compact ? 28 : 40, background: '#FFFFFF', borderRadius: '50%', flex: 'none' }}>
              <PetFace emoji="🐶" size={compact ? 24 : 34} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 700 }}>프로필 등록</span>
              {!compact && (
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.88)', marginTop: 2 }}>
                  등록한 아이 기준으로 동반 가능 여부 필터링
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <Avatar pet={pet} size={compact ? 28 : 40} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 700 }}>{pet.name}</span>
              {!compact && (
                <span style={{ fontSize: 12.5, color: '#A08872', marginTop: 2 }}>
                  {pet.kg}kg · {pet.sizeLabel} ▾
                </span>
              )}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          onClick={() => { setOpen(false); setEditing(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(43,36,32,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="반려동물 프로필"
            style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 48px rgba(43,36,32,.24)' }}
          >
            <header style={{ flex: 'none', padding: '18px 20px 12px', borderBottom: '1px solid #F1EBE0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span className="jua" style={{ fontSize: 20 }}>
                {editing ? (editing === 'new' ? '반려 동물 등록' : '프로필 수정') : pets.length ? '누구랑 갈까요?' : '반려 동물 등록'}
              </span>
              <button
                onClick={() => (editing && pets.length ? setEditing(null) : (setEditing(null), setOpen(false)))}
                aria-label={editing && pets.length ? '뒤로' : '닫기'}
                style={{ border: 'none', background: 'none', fontSize: 15, color: '#A08872', cursor: 'pointer', padding: 4 }}
              >
                {editing && pets.length ? '← 뒤로' : '✕'}
              </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
              {editing || pets.length === 0 ? (
                <>
                  {/* 등록된 아이가 없으면 목록을 건너뛰고 바로 폼이다 — 빈 목록을 보여줄 이유가 없다 */}
                  <PetForm
                    initial={editing && editing !== 'new' ? list.find((p) => p.key === editing) ?? null : null}
                    canCancel={pets.length > 0}
                    onCancel={() => setEditing(null)}
                    onSave={(input) => {
                      if (!editing || editing === 'new') onAdd(input)
                      else onUpdate(editing, input)
                      setEditing(null)
                      setOpen(false)
                    }}
                  />
                  {/* 처음 온 사람에게도 로그인 길을 연다 — 다른 기기에서 등록해 둔 아이를 불러오는 경우 */}
                  {pets.length === 0 && (
                    <AccountBlock
                      session={session}
                      syncing={syncing}
                      onSignIn={onSignIn}
                      onSignOut={onSignOut}
                      hasOwnPets={false}
                    />
                  )}
                </>
              ) : (
                <>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pets.map((p) => {
                      const on = p.key === activeKey
                      return (
                        <div
                          key={p.key}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF6F2' : '#FFFFFF', borderRadius: 14, padding: '10px 12px' }}
                        >
                          <button
                            onClick={() => { onSelect(p.key); setOpen(false) }}
                            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                          >
                            <Avatar pet={p} size={38} />
                            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: '#2B2420' }}>{p.name}</span>
                              <span style={{ fontSize: 12.5, color: '#A08872', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.kg}kg · {p.sizeLabel}
                                {p.isDangerous && <b style={{ color: '#C0392B' }}> · 맹견</b>}
                              </span>
                            </span>
                          </button>

                          <button
                            onClick={() => setEditing(p.key)}
                            style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, color: '#6E5F4D', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => onRemove(p.key)}
                            aria-label={`${p.name} 지우기`}
                            style={{ flex: 'none', fontFamily: 'inherit', fontSize: 13, color: '#C4B8A4', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    className="btn-primary"
                    onClick={() => setEditing('new')}
                    style={{ width: '100%', marginTop: 12, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, padding: '12px 0', borderRadius: 14, border: 'none', background: '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    + 우리 아이 추가 등록
                  </button>

                  {/* 계정 — 로그인은 선택이다. 여기 오는 사람 대부분은 안 하고도 다 쓴다 */}
                  <AccountBlock
                    session={session}
                    syncing={syncing}
                    onSignIn={onSignIn}
                    onSignOut={onSignOut}
                    hasOwnPets={pets.length > 0}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * 계정 블록. 세 상태다 —
 *   로그인 기능 없음(환경변수 미설정) → 기기 저장 안내만
 *   비로그인 → "다른 기기에서도 보려면" + 카카오·구글 버튼
 *   로그인 → 누구로 들어왔는지 + 로그아웃
 */
function AccountBlock({
  session, syncing, onSignIn, onSignOut, hasOwnPets,
}: {
  session: Session | null
  syncing: boolean
  onSignIn?: (p: 'kakao' | 'google') => void
  onSignOut?: () => void
  hasOwnPets: boolean
}) {
  /** 준비 안 된 provider 를 눌렀을 때 보여줄 한 줄 */
  const [notice, setNotice] = useState<string | null>(null)
  if (!authReady || !onSignIn) {
    return (
      <p style={{ margin: '12px 2px 0', fontSize: 11.5, lineHeight: 1.6, color: '#B3A78F' }}>
        프로필은 이 기기에만 저장돼요. 서버로 보내지 않아요.
      </p>
    )
  }

  if (session) {
    const u = session.user
    // 카카오(custom:kakao)는 이메일 없이 들어온다 — 닉네임이 전부다
    const m = u.user_metadata ?? {}
    const who = (m.nickname as string) || (m.name as string) || (m.full_name as string) || (m.preferred_username as string) || u.email || '로그인됨'
    const p = u.app_metadata?.provider as string | undefined
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1EBE0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#6E5F4D', lineHeight: 1.5 }}>
          <b style={{ color: '#2B2420' }}>{who}</b> <ProviderMark provider={p} />
          <br />
          <span style={{ color: '#B3A78F' }}>
            {syncing ? '계정과 맞추는 중…' : '우리 아이 정보는 로그인 계정에 저장됩니다.'}
          </span>
        </span>
        <button onClick={onSignOut}
          style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, color: '#8A7A65', background: 'none', border: '1.5px solid #E3DCCE', borderRadius: 99, padding: '5px 12px', cursor: 'pointer' }}>
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1EBE0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: '#6E5F4D', lineHeight: 1.5 }}>
        {hasOwnPets
          ? '로그인을 하면 우리 아이 정보가 저장돼요.'
          : '이미 등록한 적 있어요? 로그인하면 계정에 저장된 아이를 불러와요'}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 카카오 — 노랑 바탕에 검정 말풍선, 구글 — 흰 바탕에 G. 각 사의 로그인 버튼 규격을 따른다 */}
        <button onClick={() => onSignIn('kakao')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '10px 0', borderRadius: 12, border: 'none', background: '#FEE500', color: '#191919', cursor: 'pointer' }}>
          <KakaoIcon /> 카카오 로그인
        </button>
        <button onClick={() => (GOOGLE_LOGIN_READY ? onSignIn('google') : setNotice(GOOGLE_PENDING))}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '10px 0', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>
          <GoogleIcon /> 구글 로그인
        </button>
      </div>
      {notice && (
        <span role="status" style={{ fontSize: 12, fontWeight: 700, color: '#E85D3D', lineHeight: 1.5, wordBreak: 'keep-all' }}>{notice}</span>
      )}
      <span style={{ fontSize: 11, color: '#B3A78F', lineHeight: 1.5 }}>
        로그인을 하지 않아도 서비스 이용이 가능합니다.
      </span>
    </div>
  )
}

/**
 * 어느 계정으로 들어왔는지 — '카카오'라고 쓰지 않고 그 회사 마크를 단다.
 * 이름 옆에 붙는 자리라 작고(16px), 카카오는 노랑 원 안에 말풍선으로 그려야 알아본다.
 */
export function ProviderMark({ provider }: { provider?: string }) {
  if (provider === 'kakao' || provider === 'custom:kakao') {
    return (
      <span title="카카오 계정" aria-label="카카오 계정" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#FEE500', verticalAlign: '-3px' }}>
        <KakaoIcon size={11} />
      </span>
    )
  }
  if (provider === 'google') {
    return (
      <span title="구글 계정" aria-label="구글 계정" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px #E3DCCE', verticalAlign: '-3px' }}>
        <GoogleIcon size={10} />
      </span>
    )
  }
  return null
}

/** 카카오 심볼 — 말풍선. 노랑(#FEE500) 위에 검정 */
export function KakaoIcon({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.32 4.66 6.74l-.95 3.53c-.08.3.26.55.52.38l4.2-2.78c.51.06 1.03.1 1.57.1 5.52 0 10-3.58 10-8S17.52 3 12 3Z" />
    </svg>
  )
}

/** 구글 G — 4색 그대로. 흰 바탕에서만 쓴다 */
export function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function Avatar({ pet, size }: { pet: Pet; size: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, background: avatarBg(pet.emoji), borderRadius: '50%', fontSize: size * 0.52, overflow: 'hidden', flex: 'none' }}>
      {pet.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pet.photo} alt="" width={size} height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          // 사진이 없거나 깨졌으면 이모지로 되돌린다
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = pet.emoji }}
        />
      ) : <PetFace emoji={pet.emoji} size={size * 0.86} />}
    </span>
  )
}

/** 등록·수정 폼. 크기는 입력받지 않고 무게에서 계산해 보여주기만 한다 */
function PetForm({
  initial, onSave, onCancel, canCancel = true,
}: {
  initial: PetInput | null
  onSave: (input: Omit<PetInput, 'key'>) => void
  onCancel: () => void
  /** 등록된 아이가 하나도 없을 때는 돌아갈 목록이 없다 */
  canCancel?: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'dog')
  const [kg, setKg] = useState(initial ? String(initial.kg) : '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🐶')
  const [hasCage, setHasCage] = useState(initial?.hasCage ?? false)
  const [hasMuzzle, setHasMuzzle] = useState(initial?.hasMuzzle ?? false)
  const [dangerous, setDangerous] = useState(initial?.dangerous ?? false)
  const [error, setError] = useState('')

  // 무게를 고치면 크기가 바로 따라 움직이는 것을 보여준다
  const weight = Number(kg)
  const valid = name.trim().length > 0 && Number.isFinite(weight) && weight > 0 && weight <= 120
  const size = valid ? sizeOf(weight) : null

  useEffect(() => setError(''), [name, kg])

  function pickSpecies(next: Species) {
    setSpecies(next)
    if (next === 'cat' && emoji === '🐶') setEmoji('🐱')
    if (next === 'dog' && emoji === '🐱') setEmoji('🐶')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return setError('이름을 적어주세요')
        if (!Number.isFinite(weight) || weight <= 0) return setError('몸무게를 숫자로 적어주세요')
        if (weight > 120) return setError('몸무게를 다시 확인해주세요')
        onSave({ name, species, kg: weight, emoji, hasCage, hasMuzzle, dangerous: species === 'dog' && dangerous })
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>이름</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus
          placeholder="우리 아이 이름" style={field} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>몸무게</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input value={kg} onChange={(e) => setKg(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal" placeholder="4" style={{ ...field, width: 92 }} />
          <span style={{ fontSize: 14.5, color: '#6E5F4D' }}>kg</span>
          {/* 강아지 / 고양이 — 크기 이름표(소형견·소형묘)와 맹견 항목이 이걸 따른다 */}
          <div role="radiogroup" aria-label="종류" style={{ display: 'flex', marginLeft: 8, border: '1.5px solid #EAE3D6', borderRadius: 99, padding: 2, background: '#FFFFFF' }}>
            {([['dog', '강아지', '🐶'], ['cat', '고양이', '🐱']] as const).map(([k, label, face]) => {
              const on = species === k
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => pickSpecies(k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, padding: '5px 11px 5px 6px', borderRadius: 99, border: 'none', background: on ? '#E85D3D' : 'transparent', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer', transition: 'background .12s' }}>
                  <PetFace emoji={face} size={20} />{label}
                </button>
              )
            })}
          </div>
          {size && (
            <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#E85D3D', background: '#FFF4EF', border: '1.5px solid #F3C9BB', borderRadius: 99, padding: '4px 12px' }}>
              {sizeLabelOf(species, size)}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: '#B3A78F', lineHeight: 1.6 }}>
          몸무게로 크기를 정해요
          <br />
          {species === 'dog'
            ? '10kg 미만 소형견 · 10~25kg 중형견 · 25kg 이상 대형견'
            : '10kg 미만 소형묘 · 10~25kg 중형묘 · 25kg 이상 대형묘 (대부분 소형묘예요)'}
        </span>
      </label>

      <fieldset style={{ border: '1.5px solid #EFE8DA', borderRadius: 12, padding: '10px 13px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>챙길 수 있는 것</legend>
        {([
          ['이동장(켄넬)', hasCage, setHasCage, '이동장이 있어야 들어갈 수 있는 곳이 있어요'],
          ['입마개', hasMuzzle, setHasMuzzle, '대형견·맹견에게 요구하는 곳이 있어요'],
        ] as const).map(([label, on, set, hint]) => (
          <label key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
            <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)}
              style={{ marginTop: 3, width: 17, height: 17, accentColor: '#E85D3D', flex: 'none' }} />
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14 }}>{label}</span>
              <span style={{ fontSize: 11.5, color: '#B3A78F' }}>{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* 견종을 묻지 않으니 맹견 여부만 직접 받는다. 고양이면 아예 묻지 않는다 */}
      {species === 'dog' && (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', border: `1.5px solid ${dangerous ? '#E0A9A0' : '#EFE8DA'}`, background: dangerous ? '#FBEDEA' : '#FFFFFF', borderRadius: 12, padding: '10px 13px' }}>
        <input type="checkbox" checked={dangerous} onChange={(e) => setDangerous(e.target.checked)}
          style={{ marginTop: 3, width: 17, height: 17, accentColor: '#C0392B', flex: 'none' }} />
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14 }}>법정 맹견이에요</span>
          <span style={{ fontSize: 11.5, color: dangerous ? '#C0392B' : '#B3A78F', lineHeight: 1.5 }}>
            {dangerous
              ? '맹견 동반을 막는 곳은 불가로 판정하고, 입마개가 필요한 곳은 그렇게 알려드려요'
              : '도사견 · 핏불테리어 · 스태퍼드셔 테리어 · 로트와일러와 그 잡종'}
          </span>
        </span>
      </label>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>아이콘</span>
        {/* 칩에 뜰 모양 그대로 고른다 — 동그란 파스텔 배경에 이모지. 고른 것만 테두리 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {AVATARS.map((a) => {
            const on = emoji === a.emoji
            return (
              <button key={a.emoji} type="button" onClick={() => setEmoji(a.emoji)}
                aria-label={a.label} aria-pressed={on}
                style={{ width: 50, height: 50, padding: 3, borderRadius: '50%', cursor: 'pointer', background: '#FFFFFF', border: `2px solid ${on ? '#E85D3D' : 'transparent'}`, transition: 'border-color .12s' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '50%', background: a.bg, boxShadow: on ? 'none' : 'inset 0 0 0 1px #EFE8DA' }}>
                  <PetFace emoji={a.emoji} size={36} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: 13, color: '#C0392B' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
        {canCancel && (
          <button type="button" onClick={onCancel}
            style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14, padding: '12px 18px', borderRadius: 14, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
            취소
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={!valid}
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, padding: '12px 0', borderRadius: 14, border: 'none', background: valid ? '#E85D3D' : '#E3DCCE', color: '#FFFFFF', cursor: valid ? 'pointer' : 'default' }}>
          {initial ? '저장' : '등록하고 이 아이 기준으로 보기'}
        </button>
      </div>
    </form>
  )
}
