'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { getRandomMessage } from '@/lib/messages'

interface CelebrationProps {
  show: boolean
  onComplete: () => void
}

export function Celebration({ show, onComplete }: CelebrationProps) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (show) {
      setMessage(getRandomMessage('completion'))
      const timer = setTimeout(onComplete, 1500)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-3 animate-in zoom-in-75 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)] text-white shadow-lg">
          <Check className="h-8 w-8" />
        </div>
        <p className="text-lg font-semibold text-foreground bg-card/90 px-4 py-2 rounded-full shadow-lg">
          {message}
        </p>
      </div>
    </div>
  )
}
