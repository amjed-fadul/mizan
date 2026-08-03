import { ReactNode } from 'react'

type ButtonProps = {
  type?: 'primary' | 'secondary'
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export default function Button({ type, children, onClick, disabled }: ButtonProps) {
  var className = 'btn btn-primary'
  if (type === 'secondary') {
    className = 'btn btn-secondary'
  }

  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
