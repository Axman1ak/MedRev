import './v2.css'

export const metadata = { title: 'MedRev, nouvelle interface' }

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className="v2-root">{children}</div>
}
