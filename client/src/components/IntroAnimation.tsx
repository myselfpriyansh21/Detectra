/**
 * IntroAnimation.tsx
 * ------------------
 * Single full-screen splash: the Detectra image covers the entire
 * viewport, starting zoomed in (larger scale) and animating down to
 * its normal full-screen size ("zooms from in to out"), holds
 * briefly, then fades out.
 *
 *   Phase 1 (0-0.6s)   : black pause
 *   Phase 2 (0.6-2.2s) : Detectra image zooms from scale(1.25) -> scale(1), fading in
 *   Phase 3 (2.2-4.2s) : hold at normal size
 *   Phase 4 (4.2-5.0s) : fade out
 *   Phase 5 (5.0s)     : onComplete() called -> landing page opens
 *
 * Total runtime: ~5 seconds. Can be skipped by clicking anywhere.
 */

import { useEffect, useState } from 'react'
import detectraLogo from '../assets/detectra_logo.jpeg'

type Phase = 'black' | 'zoom-in' | 'hold' | 'fade-out' | 'done'

interface Props {
  onComplete: () => void
}

export default function IntroAnimation({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('black')

  useEffect(() => {
    const sequence: [Phase, number][] = [
      ['zoom-in',  600],
      ['hold',     1600],
      ['fade-out', 2000],
      ['done',     800],
    ]

    let totalDelay = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    sequence.forEach(([p, delay]) => {
      totalDelay += delay
      const t = setTimeout(() => {
        setPhase(p)
        if (p === 'done') onComplete()
      }, totalDelay)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const visible = phase === 'zoom-in' || phase === 'hold' || phase === 'fade-out'

  const imgStyle: React.CSSProperties = {
    transition: 'transform 1.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 1s ease-in-out',
    transform:
      phase === 'fade-out'
        ? 'scale(1.05)'
        : visible
        ? 'scale(1)'
        : 'scale(0.85)',
    opacity: visible ? (phase === 'fade-out' ? 0 : 1) : 0,
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-50 overflow-hidden cursor-pointer select-none flex items-center justify-center"
      onClick={onComplete}
    >
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-slate-400 text-xs tracking-widest uppercase">
        Click anywhere to skip
      </p>

      <img
        src={detectraLogo}
        alt="Detectra — Analyze · Detect · Protect"
        className="w-full max-w-xs sm:max-w-sm object-contain"
        style={imgStyle}
      />
    </div>
  )
}