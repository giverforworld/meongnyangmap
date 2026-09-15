/**
 * 우리 아이 얼굴 — 강아지 · 고양이 · 토끼 · 햄스터 · 판다.
 *
 * 이모지는 기기마다 생김새가 달라 애플·삼성·윈도우에서 다른 얼굴이 뜬다.
 * 직접 그린 SVG 라 어디서나 같고, 동그란 얼굴·큰 눈·볼 터치로 통일된 인상을 준다.
 *
 * 저장은 여전히 이모지 한 글자(🐶 🐱 🐰 🐹 🐼)로 한다 — pets 표의 emoji 컬럼(4자)을
 * 그대로 쓰고, 그리기만 여기서 바꿔 끼운다. 모르는 값은 이모지 글자로 되돌아간다.
 */
export type FaceKind = 'dog' | 'cat' | 'rabbit' | 'hamster' | 'panda'

const KIND: Record<string, FaceKind> = {
  '🐶': 'dog', '🐕': 'dog', '🐩': 'dog', '🦮': 'dog',
  '🐱': 'cat', '🐈': 'cat',
  '🐰': 'rabbit',
  '🐹': 'hamster',
  '🐼': 'panda', '🐻': 'panda',
}

export const faceKind = (emoji: string): FaceKind | null => KIND[emoji] ?? null

/** 눈 — 검정 동그라미에 흰 하이라이트 둘. 다섯 얼굴이 같은 눈을 쓴다 */
function Eyes({ y, dx = 8, r = 3.1, color = '#2B2420' }: { y: number; dx?: number; r?: number; color?: string }) {
  return (
    <>
      {[32 - dx, 32 + dx].map((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill={color} />
          <circle cx={x + r * 0.32} cy={y - r * 0.38} r={r * 0.38} fill="#FFFFFF" />
          <circle cx={x - r * 0.36} cy={y + r * 0.3} r={r * 0.18} fill="#FFFFFF" opacity=".85" />
        </g>
      ))}
    </>
  )
}

/** 볼 터치 */
function Blush({ y, dx = 14, color = '#F7A8A6' }: { y: number; dx?: number; color?: string }) {
  return (
    <>
      <ellipse cx={32 - dx} cy={y} rx="4.2" ry="2.5" fill={color} opacity=".75" />
      <ellipse cx={32 + dx} cy={y} rx="4.2" ry="2.5" fill={color} opacity=".75" />
    </>
  )
}

/** ω 입 — 코 아래에서 양쪽으로 살짝 */
function Mouth({ y, color = '#4A3A32', w = 1.5, spread = 4.5 }: { y: number; color?: string; w?: number; spread?: number }) {
  return (
    <path d={`M32 ${y} q-${spread * 0.55} ${spread * 0.9} -${spread} ${spread * 0.35} M32 ${y} q${spread * 0.55} ${spread * 0.9} ${spread} ${spread * 0.35}`}
      fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
  )
}

