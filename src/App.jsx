import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import AppErrorBoundary from './components/layout/AppErrorBoundary.jsx'
import Register from './pages/Register.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import './App.css'

const Transactions = lazy(() => import('./pages/Transactions.jsx'))
const Categories = lazy(() => import('./pages/Categories.jsx'))
const Budgets = lazy(() => import('./pages/Budgets.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

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
    <AppErrorBoundary>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Suspense fallback={<RouteLoading />}><Dashboard /></Suspense>} />
            <Route path="transactions" element={<Suspense fallback={<RouteLoading />}><Transactions /></Suspense>} />
            <Route path="categories" element={<Suspense fallback={<RouteLoading />}><Categories /></Suspense>} />
            <Route path="budgets" element={<Suspense fallback={<RouteLoading />}><Budgets /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<RouteLoading />}><Analytics /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<RouteLoading />}><Settings /></Suspense>} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppErrorBoundary>
  )
}
