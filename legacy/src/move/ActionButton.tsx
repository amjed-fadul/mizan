import { ReactNode } from 'react'
import './move.css'

type ActionButtonProps = {
  kind?: 'confirm' | 'cancel' | 'ghost'
  loading?: boolean
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export default function ActionButton({ kind, loading, children, onClick, disabled }: ActionButtonProps) {
  var className = 'mv-action mv-action--confirm'
  if (kind === 'cancel') {
    className = 'mv-action mv-action--cancel'
  }
  if (kind === 'ghost') {
    className = 'mv-action mv-action--ghost'
  }

  if (loading) {
    className = className + ' mv-action--loading'
  }

  return (
    <button className={className} onClick={onClick} disabled={disabled || loading}>
      {loading ? <span className="mv-action__spinner">...</span> : null}
      {loading ? 'Please wait' : children}
    </button>
  )
}
