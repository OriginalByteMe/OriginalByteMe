import './globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '../components/ThemeProvider'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Developer Portfolio',
  description: 'A sleek and minimalist developer portfolio',
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
            <header className="fixed top-0 right-0 m-4 z-50">
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

