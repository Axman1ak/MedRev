// src/app/page.tsx  ← Server Component (pas de 'use client')
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/LandingPage'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return <LandingPage />
}
