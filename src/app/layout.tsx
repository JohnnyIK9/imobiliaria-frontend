import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Imobiliária do Professor',
  description: 'Sistema de gestão imobiliária',
  icons: { icon: '/icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
