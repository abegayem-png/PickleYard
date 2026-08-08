import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export default function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-3xl bg-court-800/70 border border-white/5 backdrop-blur-sm ${className}`} {...props}>
      {children}
    </div>
  )
}