function Dog() {
  // 요크셔테리어 아기 — 빵실한 검은 털뭉치에 황금빛 주둥이·눈썹, 쫑긋한 귀
  const FUR = '#3D3841'
  // 둘레를 살짝 울퉁불퉁하게 — 14개를 반지름 21.3 원 위에 고르게. 크면 갈기처럼 보인다
  const fluff = Array.from({ length: 14 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 14 - Math.PI / 2
    return [32 + Math.cos(a) * 21.3, 37 + Math.sin(a) * 21.3] as const
  })
  return (
    <>
      {fluff.map(([x, y]) => <circle key={`${x.toFixed(1)}-${y.toFixed(1)}`} cx={x} cy={y} r="4.6" fill={FUR} />)}
      <circle cx="32" cy="37" r="22" fill={FUR} />
      {/* 쫑긋한 귀 — 머리 위에 얹고, 안쪽은 황금빛 */}
      <path d="M13 26 L17.5 10 L28.5 20 Z" fill={FUR} stroke={FUR} strokeWidth="3" strokeLinejoin="round" />
      <path d="M51 26 L46.5 10 L35.5 20 Z" fill={FUR} stroke={FUR} strokeWidth="3" strokeLinejoin="round" />
      <path d="M17 23 L19.2 14.5 L25.8 20.5 Z" fill="#D99B5A" />
      <path d="M47 23 L44.8 14.5 L38.2 20.5 Z" fill="#D99B5A" />
      {/* 정수리 잔털 */}
      <path d="M27 16 q2 -4.5 4.5 -1.5 M32.5 14 q2.5 -3.5 4.5 -.5" fill="none" stroke="#5A5462" strokeWidth="1.6" strokeLinecap="round" />
      {/* 황금빛 얼굴 — 주둥이와 볼 */}
      <ellipse cx="32" cy="43.5" rx="16" ry="13" fill="#D99B5A" />
      {/* 눈썹 점 */}
      <ellipse cx="23.5" cy="29" rx="3.2" ry="2" fill="#D99B5A" />
      <ellipse cx="40.5" cy="29" rx="3.2" ry="2" fill="#D99B5A" />
      {/* 주둥이 — 더 밝게 */}
      <ellipse cx="32" cy="47.5" rx="9" ry="6" fill="#EBB777" />
      <Eyes y={37.8} dx={8} r={3.6} />
      <ellipse cx="32" cy="44.3" rx="3.4" ry="2.6" fill="#2B2420" />
      <circle cx="30.9" cy="43.6" r=".8" fill="#FFFFFF" opacity=".8" />
      <Mouth y={46.4} spread={4.2} />
      <Blush y={47} dx={14.5} color="#F2A29B" />
    </>
  )
}

function Cat() {
  return (
    <>
      {/* 뾰족 귀 */}
      <path d="M11 30 L14.5 9.5 L28 20.5 Z" fill="#EFE7E0" />
      <path d="M53 30 L49.5 9.5 L36 20.5 Z" fill="#EFE7E0" />
      <path d="M15 26.5 L16.8 14.5 L25.5 21.5 Z" fill="#F8BFC6" />
      <path d="M49 26.5 L47.2 14.5 L38.5 21.5 Z" fill="#F8BFC6" />
      <circle cx="32" cy="36" r="21.5" fill="#EFE7E0" />
      {/* 이마 줄무늬 */}
      <path d="M28 17.5 v6 M32 16.5 v7 M36 17.5 v6" stroke="#D9CBBE" strokeWidth="1.8" strokeLinecap="round" />
      <Eyes y={34.5} dx={8.5} />
      <path d="M30.2 39.4 L33.8 39.4 L32 41.8 Z" fill="#F08A9B" />
      <Mouth y={41.8} spread={4.4} />
      {/* 수염 */}
      <path d="M8 37.5 L19 39 M8 42.5 L19 41.5 M56 37.5 L45 39 M56 42.5 L45 41.5" stroke="#C9BDB2" strokeWidth="1.3" strokeLinecap="round" />
      <Blush y={42.5} dx={14.5} />
    </>
  )
}

function Rabbit() {
  return (
    <>
      {/* 긴 귀 */}
      <ellipse cx="22.5" cy="15" rx="6.5" ry="14.5" fill="#FFF7F8" stroke="#EFD9DC" strokeWidth="1" transform="rotate(-9 22.5 15)" />
      <ellipse cx="41.5" cy="15" rx="6.5" ry="14.5" fill="#FFF7F8" stroke="#EFD9DC" strokeWidth="1" transform="rotate(9 41.5 15)" />
      <ellipse cx="22.5" cy="16" rx="3.2" ry="10.5" fill="#F9BFC9" transform="rotate(-9 22.5 16)" />
      <ellipse cx="41.5" cy="16" rx="3.2" ry="10.5" fill="#F9BFC9" transform="rotate(9 41.5 16)" />
      <circle cx="32" cy="39" r="20" fill="#FFF7F8" stroke="#EFD9DC" strokeWidth="1" />
      <Eyes y={37} dx={7.5} r={3} />
      <ellipse cx="32" cy="42" rx="2.5" ry="1.8" fill="#F08A9B" />
      <Mouth y={43.6} spread={4} />
      {/* 앞니 */}
      <rect x="29.7" y="44.4" width="2.2" height="3.2" rx=".6" fill="#FFFFFF" stroke="#E6D3D6" strokeWidth=".7" />
      <rect x="32.1" y="44.4" width="2.2" height="3.2" rx=".6" fill="#FFFFFF" stroke="#E6D3D6" strokeWidth=".7" />
      <Blush y={44} dx={13.5} color="#F9B4C0" />
    </>
  )
}

