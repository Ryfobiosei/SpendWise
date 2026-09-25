import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-error-page">
          <section className="app-error-card" role="alert">
            <span className="eyebrow">SOMETHING WENT WRONG</span>
            <h1>This page could not be displayed.</h1>
            <p>Your saved finance records are unchanged. Reload SpendWise to try again.</p>
            <button className="button button-primary" type="button" onClick={() => window.location.reload()}>Reload SpendWise</button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
