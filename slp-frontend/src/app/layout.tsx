import type { Metadata } from 'next';
import './globals.css';
import LayoutWrapper from '@/components/layout/LayoutWrapper';
import LiveChatWidget from '@/components/chat/LiveChatWidget';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://slpsystems.ca';

export const metadata: Metadata = {
  title: {
    default: 'SLP Systems — IT Management. SIMPLIFIED.',
    template: '%s | SLP Systems',
  },
  description:
    'SLP Systems delivers expert IT consulting, data engineering, AI/ML solutions, and managed services for businesses across Canada. Calgary, Alberta.',
  keywords: [
    'IT Solutions', 'Data Engineering', 'AI', 'Machine Learning', 'Digital Transformation',
    'Calgary IT', 'Azure', 'Cloud Infrastructure', 'SLP Systems',
  ],
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: siteUrl,
    siteName: 'SLP Systems',
    title: 'SLP Systems — IT Management. SIMPLIFIED.',
    description:
      'Expert IT consulting, data engineering, AI/ML, and cloud services for Canadian enterprises. Calgary-based, Canada-wide.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SLP Systems — IT Management. SIMPLIFIED.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SLP Systems — IT Management. SIMPLIFIED.',
    description:
      'Expert IT consulting, data engineering, AI/ML, and cloud services for Canadian enterprises.',
    images: ['/og-image.png'],
    creator: '@slpsystems',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  verification: {
    // Add your Google Search Console, Bing, etc. verification codes here:
    // google: 'your-google-verification-code',
  },
  other: {
    // LinkedIn Insight Tag (replace with your partner ID):
    // 'linkedin:partner_id': '1234567',
    // Facebook Domain Verification:
    // 'facebook-domain-verification': 'your-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LayoutWrapper>{children}</LayoutWrapper>
        <LiveChatWidget />
      </body>
    </html>
  );
}
