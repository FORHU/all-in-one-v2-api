import MarketingRepository from './marketing.repository';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';
import { AdSocialPlatform, AdSocialStatus, Prisma } from '@prisma/client';
import crypto from 'crypto';

export default class MarketingService {
  // --- Social Feeds ---
  static async createFeed(params: {
    name: string;
    platform?: AdSocialPlatform;
    config?: Prisma.InputJsonValue;
  }) {
    const tenantId = requireTenantId();
    return MarketingRepository.createSocialFeed(tenantId, {
      name: params.name,
      platform: params.platform || AdSocialPlatform.META,
      ...(params.config !== undefined ? { config: params.config } : {}),
    });
  }

  static async listFeeds(page = 1, limit = 20) {
    const tenantId = requireTenantId();
    return MarketingRepository.findSocialFeedsByTenant(tenantId, page, limit);
  }

  // --- Social Ads ---
  static async createAd(params: {
    productId: string;
    title: string;
    headline?: string;
    description?: string;
    platform?: AdSocialPlatform;
    dailyBudget?: number;
    mediaFileId?: string;
    mediaUrl?: string;
  }) {
    const tenantId = requireTenantId();
    return MarketingRepository.createSocialAd(tenantId, params.productId, {
      title: params.title,
      headline: params.headline,
      description: params.description,
      platform: params.platform || AdSocialPlatform.META,
      dailyBudget: params.dailyBudget,
      ...(params.mediaFileId ? { mediaFile: { connect: { id: params.mediaFileId } } } : {}),
      mediaUrl: params.mediaUrl,
    });
  }

  static async listAds(platform?: AdSocialPlatform, status?: AdSocialStatus, page = 1, limit = 20) {
    const tenantId = requireTenantId();
    return MarketingRepository.findSocialAdsByTenant(tenantId, platform, status, page, limit);
  }

  static async trackAdClick(adId: string) {
    return MarketingRepository.recordAdClick(adId);
  }

  // --- Shareable Links ---
  static async createShareableLink(params: {
    productId: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }) {
    const tenantId = requireTenantId();
    const shortCode = crypto.randomBytes(4).toString('hex'); // 8 char unique short code e.g. "a8b9f2c1"

    return MarketingRepository.createShareableLink(
      tenantId,
      params.productId,
      shortCode,
      params.utmSource || 'social',
      params.utmMedium || 'share_link',
      params.utmCampaign,
    );
  }

  static async resolveShareableLink(code: string) {
    const link = await MarketingRepository.findShareableLinkByCode(code);
    if (!link) {
      return throwResponse(404, 'Shareable link not found');
    }

    await MarketingRepository.recordLinkClick(code);
    return link;
  }
}
