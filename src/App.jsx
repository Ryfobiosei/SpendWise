import { Link, Route, Routes } from 'react-router'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import Landing from './pages/Landing.jsx'
import RoutePlaceholder from './pages/RoutePlaceholder.jsx'
import './App.css'

function NotFound() {
  return (
    <main className="not-found page-container">
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1>This page isn’t in your plan.</h1>
      <p>Let’s take you back to a place that exists.</p>
      <Link className="button button-primary" to="/">Back to SpendWise</Link>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={(
          <RoutePlaceholder
            eyebrow="YOUR ACCOUNT"
            title="Sign in"
            description="Secure sign-in is coming with the Supabase authentication stage."
            backTo="/"
            backLabel="Back to home"
          />
        )}
      />
      <Route
        path="/register"
        element={(
          <RoutePlaceholder
            eyebrow="GET STARTED"
            title="Create your account"
            description="Account creation will be connected to Supabase Auth in a later stage."
            backTo="/"
            backLabel="Back to home"
          />
        )}
      />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<RoutePlaceholder title="Overview" description="Your financial overview will appear here once your account and data are connected." />} />
        <Route path="transactions" element={<RoutePlaceholder title="Transactions" description="Income and expense tracking will be built here." />} />
        <Route path="budgets" element={<RoutePlaceholder title="Budgets" description="Monthly category budgets will be built here." />} />
        <Route path="analytics" element={<RoutePlaceholder title="Analytics" description="Charts and spending insights will use your saved transactions." />} />
        <Route path="settings" element={<RoutePlaceholder title="Settings" description="Your profile, currency, and preferences will be managed here." />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
