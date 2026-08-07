import {
  PrismaClient,
  Prisma,
  StorefrontPageType,
  StorefrontSectionStrategy,
  StorefrontContextType,
} from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface TenantStorefrontMeta {
  tenantId: string;
  brandName: string;
  campaignTitle: string;
  campaignSlug: string;
  campaignDescription: string;
  brandStoryTitle: string;
}

const TENANT_META: TenantStorefrontMeta[] = [
  {
    tenantId: TENANT_IDS.FASHION,
    brandName: 'AddictStyle',
    campaignTitle: 'Summer Streetwear Drop',
    campaignSlug: 'summer-streetwear-drop',
    campaignDescription: 'Limited-time fits before the new season lands.',
    brandStoryTitle: 'The AddictStyle Story',
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    brandName: 'AskMeBeauty',
    campaignTitle: 'Glow Up Sale',
    campaignSlug: 'glow-up-sale',
    campaignDescription: 'Skincare and makeup favorites, discounted for a limited time.',
    brandStoryTitle: 'The AskMeBeauty Story',
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    brandName: 'DigitFriend',
    campaignTitle: 'Tech Flash Deals',
    campaignSlug: 'tech-flash-deals',
    campaignDescription: '24-hour deals on gaming, audio, and smart home gear.',
    brandStoryTitle: 'The DigitFriend Story',
  },
  {
    tenantId: TENANT_IDS.LIVING,
    brandName: 'Living',
    campaignTitle: 'Home Refresh Sale',
    campaignSlug: 'home-refresh-sale',
    campaignDescription: 'Refresh every room for less this week only.',
    brandStoryTitle: 'The Living Story',
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    brandName: 'Outdoor',
    campaignTitle: 'Adventure Ready Sale',
    campaignSlug: 'adventure-ready-sale',
    campaignDescription: 'Gear up for the trail with savings on top-rated outdoor essentials.',
    brandStoryTitle: 'The Outdoor Story',
  },
];

