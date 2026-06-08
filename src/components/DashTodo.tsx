'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Todo = { id: string; text: string; done: boolean; position: number }

export default function DashTodo({ userId }: { userId: string | null }) {
  const supabase = createClient()
  const [todos, setTodos] = useState<Todo[]>([])
  const [draft, setDraft] = useState('')

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

  const pending = todos.filter(t => !t.done).length

  return (
    <div className="panel reveal d2" style={{ flex: '1 1 0', minHeight: 0 }}>
      <div className="phead">
        <div className="picon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="ptitle">À faire</div>
          <div className="psub">{pending} tâche{pending > 1 ? 's' : ''} en cours</div>
        </div>
      </div>
      <div className="todo-scroll" style={{ marginTop: 12 }}>
        {todos.map(t => (
          <div key={t.id} className={`todo${t.done ? ' done' : ''}`}>
            <button
              className={`check${t.done ? ' done' : ''}`}
              onClick={() => toggle(t.id, t.done)}
              aria-label={t.done ? 'Marquer non faite' : 'Marquer faite'}
            />
            <span className="txt">{t.text}</span>
            <button className="del" onClick={() => remove(t.id)} aria-label="Supprimer">×</button>
          </div>
        ))}
        <div className="add">
          <span>+</span>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="ajouter une tâche…"
            maxLength={500}
          />
        </div>
      </div>
    </div>
  )
}