function Hamster() {
  return (
    <>
      <circle cx="15.5" cy="22" r="6.5" fill="#E8AA5F" />
      <circle cx="48.5" cy="22" r="6.5" fill="#E8AA5F" />
      <circle cx="15.5" cy="22" r="3.4" fill="#F8C9C6" />
      <circle cx="48.5" cy="22" r="3.4" fill="#F8C9C6" />
      <ellipse cx="32" cy="37" rx="23" ry="20" fill="#F5C77F" />
      {/* 볼주머니 */}
      <ellipse cx="19.5" cy="42.5" rx="8.5" ry="6.5" fill="#FCE6BD" />
      <ellipse cx="44.5" cy="42.5" rx="8.5" ry="6.5" fill="#FCE6BD" />
      <ellipse cx="32" cy="44" rx="7" ry="5" fill="#FCE6BD" />
      <Eyes y={34.5} dx={8.5} r={3} />
      <ellipse cx="32" cy="39.8" rx="2.4" ry="1.8" fill="#DE7B8E" />
      <Mouth y={41.3} spread={3.8} />
      <Blush y={44.5} dx={15} />
    </>
  )
}

function Panda() {
  // 통통한 판다 — 넓은 얼굴, 큰 귀, 동그란 눈 얼룩, 큰 볼 터치
  return (
    <>
      <circle cx="13.5" cy="21" r="9" fill="#2B2420" />
      <circle cx="50.5" cy="21" r="9" fill="#2B2420" />
      <circle cx="13.5" cy="21" r="4.2" fill="#4A403B" />
      <circle cx="50.5" cy="21" r="4.2" fill="#4A403B" />
      {/* 옆으로 퍼진 통통한 얼굴 */}
      <ellipse cx="32" cy="37" rx="25" ry="22" fill="#FFFFFF" stroke="#E9E4DF" strokeWidth="1" />
      {/* 볼살 */}
      <ellipse cx="16" cy="45" rx="7" ry="5" fill="#FFF7F7" />
      <ellipse cx="48" cy="45" rx="7" ry="5" fill="#FFF7F7" />
      {/* 동그란 눈 얼룩 */}
      <ellipse cx="23" cy="35" rx="7.6" ry="8" fill="#2B2420" transform="rotate(-8 23 35)" />
      <ellipse cx="41" cy="35" rx="7.6" ry="8" fill="#2B2420" transform="rotate(8 41 35)" />
      {/* 큰 눈 */}
      <circle cx="24" cy="36.5" r="3.8" fill="#FFFFFF" />
      <circle cx="40" cy="36.5" r="3.8" fill="#FFFFFF" />
      <circle cx="24.4" cy="37" r="2.4" fill="#2B2420" />
      <circle cx="40.4" cy="37" r="2.4" fill="#2B2420" />
      <circle cx="25.3" cy="36" r=".95" fill="#FFFFFF" />
      <circle cx="41.3" cy="36" r=".95" fill="#FFFFFF" />
      <ellipse cx="32" cy="44" rx="3" ry="2.2" fill="#2B2420" />
      <Mouth y={45.9} color="#2B2420" spread={3.8} w={1.4} />
      <ellipse cx="15.5" cy="43.5" rx="5" ry="3" fill="#F9A8B0" opacity=".8" />
      <ellipse cx="48.5" cy="43.5" rx="5" ry="3" fill="#F9A8B0" opacity=".8" />
      {/* 정수리 털 한 가닥 */}
      <path d="M32 15 q2 -4 5 -3" fill="none" stroke="#2B2420" strokeWidth="1.8" strokeLinecap="round" />
    </>
  )
}

const FACE: Record<FaceKind, () => JSX.Element> = { dog: Dog, cat: Cat, rabbit: Rabbit, hamster: Hamster, panda: Panda }

/** 얼굴 하나. 모르는 이모지면 그 글자를 그대로 */
export default function PetFace({ emoji, size }: { emoji: string; size: number }) {
  const kind = faceKind(emoji)
  if (!kind) return <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>{emoji}</span>
  const Draw = FACE[kind]
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <Draw />
    </svg>
  )
}
