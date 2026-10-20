/**
 * DigitFriend (electronics vertical) — which CJ Dropshipping products may be
 * sourced into each of the tenant's own categories (categories.seeder.ts).
 *
 * `cjCategoryIds` are CJ level-3 category ids (GET /product/getCategory),
 * passed to /product/listV2's `categoryId` filter. They also act as the
 * electronics allowlist on import — a CJ product whose own category isn't
 * one of these is rejected. `keywords` drive keyword search instead, for a
 * DigitFriend category CJ has no category of its own for (CJ's tree has no
 * keyboard/mouse category at all), and are the bulk importer's search terms
 * there.
 */
export const ELECTRONICS_TENANT_SLUG = 'electronics';
export const CJ_SUPPLIER_ID = 'cj-dropshipping';

export interface ElectronicsCjSource {
  cjCategoryIds: string[];
  keywords: string[];
}

export const ELECTRONICS_CJ_SOURCES = {
  audio: {
    cjCategoryIds: [
      'C1AB7563-AED4-44D8-9F01-05BD91C65307', // Portable Audio & Video > Speakers
      'DAECCC3B-13D8-4978-86A8-61D3DF186134', // Portable Audio & Video > Earphones & Headphones
      '8FD4CA46-AA88-4CDC-8EBA-EBD8412152E2', // Portable Audio & Video > Microphones
    ],
    keywords: [],
  },
  'cameras-optics': {
    cjCategoryIds: [
      'AD21D6F7-42CB-44E7-89B2-542692C7D101', // Camera & Photo > Action Cameras
      'AA40156F-A334-475E-9CA0-7E5520645980', // Camera & Photo > Digital Cameras
      'A2B55BEF-9B7D-44A0-8E80-A14FFFBBBD94', // Camera & Photo > Camera & Photo Accessories
    ],
    keywords: [],
  },
  'computer-peripherals': {
    cjCategoryIds: [],
    keywords: ['mechanical keyboard', 'wireless mouse', 'usb hub'],
  },
  'gaming-accessories': {
    cjCategoryIds: [
      '1F23F16D-0A39-4D38-AB9C-1F21EEDEBEDD', // Video Games > Gamepads
      'A96C59E8-C39A-4C8E-BA75-5B4AA347FCCC', // Video Games > Joysticks
      '2F6CCFAA-853F-41EF-8B91-24028A333948', // Video Games > Handheld Game Players
    ],
    keywords: [],
  },
  'smart-home': {
    cjCategoryIds: [
      '36F73513-6A5A-445D-87F9-BF3D6629E649', // Smart Electronics > Smart Home Appliances
      'E95322D2-FF23-4837-A0C0-0CA686B9F062', // Smart Electronics > Smart Remote Controls
    ],
    keywords: [],
  },
  'wearable-tech': {
    cjCategoryIds: [
      'C83EF2A0-8FA3-4713-9901-2FD6E4554D97', // Smart Electronics > Smart Watches
      '895CF515-0F6B-481D-8A32-604EDCBEFBED', // Smart Electronics > Smart Wristbands
      '11D33F89-9B90-4D1A-B977-DE229BAA7E86', // Smart Electronics > Wearable Devices
    ],
    keywords: [],
  },
} satisfies Record<string, ElectronicsCjSource>;

export type ElectronicsCategorySlug = keyof typeof ELECTRONICS_CJ_SOURCES;

export const ELECTRONICS_CATEGORY_SLUGS = Object.keys(
  ELECTRONICS_CJ_SOURCES,
) as ElectronicsCategorySlug[];

/** Every mapped CJ category id, across all DigitFriend categories. */
export const ELECTRONICS_CJ_CATEGORY_IDS = new Set<string>(
  ELECTRONICS_CATEGORY_SLUGS.flatMap((slug) => ELECTRONICS_CJ_SOURCES[slug].cjCategoryIds),
);
