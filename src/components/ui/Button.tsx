import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

interface SharedProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  icon?: ReactNode
  className?: string
  children?: ReactNode
}

type ButtonAsButton = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: 'button'
  }

type ButtonAsAnchor = SharedProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: 'a'
  }

type ButtonProps = ButtonAsButton | ButtonAsAnchor

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-lime-500 text-court-950 hover:bg-lime-400 active:bg-lime-600 shadow-[var(--shadow-glow)] disabled:bg-cream-dim/40 disabled:text-court-900/40 disabled:shadow-none',
  secondary: 'bg-court-800 text-cream hover:bg-court-700 active:bg-court-600 border border-court-600',
  outline: 'bg-transparent text-lime-500 border-2 border-lime-500 hover:bg-lime-500/10',
  ghost: 'bg-transparent text-cream hover:bg-white/5',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
}

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
}

export default function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth,
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 font-display font-bold tracking-wide transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`

  if (props.as === 'a') {
    const { as: _as, ...anchorProps } = props
    return (
      <a className={classes} {...anchorProps}>
        {icon}
        {children}
      </a>
    )
  }

  const { as: _as, ...buttonProps } = props as ButtonAsButton
  return (
    <button className={classes} {...buttonProps}>
      {icon}
      {children}
    </button>
  )
}
