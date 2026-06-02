import type { Metadata } from 'next';
import type { HomePageData } from '@/lib/api';
import HeroCarousel from '@/components/home/HeroCarousel';
import ServiceCarousel from '@/components/home/ServiceCarousel';
import AboutSection from '@/components/home/AboutSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import CaseStudiesSection from '@/components/home/CaseStudiesSection';
import IndustriesSection from '@/components/home/IndustriesSection';
import VideoDemoSection from '@/components/home/VideoDemoSection';
import TeamSection from '@/components/home/TeamSection';
import BlogSection from '@/components/home/BlogSection';
import NewsletterSection from '@/components/home/NewsletterSection';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'SLP Systems - IT Management & AI Solutions | Calgary, Alberta',
  description:
    'SLP Systems delivers cutting-edge IT solutions, AI/ML services, and digital transformation strategies. Trusted by enterprises across Banking, Oil & Gas, Public Sector, and Transportation.',
  keywords: [
    'IT Solutions Calgary',
    'AI Solutions',
    'Machine Learning',
    'Deep Learning',
    'Computer Vision',
    'Generative AI',
    'Digital Transformation',
    'Managed IT Services',
    'Enterprise AI',
    'Cloud Solutions',
  ],
  openGraph: {
    title: 'SLP Systems - IT Management & AI Solutions',
    description:
      'Empowering businesses with cutting-edge IT solutions, AI/ML services, and digital transformation strategies.',
    type: 'website',
    locale: 'en_CA',
    siteName: 'SLP Systems',
  },
};

async function getHomeData(): Promise<HomePageData | null> {
  try {
    const res = await fetch(`${API_URL}/api/home`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <>
      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Services Carousel */}
      <ServiceCarousel services={data?.allServices ?? data?.featuredServices ?? []} />

      {/* About Section */}
      <AboutSection />

      {/* Testimonials */}
      <TestimonialsSection testimonials={data?.testimonials ?? []} />

      {/* Case Studies */}
      <CaseStudiesSection caseStudies={data?.caseStudies ?? []} />

      {/* Industries */}
      <IndustriesSection industries={data?.industries ?? []} />

      {/* Video Demos */}
      <VideoDemoSection videos={data?.videoDemos ?? []} />

      {/* Team */}
      <TeamSection teamMembers={data?.teamMembers ?? []} />

      {/* Blog */}
      <BlogSection posts={data?.recentPosts ?? []} />

      {/* Newsletter */}
      <NewsletterSection />
    </>
  );
}
