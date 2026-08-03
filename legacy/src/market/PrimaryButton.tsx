import { ReactNode } from 'react'
import './market.css'

type PrimaryButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export default function PrimaryButton({
  variant,
  size,
  icon,
  fullWidth,
  children,
  onClick,
  disabled
}: PrimaryButtonProps) {
  var className = 'mk-btn mk-btn--primary'
  if (variant === 'secondary') {
    className = 'mk-btn mk-btn--secondary'
  }
  if (variant === 'ghost') {
    className = 'mk-btn mk-btn--ghost'
  }

  if (size === 'sm') {
    className = className + ' mk-btn--sm'
  } else if (size === 'lg') {
    className = className + ' mk-btn--lg'
  } else {
    className = className + ' mk-btn--md'
  }

  if (fullWidth) {
    className = className + ' mk-btn--block'
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {icon ? <span className="mk-btn__icon">{icon}</span> : null}
      {children}
    </button>
  )
}
