const fs = require('fs');
const file = 'src/modules/inventory/inventory.repository.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `    return {
      variantId,
      totalOnHand,
      totalReserved,
      totalAvailable,
      locations: stocks,
    };
  }`;

const replacement = `    return {
      variantId,
      totalOnHand,
      totalReserved,
      totalAvailable,
      locations: stocks,
    };
  }

  /** Get total onHand and available stock across all locations for multiple variants */
  static async getStockSummariesForVariants(variantIds: string[]) {
    const stocks = await prisma.inventoryStock.findMany({
      where: { variantId: { in: variantIds } },
    });

    const summaryMap = new Map<string, { totalOnHand: number; totalReserved: number; totalAvailable: number }>();

    for (const id of variantIds) {
      summaryMap.set(id, { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 });
    }

    for (const stock of stocks) {
      const current = summaryMap.get(stock.variantId);
      if (current) {
        current.totalOnHand += stock.onHand;
        current.totalReserved += stock.reserved;
        current.totalAvailable += stock.available;
      }
    }

    return summaryMap;
  }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated file via Node script!');
} else {
  console.error('Target not found in file!');
}
