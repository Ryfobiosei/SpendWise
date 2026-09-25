import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import Register from './pages/Register.jsx'
import RoutePlaceholder from './pages/RoutePlaceholder.jsx'
import './App.css'

const Transactions = lazy(() => import('./pages/Transactions.jsx'))
const Categories = lazy(() => import('./pages/Categories.jsx'))

function RouteLoading() {
  return <div className="route-loading" role="status"><span className="auth-spinner" aria-hidden="true" />Loading this page…</div>
}

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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<RoutePlaceholder title="Overview" description="Your financial overview will appear here once your account and data are connected." />} />
          <Route path="transactions" element={<Suspense fallback={<RouteLoading />}><Transactions /></Suspense>} />
          <Route path="categories" element={<Suspense fallback={<RouteLoading />}><Categories /></Suspense>} />
          <Route path="budgets" element={<RoutePlaceholder title="Budgets" description="Monthly category budgets will be built here." />} />
          <Route path="analytics" element={<RoutePlaceholder title="Analytics" description="Charts and spending insights will use your saved transactions." />} />
          <Route path="settings" element={<RoutePlaceholder title="Settings" description="Your profile, currency, and preferences will be managed here." />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
