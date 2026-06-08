'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Todo = { id: string; text: string; done: boolean; position: number }

export default function DashTodo({ userId }: { userId: string | null }) {
  const supabase = createClient()
  const [todos, setTodos] = useState<Todo[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('todos')
      .select('id, text, done, position')
      .eq('user_id', userId)
      .order('done')
      .order('position')
      .order('created_at')
    setTodos((data as Todo[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { load() }, [load])

  async function add() {
    const t = draft.trim()
    if (!t || !userId) return
    setDraft('')
    const { data } = await supabase
      .from('todos')
      .insert({ user_id: userId, text: t, position: todos.length })
      .select('id, text, done, position')
      .single()
    if (data) setTodos(prev => [...prev, data as Todo])
  }

  async function toggle(id: string, done: boolean) {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, done: !done } : t)))
    await supabase.from('todos').update({ done: !done }).eq('id', id)
  }

  async function remove(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  return (
    <div className="dash-card todo-card">
      <div className="dash-card-title">À faire</div>
      <div className="todo-list">
        {!loading && todos.length === 0 && (
          <div className="todo-empty">Aucune tâche. Ajoute la première ci-dessous.</div>
        )}
        {todos.map(t => (
          <div key={t.id} className={`todo-row${t.done ? ' done' : ''}`}>
            <button
              className={`todo-check${t.done ? ' on' : ''}`}
              onClick={() => toggle(t.id, t.done)}
              aria-label={t.done ? 'Marquer non faite' : 'Marquer faite'}
            />
            <span className="todo-text">{t.text}</span>
            <button className="todo-del" onClick={() => remove(t.id)} aria-label="Supprimer">×</button>
          </div>
        ))}
      </div>
      <div className="todo-add">
        <span className="todo-add-plus">+</span>
        <input
          className="todo-add-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="ajouter une tâche…"
          maxLength={500}
        />
      </div>
    </div>
  )
}