export async function seedStorefront(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Storefront Pages, Sections & Pinned Items for 5 Tenants...\n');

  for (const meta of TENANT_META) {
    const { tenantId, brandName, campaignTitle, campaignSlug, campaignDescription, brandStoryTitle } =
      meta;

    const categories = await prisma.catalogCategory.findMany({
      where: { tenantId, parentId: null },
      orderBy: { sortOrder: 'asc' },
      take: 2,
    });

    const products = await prisma.catalogProduct.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      take: 6,
    });

    // The tenant's merchant-flagged "main" products (CatalogProduct.featured).
    // Per Module 7, these belong in a FEATURED-strategy StorefrontSection, not
    // read directly off CatalogProduct by the storefront — the section is what
    // the FeaturedStrategy actually queries at runtime, with pinned items here
    // taking priority over its dynamic featured=true fallback query.
    const featuredProducts = await prisma.catalogProduct.findMany({
      where: { tenantId, featured: true },
      orderBy: { createdAt: 'asc' },
      take: 6,
    });

    const collections = await prisma.catalogCollection.findMany({
      where: { tenantId, parentId: null },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });

    if (categories.length === 0 || products.length === 0) {
      process.stderr.write(
        `⚠️ Skipping storefront seed for tenant [${tenantId}] — categories/products not found. Ensure categories & imported-products seeders run first.\n`,
      );
      continue;
    }

    const primaryCategory = categories[0];
    const secondaryCategory = categories[1] ?? categories[0];
    const primaryCollection = collections[0];
    const secondaryCollection = collections[1] ?? collections[0];

    // ------------------------------------------------------------------
    // 1. HOME page — 5 sections spanning every major strategy
    // ------------------------------------------------------------------
    const homePage = await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home' } },
      update: {},
      create: {
        tenantId,
        title: `${brandName} Homepage`,
        slug: 'home',
        pageType: StorefrontPageType.HOME,
        isPublished: true,
        seoTitle: `${brandName} — Shop the Latest`,
        seoDescription: `Discover trending, best-selling, and new arrival picks from ${brandName}.`,
      },
    });

    // "Main products" section — this is the table-driven replacement for
    // reading CatalogProduct.featured straight off the product table. The
    // FEATURED strategy queries featured=true dynamically at request time,
    // and pinned StorefrontSectionItem rows below take priority over that
    // query, giving merchandisers an explicit override.
    const featuredSection = await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home-featured-products' } },
      update: {},
      create: {
        tenantId,
        pageId: homePage.id,
        title: 'Featured Products',
        slug: 'home-featured-products',
        strategy: StorefrontSectionStrategy.FEATURED,
        sortOrder: 1,
        maxItems: 12,
        isEnabled: true,
      },
    });

    const pinnedFeaturedProducts = featuredProducts.slice(0, 3);
    for (let i = 0; i < pinnedFeaturedProducts.length; i++) {
      await prisma.storefrontSectionItem.upsert({
        where: {
          sectionId_productId: {
            sectionId: featuredSection.id,
            productId: pinnedFeaturedProducts[i].id,
          },
        },
        update: { position: i },
        create: {
          sectionId: featuredSection.id,
          productId: pinnedFeaturedProducts[i].id,
          position: i,
        },
      });
    }

    const trendingSection = await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home-trending-now' } },
      update: {},
      create: {
        tenantId,
        pageId: homePage.id,
        title: 'Trending Now',
        slug: 'home-trending-now',
        strategy: StorefrontSectionStrategy.TRENDING,
        sortOrder: 2,
        maxItems: 12,
        isEnabled: true,
      },
    });

    const bestSellersSection = await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home-best-sellers' } },
      update: {},
      create: {
        tenantId,
        pageId: homePage.id,
        title: 'Best Sellers',
        slug: 'home-best-sellers',
        strategy: StorefrontSectionStrategy.BEST_SELLERS,
        sortOrder: 3,
        maxItems: 12,
        isEnabled: true,
      },
    });

    const newArrivalsSection = await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home-new-arrivals' } },
      update: {},
      create: {
        tenantId,
        pageId: homePage.id,
        title: 'New Arrivals',
        slug: 'home-new-arrivals',
        strategy: StorefrontSectionStrategy.NEW_ARRIVALS,
        sortOrder: 4,
        maxItems: 12,
        isEnabled: true,
      },
    });

    const collectionSection = await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home-featured-collection' } },
      update: { collectionId: primaryCollection?.id ?? null },
      create: {
        tenantId,
        pageId: homePage.id,
        title: primaryCollection ? primaryCollection.title : 'Featured Collection',
        slug: 'home-featured-collection',
        strategy: StorefrontSectionStrategy.COLLECTION,
        collectionId: primaryCollection?.id ?? null,
        sortOrder: 5,
        maxItems: 12,
        isEnabled: true,
      },
    });

    const editorsPicksSection = await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'home-editors-picks' } },
      update: {},
      create: {
        tenantId,
        pageId: homePage.id,
        title: "Editor's Picks",
        slug: 'home-editors-picks',
        strategy: StorefrontSectionStrategy.MANUAL,
        sortOrder: 6,
        maxItems: 8,
        isEnabled: true,
      },
    });

    const pinnedProducts = products.slice(0, 5);
    for (let i = 0; i < pinnedProducts.length; i++) {
      await prisma.storefrontSectionItem.upsert({
        where: {
          sectionId_productId: { sectionId: editorsPicksSection.id, productId: pinnedProducts[i].id },
        },
        update: { position: i },
        create: {
          sectionId: editorsPicksSection.id,
          productId: pinnedProducts[i].id,
          position: i,
        },
      });
    }

    // ------------------------------------------------------------------
    // 2. CATEGORY landing page
    // ------------------------------------------------------------------
    const categoryPage = await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId, slug: `category-${primaryCategory.slug}` } },
      update: {},
      create: {
        tenantId,
        title: `${primaryCategory.name} — ${brandName}`,
        slug: `category-${primaryCategory.slug}`,
        pageType: StorefrontPageType.CATEGORY,
        isPublished: true,
        seoTitle: `Shop ${primaryCategory.name} | ${brandName}`,
        seoDescription: primaryCategory.description ?? `Browse ${primaryCategory.name} at ${brandName}.`,
      },
    });

    await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: `category-${primaryCategory.slug}-best-sellers` } },
      update: { contextId: primaryCategory.id },
      create: {
        tenantId,
        pageId: categoryPage.id,
        title: `Best of ${primaryCategory.name}`,
        slug: `category-${primaryCategory.slug}-best-sellers`,
        strategy: StorefrontSectionStrategy.BEST_SELLERS,
        contextType: StorefrontContextType.CATEGORY,
        contextId: primaryCategory.id,
        sortOrder: 1,
        maxItems: 12,
        isEnabled: true,
      },
    });

    // ------------------------------------------------------------------
    // 3. BRAND / about page
    // ------------------------------------------------------------------
    const brandPage = await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'our-story' } },
      update: {},
      create: {
        tenantId,
        title: brandStoryTitle,
        slug: 'our-story',
        pageType: StorefrontPageType.BRAND,
        isPublished: true,
        seoTitle: `${brandStoryTitle} | ${brandName}`,
        seoDescription: `Learn what makes ${brandName} different, and shop our featured picks.`,
      },
    });

    await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'brand-featured-picks' } },
      update: {},
      create: {
        tenantId,
        pageId: brandPage.id,
        title: 'Featured Picks',
        slug: 'brand-featured-picks',
        strategy: StorefrontSectionStrategy.FEATURED,
        contextType: StorefrontContextType.BRAND,
        contextId: tenantId,
        sortOrder: 1,
        maxItems: 8,
        isEnabled: true,
      },
    });

    // ------------------------------------------------------------------
    // 4. SEARCH results fallback page
    // ------------------------------------------------------------------
    const searchPage = await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId, slug: 'search' } },
      update: {},
      create: {
        tenantId,
        title: `${brandName} Search`,
        slug: 'search',
        pageType: StorefrontPageType.SEARCH,
        isPublished: true,
        seoTitle: `Search ${brandName}`,
        seoDescription: `Search results and trending suggestions across ${brandName}.`,
      },
    });

    await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: 'search-popular-right-now' } },
      update: {},
      create: {
        tenantId,
        pageId: searchPage.id,
        title: 'Popular Right Now',
        slug: 'search-popular-right-now',
        strategy: StorefrontSectionStrategy.TRENDING,
        sortOrder: 1,
        maxItems: 10,
        isEnabled: true,
      },
    });

    // ------------------------------------------------------------------
    // 5. CAMPAIGN / flash-sale page
    // ------------------------------------------------------------------
    const campaignPage = await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId, slug: campaignSlug } },
      update: {},
      create: {
        tenantId,
        title: campaignTitle,
        slug: campaignSlug,
        pageType: StorefrontPageType.CAMPAIGN,
        isPublished: true,
        seoTitle: `${campaignTitle} | ${brandName}`,
        seoDescription: campaignDescription,
      },
    });

    const flashSaleConfig: Prisma.InputJsonValue = { discountPercent: 30, badge: 'Limited Time' };

    await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: `${campaignSlug}-flash-picks` } },
      update: { contextId: campaignPage.id },
      create: {
        tenantId,
        pageId: campaignPage.id,
        title: 'Flash Sale Picks',
        slug: `${campaignSlug}-flash-picks`,
        strategy: StorefrontSectionStrategy.FLASH_SALE,
        contextType: StorefrontContextType.CAMPAIGN,
        contextId: campaignPage.id,
        config: flashSaleConfig,
        sortOrder: 1,
        maxItems: 10,
        isEnabled: true,
      },
    });

    await prisma.storefrontSection.upsert({
      where: { tenantId_slug: { tenantId, slug: `${campaignSlug}-bundle-collection` } },
      update: { collectionId: secondaryCollection?.id ?? null },
      create: {
        tenantId,
        pageId: campaignPage.id,
        title: secondaryCollection ? secondaryCollection.title : `${secondaryCategory.name} Bundle`,
        slug: `${campaignSlug}-bundle-collection`,
        strategy: StorefrontSectionStrategy.COLLECTION,
        collectionId: secondaryCollection?.id ?? null,
        sortOrder: 2,
        maxItems: 8,
        isEnabled: true,
      },
    });

    process.stdout.write(
      `✅ Seeded 5 Storefront Pages (${['home', `category-${primaryCategory.slug}`, 'our-story', 'search', campaignSlug].join(', ')}) for Tenant [${brandName}]\n`,
    );
  }

  process.stdout.write('🎉 Storefront Pages, Sections & Pinned Items Seeded for all 5 Tenants!\n');
}

export default seedStorefront;
