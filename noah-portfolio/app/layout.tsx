import './globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '../components/ThemeProvider'
import { SpeedInsights } from "@vercel/speed-insights/next";
import StoreProvider from '@/app/StoreProvider'


const inter = Inter({ subsets: ['latin'] })

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://my-portfolio-originalbyteme.vercel.app'
const OG_IMAGE_URL = new URL('/portfolio showcase.gif', SITE_URL).toString()

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Noah Rijkaard',
  description: 'A little portfolio site for Noah Rijkaard',
  openGraph: {
    title: 'Noah Rijkaard',
    description: 'A little portfolio site for Noah Rijkaard',
    images: [
      {
        url: OG_IMAGE_URL,
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
            <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
              {children}
              <SpeedInsights />
            </div>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
