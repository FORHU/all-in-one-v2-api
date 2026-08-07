import { PrismaClient } from '@prisma/client';

/**
 * Canonical SupplierPartner IDs. Every other seeder that needs to reference a
 * supplier (imported-products, commerce, payments, etc.) MUST import and use
 * these IDs instead of re-creating/upserting supplier rows themselves — this
 * avoids the historical bug where 'cj-dropshipping' and 'CJ_DROPSHIPPING'
 * ended up as two separate rows due to a case-mismatched unique `name` key.
 */
export const SUPPLIER_IDS = {
  CJ_DROPSHIPPING: '7d890123-4567-4890-a123-456789abcdef',
  PRINTFUL: '8a901234-5678-4901-b234-567890abcdef',
  ALIEXPRESS: '9b012345-6789-4012-c345-678901abcdef',
  PRINTIFY: 'ac123456-7890-4123-d456-789012abcdef',
  SPOCKET: 'bd234567-8901-4234-e567-890123abcdef',
};

/**
 * Canonical SupplierCredential IDs, one per active supplier. Credentials are
 * platform-wide (no tenantId) — a single key set authenticates on behalf of
 * every tenant, per the documented Module 4 architecture. Values here are
 * seed placeholders only; real deployments must overwrite them via a secrets
 * pipeline, never by committing live keys to this file.
 */
export const SUPPLIER_CREDENTIAL_IDS = {
  CJ_DROPSHIPPING: 'c1d20000-0000-4000-8000-000000000001',
  PRINTFUL: 'c1d20000-0000-4000-8000-000000000002',
  PRINTIFY: 'c1d20000-0000-4000-8000-000000000003',
  SPOCKET: 'c1d20000-0000-4000-8000-000000000004',
};

export async function seedSuppliers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Supplier Partners...\n');

  const suppliersToSeed = [
    {
      id: SUPPLIER_IDS.CJ_DROPSHIPPING,
      name: 'cj-dropshipping',
      displayName: 'CJ Dropshipping',
      isActive: true,
      config: {
        baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
        rateLimitMs: 1500,
      },
    },
    {
      id: SUPPLIER_IDS.PRINTFUL,
      name: 'printful',
      displayName: 'Printful',
      isActive: true,
      config: {
        baseUrl: 'https://api.printful.com',
      },
    },
    {
      id: SUPPLIER_IDS.ALIEXPRESS,
      name: 'aliexpress',
      displayName: 'AliExpress Direct',
      isActive: false,
      config: {},
    },
    {
      id: SUPPLIER_IDS.PRINTIFY,
      name: 'printify',
      displayName: 'Printify',
      isActive: true,
      config: {
        baseUrl: 'https://api.printify.com/v1',
      },
    },
    {
      id: SUPPLIER_IDS.SPOCKET,
      name: 'spocket',
      displayName: 'Spocket',
      isActive: true,
      config: {
        baseUrl: 'https://api.spocket.co',
      },
    },
  ];

  for (const supplier of suppliersToSeed) {
    await prisma.supplierPartner.upsert({
      where: { id: supplier.id },
      update: {
        name: supplier.name,
        displayName: supplier.displayName,
        isActive: supplier.isActive,
        config: supplier.config,
      },
      create: supplier,
    });
    process.stdout.write(`✅ Seeded supplier: ${supplier.displayName}\n`);
  }

  // Seed one production SupplierCredential per active supplier. AliExpress is
  // skipped — its adapter is an unfinished stub, so a credential row would be
  // unused and misleading.
  const credentialsToSeed = [
    {
      id: SUPPLIER_CREDENTIAL_IDS.CJ_DROPSHIPPING,
      supplierId: SUPPLIER_IDS.CJ_DROPSHIPPING,
      apiKey: 'seed-cj-dropshipping-api-key-placeholder',
      apiSecret: 'seed-cj-dropshipping-api-secret-placeholder',
    },
    {
      id: SUPPLIER_CREDENTIAL_IDS.PRINTFUL,
      supplierId: SUPPLIER_IDS.PRINTFUL,
      apiKey: 'seed-printful-api-key-placeholder',
      apiSecret: null,
    },
    {
      id: SUPPLIER_CREDENTIAL_IDS.PRINTIFY,
      supplierId: SUPPLIER_IDS.PRINTIFY,
      apiKey: 'seed-printify-api-key-placeholder',
      apiSecret: null,
    },
    {
      id: SUPPLIER_CREDENTIAL_IDS.SPOCKET,
      supplierId: SUPPLIER_IDS.SPOCKET,
      apiKey: 'seed-spocket-api-key-placeholder',
      apiSecret: null,
    },
  ];

  for (const credential of credentialsToSeed) {
    await prisma.supplierCredential.upsert({
      where: { id: credential.id },
      update: {
        apiKey: credential.apiKey,
        apiSecret: credential.apiSecret,
        isActive: true,
      },
      create: {
        id: credential.id,
        supplierId: credential.supplierId,
        environment: 'production',
        apiKey: credential.apiKey,
        apiSecret: credential.apiSecret,
        isActive: true,
      },
    });
    process.stdout.write(`✅ Seeded credential for supplier: ${credential.supplierId}\n`);
  }
}

export default seedSuppliers;
