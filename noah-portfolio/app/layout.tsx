import './globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '../components/ThemeProvider'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from 'next/link'
import { Github } from 'lucide-react'
import StoreProvider from '@/app/StoreProvider'


const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Noah Rijkaard',
  description: 'A little portfolio site for Noah Rijkaard',
  openGraph: {
    title: 'Noah Rijkaard',
    description: 'A little portfolio site for Noah Rijkaard',
    images: [
      {
        url: '/portfolio showcase.gif', 
        width: 800,
        height: 600,
        alt: 'Noah Rijkaard Portfolio Preview',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta property="og:title" content={metadata.openGraph.title} />
        <meta
          property="og:description"
          content={metadata.openGraph.description}
        />
        <meta property="og:image" content={metadata.openGraph.images[0].url} />
        <meta
          property="og:image:width"
          content={metadata.openGraph.images[0].width.toString()}
        />
        <meta
          property="og:image:height"
          content={metadata.openGraph.images[0].height.toString()}
        />
        <meta
          property="og:image:alt"
          content={metadata.openGraph.images[0].alt}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <StoreProvider>
            <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
              <header className="fixed top-0 right-0 m-4 z-50 flex items-center space-x-4">
                <Link
                  href="https://github.com/OriginalByteMe"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-6 h-6 text-gray-800 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 transition-colors" />
                </Link>
                <Link
                  href="https://blog.noahrijkaard.com"
                  target="_blank"
                  rel="noopener noreferer"
                >
                  <div className="text-gray-800 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition-colors">
                    Blog
                  </div>
                </Link>
                <ThemeSwitch />
              </header>
              {children}
              <SpeedInsights />
            </div>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

