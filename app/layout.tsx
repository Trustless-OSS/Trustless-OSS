import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import '@fontsource/uncut-sans/400.css';
import '@fontsource/uncut-sans/500.css';
import '@fontsource/uncut-sans/600.css';
import '@fontsource/uncut-sans/700.css';
import './globals.css';
import Footer from './components/layout/Footer';
import ThemeProvider from './components/layout/ThemeProvider';
import { Toaster } from './components/layout/Toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Analytics } from '@vercel/analytics/next';

const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Trustless OSS',
  description:
    'Trustless, milestone-based rewards for OSS contributors. GitHub PR merged → funds automatically released via Trustless Work escrow.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const revalidate = 86400;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jbMono.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <div className="page-aurora" aria-hidden="true">
              <span className="page-aurora-one" />
              <span className="page-aurora-two" />
              <span className="page-aurora-three" />
            </div>
            <div className="relative z-10 flex min-h-screen flex-col">
              {children}
              <Footer />
              <Toaster richColors closeButton position="bottom-right" />
            </div>
          </TooltipProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
