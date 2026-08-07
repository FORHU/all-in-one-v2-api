import { PrismaClient, PageStatus } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface BannerSeed {
  title: string;
  imageUrl: string;
  linkUrl: string;
}

interface FaqSeed {
  category: string;
  question: string;
  answer: string;
}

interface TenantCmsSeed {
  storeName: string;
  homeHeadline: string;
  homeSub: string;
  homeCtaText: string;
  homeCtaLink: string;
  featuredCollectionSlug: string;
  aboutHeadline: string;
  aboutBody: string;
  shippingBody: string;
  sizeGuideBody: string;
  brandStoryHeadline: string;
  brandStoryBody: string;
  featureGrid: { icon: string; title: string; text: string }[];
  banners: BannerSeed[];
  faqs: FaqSeed[];
}

const CMS_BY_TENANT: Record<string, TenantCmsSeed> = {
  [TENANT_IDS.FASHION]: {
    storeName: 'AddictStyle',
    homeHeadline: 'Fall 2026 Streetwear Drop',
    homeSub: 'Discover oversized silhouettes, neutral tones, and premium cotton sets.',
    homeCtaText: 'Shop the Lookbook',
    homeCtaLink: '/collections/streetwear-off-duty-lookbook',
    featuredCollectionSlug: 'summer-monochrome-outfit',
    aboutHeadline: 'About AddictStyle',
    aboutBody: 'AddictStyle is a streetwear-first fashion house designing oversized essentials for everyday city life.',
    shippingBody: 'Standard shipping takes 5-8 business days with full tracking. Express options are available at checkout.',
    sizeGuideBody: 'All streetwear items are cut with a relaxed oversized fit. Check the size guide on each product page for exact CM measurements.',
    brandStoryHeadline: 'Our Story',
    brandStoryBody: 'Founded by a collective of streetwear designers, AddictStyle set out to make premium oversized fashion accessible to everyone.',
    featureGrid: [
      { icon: 'Truck', title: 'Free Worldwide Shipping', text: 'On all orders over $75' },
      { icon: 'ShieldCheck', title: 'Quality Guarantee', text: '30-day easy returns' },
      { icon: 'Sparkles', title: 'Sustainable Materials', text: '100% organic heavy cotton' },
    ],
    banners: [
      { title: 'Fall Collection Launch Banner', imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80', linkUrl: '/collections/summer-monochrome-outfit' },
      { title: 'Streetwear Lookbook Banner', imageUrl: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1200&q=80', linkUrl: '/collections/streetwear-off-duty-lookbook' },
      { title: 'New Arrivals Banner', imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80', linkUrl: '/new-arrivals' },
      { title: 'Footwear Sale Banner', imageUrl: 'https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=1200&q=80', linkUrl: '/categories/footwear' },
      { title: 'Accessories Spotlight Banner', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&q=80', linkUrl: '/categories/accessories' },
    ],
    faqs: [
      { category: 'Shipping & Delivery', question: 'How long does international shipping take?', answer: 'Standard international shipping takes 5-8 business days with full tracking.' },
      { category: 'Sizing & Fits', question: 'Are your t-shirts oversized or true-to-size?', answer: 'All streetwear items are cut with a relaxed oversized fit. Check our Size Guide on each product page for exact CM measurements.' },
      { category: 'Returns & Exchanges', question: 'What is your return policy?', answer: 'We offer 30-day free returns on unworn items with tags attached.' },
      { category: 'Payments', question: 'What payment methods do you accept?', answer: 'We accept all major credit cards, PayPal, and GCash for eligible regions.' },
      { category: 'Orders', question: 'Can I change or cancel my order after placing it?', answer: 'Orders can be modified within 1 hour of placement by contacting support.' },
    ],
  },
  [TENANT_IDS.BEAUTY]: {
    storeName: 'AskMeBeauty',
    homeHeadline: 'Glow Starts Here',
    homeSub: 'Clean-formula skincare, makeup and fragrance curated for every routine.',
    homeCtaText: 'Shop Skincare',
    homeCtaLink: '/collections/morning-glow-skincare-routine',
    featuredCollectionSlug: 'morning-glow-skincare-routine',
    aboutHeadline: 'About AskMeBeauty',
    aboutBody: 'AskMeBeauty curates dermatologist-loved skincare, makeup, and fragrance to help you build a routine that works.',
    shippingBody: 'Orders ship within 24 hours and arrive in 3-6 business days with tracking included.',
    sizeGuideBody: 'Most of our skincare and fragrance products are available in multiple volumes — check the volume guide on each product page.',
    brandStoryHeadline: 'Our Story',
    brandStoryBody: 'AskMeBeauty was founded to demystify skincare routines with honest, ingredient-first product curation.',
    featureGrid: [
      { icon: 'Leaf', title: 'Clean Ingredients', text: 'Cruelty-free and paraben-free' },
      { icon: 'Truck', title: 'Free Shipping', text: 'On orders over $40' },
      { icon: 'Heart', title: 'Loved by Reviewers', text: '4.8/5 average rating' },
    ],
    banners: [
      { title: 'Glow Up Sale Banner', imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&q=80', linkUrl: '/collections/morning-glow-skincare-routine' },
      { title: 'New Serum Launch Banner', imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80', linkUrl: '/products/vitamin-c-brightening-serum' },
      { title: 'Fragrance Collection Banner', imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&q=80', linkUrl: '/categories/fragrance' },
      { title: 'Self-Care Sunday Banner', imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1200&q=80', linkUrl: '/collections/self-care-sunday-set' },
      { title: 'Makeup Essentials Banner', imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=1200&q=80', linkUrl: '/categories/makeup' },
    ],
    faqs: [
      { category: 'Ingredients', question: 'Are your products cruelty-free?', answer: 'Yes, every product we sell is cruelty-free and never tested on animals.' },
      { category: 'Skincare', question: 'How do I know which skin type products are right for me?', answer: 'Each product page lists the recommended skin types — check the Skin Type filter to narrow results.' },
      { category: 'Shipping & Delivery', question: 'How fast do orders ship?', answer: 'Orders ship within 24 hours and typically arrive within 3-6 business days.' },
      { category: 'Returns & Exchanges', question: 'Can I return an opened product?', answer: 'For hygiene reasons we only accept returns on unopened, unused products within 14 days.' },
      { category: 'Orders', question: 'Do you offer sample sizes?', answer: 'Select serums and fragrances are available in smaller trial volumes — look for the volume selector.' },
    ],
  },
  [TENANT_IDS.ELECTRONICS]: {
    storeName: 'DigitFriend',
    homeHeadline: 'Level Up Your Setup',
    homeSub: 'Gaming gear, audio, and smart devices for creators and gamers alike.',
    homeCtaText: 'Shop the Creator Setup',
    homeCtaLink: '/collections/pro-creator-desk-setup',
    featuredCollectionSlug: 'pro-creator-desk-setup',
    aboutHeadline: 'About DigitFriend',
    aboutBody: 'DigitFriend sources performance-tested electronics for gamers, creators, and smart-home enthusiasts.',
    shippingBody: 'Most orders ship same-day and arrive within 3-5 business days. Express shipping is available at checkout.',
    sizeGuideBody: 'For sizing help on wearables and cases, check the dimensions guide listed on each product page.',
    brandStoryHeadline: 'Our Story',
    brandStoryBody: 'DigitFriend started as a small gaming peripherals shop and grew into a full-catalog tech destination.',
    featureGrid: [
      { icon: 'Zap', title: 'Fast Shipping', text: 'Same-day dispatch on in-stock items' },
      { icon: 'ShieldCheck', title: '2-Year Warranty', text: 'On all electronics' },
      { icon: 'Headphones', title: '24/7 Support', text: 'Live chat with tech experts' },
    ],
    banners: [
      { title: 'Creator Desk Setup Banner', imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80', linkUrl: '/collections/pro-creator-desk-setup' },
      { title: 'Gaming Battlestation Banner', imageUrl: 'https://images.unsplash.com/photo-1616400619175-5beda3a17896?w=1200&q=80', linkUrl: '/collections/gaming-battlestation-bundle' },
      { title: 'Smart Home Banner', imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&q=80', linkUrl: '/collections/smart-home-starter-bundle' },
      { title: 'Wearable Tech Banner', imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80', linkUrl: '/categories/wearable-tech' },
      { title: 'Audio Gear Banner', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80', linkUrl: '/categories/audio' },
    ],
    faqs: [
      { category: 'Warranty', question: 'What warranty comes with electronics purchases?', answer: 'All electronics include a minimum 1-year manufacturer warranty; select items include 2-3 years.' },
      { category: 'Shipping & Delivery', question: 'Do you ship internationally?', answer: 'Yes, we ship to over 40 countries with tracked, insured shipping.' },
      { category: 'Compatibility', question: 'Is the smart home hub compatible with other brands?', answer: 'Yes, our hub supports Zigbee, Wi-Fi, Bluetooth, and Matter-certified devices.' },
      { category: 'Returns & Exchanges', question: 'What is the return window for electronics?', answer: 'You may return unopened electronics within 30 days for a full refund.' },
      { category: 'Orders', question: 'Can I track my order in real time?', answer: 'Yes, a tracking link is emailed as soon as your order ships.' },
    ],
  },
  [TENANT_IDS.LIVING]: {
    storeName: 'Living',
    homeHeadline: 'Make Every Room Feel Like Home',
    homeSub: 'Furniture, decor, and everyday essentials for a warmer, more organized home.',
    homeCtaText: 'Shop the Living Room Bundle',
    homeCtaLink: '/collections/cozy-living-room-refresh-bundle',
    featuredCollectionSlug: 'cozy-living-room-refresh-bundle',
    aboutHeadline: 'About Living',
    aboutBody: 'Living curates thoughtfully designed furniture and decor that make everyday spaces feel intentional.',
    shippingBody: 'Small items ship within 3-5 business days. Furniture deliveries are scheduled within 1-2 weeks depending on region.',
    sizeGuideBody: 'Furniture dimensions are listed on every product page — check width, height and depth before ordering.',
    brandStoryHeadline: 'Our Story',
    brandStoryBody: 'Living was founded by interior designers who wanted to make considered home design accessible and affordable.',
    featureGrid: [
      { icon: 'Truck', title: 'White-Glove Delivery', text: 'Available on furniture orders' },
      { icon: 'Leaf', title: 'Sustainably Sourced', text: 'FSC-certified wood and natural fibers' },
      { icon: 'ShieldCheck', title: '1-Year Warranty', text: 'On all furniture pieces' },
    ],
    banners: [
      { title: 'Living Room Refresh Banner', imageUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80', linkUrl: '/collections/cozy-living-room-refresh-bundle' },
      { title: 'Bedroom Setup Banner', imageUrl: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=1200&q=80', linkUrl: '/collections/modern-bedroom-setup' },
      { title: 'Dining Essentials Banner', imageUrl: 'https://images.unsplash.com/photo-1584346133934-a3afd2035dd7?w=1200&q=80', linkUrl: '/collections/dining-room-essentials-bundle' },
      { title: 'Home Office Banner', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80', linkUrl: '/collections/home-office-setup' },
      { title: 'Bath & Spa Banner', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80', linkUrl: '/collections/spa-inspired-bath-bundle' },
    ],
    faqs: [
      { category: 'Delivery', question: 'How long does furniture delivery take?', answer: 'Furniture is delivered within 1-2 weeks depending on your region, with white-glove delivery available.' },
      { category: 'Assembly', question: 'Does furniture require assembly?', answer: 'Most seating and shelving require light assembly; instructions and hardware are included.' },
      { category: 'Returns & Exchanges', question: 'Can I return furniture?', answer: 'Furniture can be returned within 30 days in original condition; return shipping fees may apply.' },
      { category: 'Materials', question: 'Is your wood sustainably sourced?', answer: 'Yes, all solid wood pieces are FSC-certified and sustainably sourced.' },
      { category: 'Orders', question: 'Can I order fabric swatches before buying?', answer: 'Swatch kits are available for select upholstered items — contact support to request one.' },
    ],
  },
  [TENANT_IDS.OUTDOOR]: {
    storeName: 'Outdoor',
    homeHeadline: 'Gear Up For The Trail',
    homeSub: 'Camping, hiking, cycling and water sports gear built for real adventures.',
    homeCtaText: 'Shop the Backpacking Bundle',
    homeCtaLink: '/collections/weekend-backpacking-bundle',
    featuredCollectionSlug: 'weekend-backpacking-bundle',
    aboutHeadline: 'About Outdoor',
    aboutBody: 'Outdoor equips hikers, campers, cyclists and paddlers with durable, field-tested gear.',
    shippingBody: 'Orders ship within 2 business days and typically arrive within 4-7 business days.',
    sizeGuideBody: 'Apparel sizing charts and gear capacity guides are listed on each product page.',
    brandStoryHeadline: 'Our Story',
    brandStoryBody: 'Outdoor was founded by a group of trail guides who wanted gear that could keep up with real adventures.',
    featureGrid: [
      { icon: 'Mountain', title: 'Field-Tested Gear', text: 'Vetted by trail guides' },
      { icon: 'Truck', title: 'Fast Trail-Ready Shipping', text: 'Ships within 2 business days' },
      { icon: 'ShieldCheck', title: 'Lifetime Repair Program', text: 'On select hard goods' },
    ],
    banners: [
      { title: 'Backpacking Bundle Banner', imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80', linkUrl: '/collections/weekend-backpacking-bundle' },
      { title: 'Trail Ready Hiking Banner', imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80', linkUrl: '/collections/trail-ready-hiking-setup' },
      { title: 'Cycling Essentials Banner', imageUrl: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=1200&q=80', linkUrl: '/collections/cycling-essentials-bundle' },
      { title: 'Paddle Day Banner', imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80', linkUrl: '/collections/paddle-day-bundle' },
      { title: 'Yoga & Recovery Banner', imageUrl: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=1200&q=80', linkUrl: '/collections/yoga-recovery-setup' },
    ],
    faqs: [
      { category: 'Gear Care', question: 'How do I clean and store my tent?', answer: 'Air-dry your tent fully before storing loosely in a breathable sack to prevent mildew.' },
      { category: 'Sizing & Fits', question: 'How do I choose the right backpack capacity?', answer: 'For day hikes, 20-28L is ideal; for multi-day trips, look at 40L+ packs.' },
      { category: 'Shipping & Delivery', question: 'Do you ship oversized items like tents and paddleboards?', answer: 'Yes, oversized items ship via freight carrier and may take 5-10 business days.' },
      { category: 'Returns & Exchanges', question: 'Can I return gear after testing it outdoors once?', answer: 'Lightly used gear can be returned within 30 days as long as it is in resellable condition.' },
      { category: 'Warranty', question: 'Do you offer a repair program?', answer: 'Yes, select hard goods like packs and poles are covered under our lifetime repair program.' },
    ],
  },
};

export async function seedCMS(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding CMS Pages, Sections, Banners & FAQs for 5 Tenants...\n');

  for (const [tenantId, cms] of Object.entries(CMS_BY_TENANT)) {
    const featuredCollection = await prisma.catalogCollection.findUnique({
      where: { tenantId_slug: { tenantId, slug: cms.featuredCollectionSlug } },
    });

    // 1. Home page
    const homePage = await prisma.cmsPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home' } },
      update: {},
      create: {
        tenantId,
        slug: 'home',
        title: `${cms.storeName} Storefront Homepage`,
        status: PageStatus.PUBLISHED,
        seoMetadata: {
          metaTitle: `${cms.storeName} — ${cms.homeHeadline}`,
          metaDescription: cms.homeSub,
        },
      },
    });

    const homeSectionCount = await prisma.cmsPageSection.count({ where: { pageId: homePage.id } });
    if (homeSectionCount === 0) {
      await prisma.cmsPageSection.createMany({
        data: [
          {
            pageId: homePage.id,
            type: 'HERO',
            position: 1,
            content: {
              headline: cms.homeHeadline,
              subheadline: cms.homeSub,
              ctaText: cms.homeCtaText,
              ctaLink: cms.homeCtaLink,
            },
          },
          {
            pageId: homePage.id,
            type: 'COLLECTION',
            position: 2,
            collectionId: featuredCollection?.id || null,
            content: {
              headline: 'Featured Right Now',
              description: `Shop the ${featuredCollection?.title ?? cms.homeHeadline} collection.`,
            },
          },
          {
            pageId: homePage.id,
            type: 'FEATURE_GRID',
            position: 3,
            content: { items: cms.featureGrid },
          },
        ],
      });
    }

    // 2. About page
    const aboutPage = await prisma.cmsPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'about' } },
      update: {},
      create: {
        tenantId,
        slug: 'about',
        title: cms.aboutHeadline,
        status: PageStatus.PUBLISHED,
        seoMetadata: { metaTitle: cms.aboutHeadline, metaDescription: cms.aboutBody },
      },
    });
    const aboutSectionCount = await prisma.cmsPageSection.count({ where: { pageId: aboutPage.id } });
    if (aboutSectionCount === 0) {
      await prisma.cmsPageSection.create({
        data: {
          pageId: aboutPage.id,
          type: 'TEXT_BLOCK',
          position: 1,
          content: { headline: cms.aboutHeadline, body: cms.aboutBody },
        },
      });
    }

    // 3. Shipping policy page
    const shippingPage = await prisma.cmsPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'shipping-policy' } },
      update: {},
      create: {
        tenantId,
        slug: 'shipping-policy',
        title: 'Shipping Policy',
        status: PageStatus.PUBLISHED,
        seoMetadata: { metaTitle: `${cms.storeName} Shipping Policy`, metaDescription: cms.shippingBody },
      },
    });
    const shippingSectionCount = await prisma.cmsPageSection.count({ where: { pageId: shippingPage.id } });
    if (shippingSectionCount === 0) {
      await prisma.cmsPageSection.create({
        data: {
          pageId: shippingPage.id,
          type: 'TEXT_BLOCK',
          position: 1,
          content: { headline: 'Shipping Policy', body: cms.shippingBody },
        },
      });
    }

    // 4. Size guide info page
    const sizeGuidePage = await prisma.cmsPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'size-guide-info' } },
      update: {},
      create: {
        tenantId,
        slug: 'size-guide-info',
        title: 'Size Guide',
        status: PageStatus.PUBLISHED,
        seoMetadata: { metaTitle: `${cms.storeName} Size Guide`, metaDescription: cms.sizeGuideBody },
      },
    });
    const sizeGuideSectionCount = await prisma.cmsPageSection.count({ where: { pageId: sizeGuidePage.id } });
    if (sizeGuideSectionCount === 0) {
      await prisma.cmsPageSection.create({
        data: {
          pageId: sizeGuidePage.id,
          type: 'TEXT_BLOCK',
          position: 1,
          content: { headline: 'How to Find Your Size', body: cms.sizeGuideBody },
        },
      });
    }

    // 5. Brand story page
    const brandStoryPage = await prisma.cmsPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'brand-story' } },
      update: {},
      create: {
        tenantId,
        slug: 'brand-story',
        title: cms.brandStoryHeadline,
        status: PageStatus.PUBLISHED,
        seoMetadata: { metaTitle: `${cms.storeName} Brand Story`, metaDescription: cms.brandStoryBody },
      },
    });
    const brandStorySectionCount = await prisma.cmsPageSection.count({ where: { pageId: brandStoryPage.id } });
    if (brandStorySectionCount === 0) {
      await prisma.cmsPageSection.createMany({
        data: [
          {
            pageId: brandStoryPage.id,
            type: 'HERO',
            position: 1,
            content: { headline: cms.brandStoryHeadline, subheadline: cms.brandStoryBody },
          },
          {
            pageId: brandStoryPage.id,
            type: 'TESTIMONIALS',
            position: 2,
            content: { items: [{ quote: cms.brandStoryBody, author: `${cms.storeName} Founders` }] },
          },
        ],
      });
    }

    // 6. Banners
    const existingBannerCount = await prisma.cmsBanner.count({ where: { tenantId } });
    if (existingBannerCount === 0) {
      await prisma.cmsBanner.createMany({
        data: cms.banners.map((b, idx) => ({
          tenantId,
          title: b.title,
          imageUrl: b.imageUrl,
          linkUrl: b.linkUrl,
          isActive: true,
          position: idx + 1,
        })),
      });
    }

    // 7. FAQs
    const existingFaqCount = await prisma.cmsFAQ.count({ where: { tenantId } });
    if (existingFaqCount === 0) {
      await prisma.cmsFAQ.createMany({
        data: cms.faqs.map((f, idx) => ({
          tenantId,
          category: f.category,
          question: f.question,
          answer: f.answer,
          position: idx + 1,
        })),
      });
    }
  }

  process.stdout.write('✅ Seeded CMS Pages, Sections, Banners & FAQs for all tenants!\n');
}

export default seedCMS;
