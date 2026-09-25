import { Link } from 'react-router'
import Brand from '../components/ui/Brand.jsx'

const features = [
  {
    number: '01',
    title: 'See the whole picture',
    description: 'Bring income and spending into one calm, clear view.',
    icon: '◉',
  },
  {
    number: '02',
    title: 'Make a plan that fits',
    description: 'Set monthly budgets around the categories that matter to you.',
    icon: '↗',
  },
  {
    number: '03',
    title: 'Learn from your habits',
    description: 'Follow your trends and find practical ways to stay on track.',
    icon: '⌁',
  },
]

export default function Landing() {
  return (
    <div className="marketing-page">
      <header className="marketing-header page-container">
        <Brand />
        <nav className="marketing-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>
        <div className="marketing-actions">
          <Link className="nav-login" to="/login">Sign in</Link>
          <Link className="button button-small button-dark" to="/register">Get started <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <main>
        <section className="hero-section page-container">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> PERSONAL FINANCE, MADE CLEAR</p>
            <h1>Make room for<br /><span>what matters.</span></h1>
            <p className="hero-description">A thoughtful way to track your money, plan your spending, and feel more confident about what comes next.</p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/register">Build your money plan <span aria-hidden="true">↗</span></Link>
              <Link className="text-link" to="/login">I already have an account <span aria-hidden="true">→</span></Link>
            </div>
            <div className="hero-proof">
              <span className="proof-avatar" aria-hidden="true">G</span>
              <span>Made for everyday money in Ghana</span>
            </div>
          </div>

          <div className="hero-art" aria-label="Illustration of a clear financial plan">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-sun"><span>SW</span></div>
            <div className="art-card card-top"><span className="art-card-icon">↗</span><span>Plan with purpose</span></div>
            <div className="art-card card-bottom"><span className="art-bars"><i /><i /><i /><i /></span><span>Progress, at your pace</span></div>
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">✦</span>
          </div>
        </section>

        <section className="feature-section page-container" id="features">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A LITTLE MORE IN CONTROL</p>
              <h2>Money tools for real life.</h2>
            </div>
            <p>Simple, useful features that help turn good intentions into steady habits.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.number}>
                <div className="feature-card-top"><span>{feature.number}</span><span className="feature-icon" aria-hidden="true">{feature.icon}</span></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="page-container about-inner">
            <span className="about-symbol" aria-hidden="true">✳</span>
            <div><p className="eyebrow">A MORE GROUNDED MONEY ROUTINE</p><h2>Clarity is a good<br />place to start.</h2></div>
            <p className="about-copy">SpendWise makes personal finance feel approachable: useful details when you need them, a clear view of the bigger picture, and room to shape goals that are yours.</p>
          </div>
        </section>
      </main>

      <footer className="marketing-footer page-container">
        <Brand compact />
        <span>Spend intentionally. Live generously.</span>
        <span>© {new Date().getFullYear()} SpendWise</span>
      </footer>
    </div>
  )
}
