import { Link } from 'react-router'

export default function Brand({ to = '/', compact = false }) {
  return (
    <Link className={`brand${compact ? ' brand-compact' : ''}`} to={to} aria-label="SpendWise home">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>spend<span className="brand-accent">wise</span></span>
    </Link>
  )
}
