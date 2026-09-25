import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/categoryService.js'

const FILTERS = [
  { value: 'all', label: 'All categories' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
]

function emptyForm() {
  return { name: '', type: 'expense' }
}

export default function Categories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const formCardRef = useRef(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (!formOpen) return undefined

    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      formCardRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      nameInputRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editingId, formOpen])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true

    listCategories(user.id, filter === 'all' ? undefined : filter)
      .then((rows) => {
        if (active) setCategories(rows)
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || 'Could not load categories.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [filter, user?.id])

  async function refreshCategories() {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const rows = await listCategories(user.id, filter === 'all' ? undefined : filter)
      setCategories(rows)
    } catch (loadError) {
      setError(loadError?.message || 'Could not load categories.')
    } finally {
      setLoading(false)
    }
  }

  function changeFilter(value) {
    if (value === filter) return
    setLoading(true)
    setError('')
    setFilter(value)
  }

  function openCreateForm() {
    setEditingId(null)
    setForm(emptyForm())
    setFormError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEditForm(category) {
    setEditingId(category.id)
    setForm({ name: category.name, type: category.type })
    setFormError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setFormError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!user?.id) return
    setSaving(true)
    setFormError('')
    setNotice('')

    try {
      const wasEditing = Boolean(editingId)
      if (wasEditing) await updateCategory(user.id, editingId, form)
      else await createCategory(user.id, form)
      closeForm()
      setNotice(wasEditing ? 'Category updated.' : 'Category created.')
      await refreshCategories()
    } catch (saveError) {
      setFormError(saveError?.message || 'Could not save the category.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(categoryId) {
    if (!user?.id) return
    setDeletingId(categoryId)
    setError('')
    setNotice('')
    try {
      await deleteCategory(user.id, categoryId)
      setDeleteId(null)
      setNotice('Category deleted.')
      await refreshCategories()
    } catch (deleteError) {
      setDeleteId(null)
      setError(deleteError?.message || 'Could not delete the category.')
    } finally {
      setDeletingId(null)
    }
  }

  const visibleCategories = categories.filter((category) => (
    category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ))

  return (
    <section className="categories-page">
      <div className="categories-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>Categories</h1>
          <p className="categories-description">Group income and spending in a way that makes sense to you.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreateForm}>＋ Add category</button>
      </div>

      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}

      {formOpen && (
        <section ref={formCardRef} className="category-form-card" aria-labelledby="category-form-title">
          <div className="category-form-heading">
            <div>
              <p className="eyebrow">{editingId ? 'UPDATE CATEGORY' : 'NEW CATEGORY'}</p>
              <h2 id="category-form-title">{editingId ? 'Edit category' : 'Create a category'}</h2>
            </div>
            <button className="icon-button" type="button" onClick={closeForm} aria-label="Close category form">×</button>
          </div>
          {formError && <p className="inline-error" role="alert">{formError}</p>}
          <form className="category-form" onSubmit={submitForm}>
            <label className="data-field">
              <span>Category name</span>
              <input ref={nameInputRef} type="text" maxLength={60} required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Pet care" />
            </label>
            <label className="data-field">
              <span>Type</span>
              <select required value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <div className="category-form-actions">
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create category'}</button>
              <button className="button button-quiet" type="button" onClick={closeForm} disabled={saving}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="category-list-card">
        <div className="category-toolbar">
          <div className="category-tabs" role="group" aria-label="Filter categories by type">
            {FILTERS.map((option) => (
              <button key={option.value} type="button" className={'category-tab' + (filter === option.value ? ' active' : '')} onClick={() => changeFilter(option.value)} aria-pressed={filter === option.value}>{option.label}</button>
            ))}
          </div>
          <label className="category-search">
            <span className="sr-only">Search categories</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" />
          </label>
        </div>

        <div className="category-list-heading">
          <h2>Your categories</h2>
          <span>{loading ? 'Loading…' : visibleCategories.length + (visibleCategories.length === 1 ? ' category' : ' categories')}</span>
        </div>

        {loading && <div className="transaction-loading"><span className="auth-spinner" aria-hidden="true" /><span>Loading categories…</span></div>}

        {!loading && error && <div className="category-empty"><h3>Categories could not be loaded.</h3><button className="button button-quiet" type="button" onClick={refreshCategories}>Try again</button></div>}

        {!loading && !error && visibleCategories.length === 0 && (
          <div className="category-empty">
            <span className="empty-state-icon" aria-hidden="true">◎</span>
            <h3>{search ? 'No categories match that search.' : 'No categories in this view yet.'}</h3>
            <p>{search ? 'Try another name or clear your search.' : 'Create one to keep your finances organized.'}</p>
            {!search && <button className="button button-primary" type="button" onClick={openCreateForm}>Add a category</button>}
          </div>
        )}

        {!loading && !error && visibleCategories.length > 0 && (
          <ul className="category-list">
            {visibleCategories.map((category) => (
              <li className="category-row" key={category.id}>
                <span className={'category-symbol category-symbol-' + category.type} aria-hidden="true">{category.type === 'expense' ? '↘' : '↗'}</span>
                <div className="category-details">
                  <strong>{category.name}</strong>
                  <span className={'type-pill type-' + category.type}>{category.type === 'expense' ? 'Expense' : 'Income'}</span>
                </div>
                <div className="category-actions">
                  {deleteId === category.id ? (
                    <span className="delete-confirm">
                      <span>Delete?</span>
                      <button type="button" onClick={() => confirmDelete(category.id)} disabled={deletingId === category.id}>{deletingId === category.id ? 'Deleting…' : 'Yes'}</button>
                      <button type="button" onClick={() => setDeleteId(null)} disabled={deletingId === category.id}>No</button>
                    </span>
                  ) : (
                    <>
                      <button className="row-action" type="button" onClick={() => openEditForm(category)}>Edit</button>
                      <button className="row-action row-action-delete" type="button" onClick={() => setDeleteId(category.id)}>Delete</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
