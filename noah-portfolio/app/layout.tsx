import './globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '../components/ThemeProvider'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from 'next/link'
import { Github } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Noah Rijkaard',
  description: 'A little portfolio site for Noah Rijkaard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
            <header className="fixed top-0 right-0 m-4 z-50 flex items-center space-x-4">
              <Link href="https://github.com/OriginalByteMe" target="_blank" rel="noopener noreferrer">
                <Github className="w-6 h-6 text-gray-800 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 transition-colors" />
              </Link>
              <ThemeSwitch />
            </header>
            {children}
            <SpeedInsights />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

