import { useEffect, useState } from 'react'

/**
 * 좁은 화면 여부.
 *
 * 화면 스타일이 전부 인라인이라 미디어쿼리를 쓸 수 없어 상태로 분기한다.
 * 서버 렌더 때는 알 수 없으므로 데스크톱으로 두고, 마운트 후 실제 폭으로 정정한다.
 */
export function useIsMobile(breakpoint = 820) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [breakpoint])

  return isMobile
}
