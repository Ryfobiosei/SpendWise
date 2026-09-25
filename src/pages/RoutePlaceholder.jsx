import { Link } from 'react-router'

export default function RoutePlaceholder({ eyebrow, title, description, backTo = '/dashboard', backLabel = 'Back to overview' }) {
  return (
    <section className="placeholder-page">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <p className="placeholder-description">{description}</p>
      <div className="empty-state-card">
        <span className="empty-state-icon" aria-hidden="true">✳</span>
        <div>
          <h2>Your workspace is taking shape</h2>
          <p>Connect the account and data layers to bring this part of SpendWise to life.</p>
        </div>
      </div>
      <Link className="text-link" to={backTo}>← {backLabel}</Link>
    </section>
  )
}
