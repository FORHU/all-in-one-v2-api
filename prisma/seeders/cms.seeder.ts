import { PrismaClient, PageStatus } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedCMS(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding CMS Pages, Sections, Banners & FAQs...\n');

  // Fetch a fashion collection to link to CMS section
  const fashionCollection = await prisma.catalogCollection.findFirst({
    where: { tenantId: TENANT_IDS.FASHION },
  });

  // 1. Fashion Homepage
  const fashionPage = await prisma.cmsPage.upsert({
    where: { tenantId_slug: { tenantId: TENANT_IDS.FASHION, slug: 'home' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      slug: 'home',
      title: 'Vogue Fashion Storefront Homepage',
      status: PageStatus.PUBLISHED,
      seoMetadata: {
        metaTitle: 'Vogue Fashion — Oversized Apparel & Streetwear 2026',
        metaDescription:
          'Shop curated oversized streetwear, daily fits, and unisex fashion bundles.',
      },
    },
  });

  // Add CMS Page Sections
  await prisma.cmsPageSection.createMany({
    data: [
      {
        pageId: fashionPage.id,
        type: 'HERO',
        position: 1,
        content: {
          headline: 'Summer 2026 Streetwear drop',
          subheadline: 'Discover oversized silhouettes, neutral tones, and premium cotton sets.',
          ctaText: 'Explore Lookbook',
          ctaLink: '/collections/urban-streetwear-lookbook-2026',
        },
      },
      {
        pageId: fashionPage.id,
        type: 'COLLECTION',
        position: 2,
        collectionId: fashionCollection?.id || null,
        content: {
          headline: 'Curated Fit of the Week',
          description: 'Get the complete 3-piece fit with 1-click bundle add to cart.',
        },
      },
      {
        pageId: fashionPage.id,
        type: 'FEATURE_GRID',
        position: 3,
        content: {
          items: [
            { icon: 'Truck', title: 'Free Worldwide Shipping', text: 'On all orders over $75' },
            { icon: 'ShieldCheck', title: 'Quality Guarantee', text: '30-day easy returns' },
            { icon: 'Sparkles', title: 'Sustainable Materials', text: '100% organic heavy cotton' },
          ],
        },
      },
    ],
  });

  // 2. Banners
  await prisma.cmsBanner.createMany({
    data: [
      {
        tenantId: TENANT_IDS.FASHION,
        title: 'Summer Collection Launch Banner',
        imageUrl:
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
        linkUrl: '/collections/summer-monochrome-outfit',
        isActive: true,
        position: 1,
      },
      {
        tenantId: TENANT_IDS.ELECTRONICS,
        title: 'Pro Tech Creator Bundle Banner',
        imageUrl:
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        linkUrl: '/collections/pro-creator-desk-setup',
        isActive: true,
        position: 1,
      },
    ],
  });

  // 3. FAQs
  await prisma.cmsFAQ.createMany({
    data: [
      {
        tenantId: TENANT_IDS.FASHION,
        category: 'Shipping & Delivery',
        question: 'How long does international shipping take?',
        answer: 'Standard international shipping takes 5-8 business days with full tracking.',
        position: 1,
      },
      {
        tenantId: TENANT_IDS.FASHION,
        category: 'Sizing & Fits',
        question: 'Are your t-shirts oversized or true-to-size?',
        answer:
          'All streetwear items are cut with a relaxed oversized fit. Check our Size Guide on each product page for exact CM measurements.',
        position: 2,
      },
    ],
  });

  process.stdout.write('✅ Seeded CMS Pages, Sections, Banners & FAQs!\n');
}
