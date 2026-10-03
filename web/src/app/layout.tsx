import type { Metadata } from 'next'
import { Bricolage_Grotesque, IBM_Plex_Sans, Instrument_Sans } from 'next/font/google'

import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})

const ibmPlex = IBM_Plex_Sans({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-ibm-plex',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The AI Apprentice',
  description: 'Structured event capture from expert screen recordings',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} ${ibmPlex.variable}`}>
      <body>{children}</body>
    </html>
  )
}
