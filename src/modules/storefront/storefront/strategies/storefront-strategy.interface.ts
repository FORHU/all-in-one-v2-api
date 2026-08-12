import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';

/**
 * The rich context object passed to every strategy.
 * Strategies can selectively use what they need.
 */
export interface StorefrontContext {
  tenantId: string;
  page: string;
  maxItems: number;

  // Optional polymorphic context targeting
  contextType?: string;
  contextId?: string;

  // Customer-level context (for personalization strategies)

  customerId?: string;
  locale?: string;
  currency?: string;
  device?: 'mobile' | 'desktop' | 'tablet';

  // Strategy-specific config from StorefrontSection.config
  config?: Record<string, unknown>;
}

/**
 * Every strategy must implement this interface.
 * The build() method receives the raw section and the rich context.
 */
export interface StorefrontStrategy {
  build(section: StorefrontRawSection, context: StorefrontContext): Promise<StorefrontProductDto[]>;
}
