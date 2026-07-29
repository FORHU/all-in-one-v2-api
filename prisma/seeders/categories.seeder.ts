import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CategoryNode {
  name: string;
  children?: CategoryNode[];
}

// Enterprise Deep Taxonomy (Amazon / Shopee / Lazada / TikTok Shop standard)
const ENTERPRISE_MARKETPLACE_TAXONOMY: CategoryNode[] = [
  {
    name: 'Fashion',
    children: [
      {
        name: "Women's Clothing",
        children: [
          {
            name: 'Dresses',
            children: [
              { name: 'Maxi Dresses' },
              { name: 'Mini Dresses' },
              { name: 'Midi Dresses' },
              { name: 'Cocktail & Party Dresses' },
              { name: 'Evening Gowns' },
              { name: 'Casual Sundresses' },
            ],
          },
          {
            name: 'Tops & Tees',
            children: [
              { name: 'Blouses & Shirts' },
              { name: 'T-Shirts' },
              { name: 'Tank Tops & Camis' },
              { name: 'Crop Tops' },
            ],
          },
          {
            name: 'Bottoms',
            children: [
              { name: 'Jeans & Denim' },
              { name: 'Skirts' },
              { name: 'Shorts' },
              { name: 'Pants & Leggings' },
              { name: 'Sweatpants & Joggers' },
            ],
          },
          {
            name: 'Outerwear & Sweaters',
            children: [
              { name: 'Jackets & Coats' },
              { name: 'Blazers' },
              { name: 'Cardigans & Sweaters' },
              { name: 'Hoodies & Sweatshirts' },
            ],
          },
          { name: 'Swimwear & Beachwear' },
          { name: 'Lingerie & Sleepwear' },
          { name: 'Activewear & Gym Clothes' },
        ],
      },
      {
        name: "Men's Clothing",
        children: [
          {
            name: 'T-Shirts & Polos',
            children: [
              { name: 'Graphic Tees' },
              { name: 'Polo Shirts' },
              { name: 'V-Neck Tees' },
            ],
          },
          {
            name: 'Shirts',
            children: [
              { name: 'Casual Button-Downs' },
              { name: 'Dress Shirts' },
              { name: 'Flannel Shirts' },
            ],
          },
          {
            name: 'Pants & Denim',
            children: [
              { name: 'Jeans' },
              { name: 'Chinos' },
              { name: 'Cargo Pants' },
              { name: 'Sweatpants' },
            ],
          },
          {
            name: 'Outerwear',
            children: [
              { name: 'Jackets & Coats' },
              { name: 'Hoodies & Sweatshirts' },
              { name: 'Vests' },
            ],
          },
          { name: 'Suits & Tailoring' },
          { name: 'Activewear' },
          { name: 'Underwear & Sleepwear' },
        ],
      },
      {
        name: 'Kids & Baby Fashion',
        children: [
          { name: 'Baby Boy Clothing' },
          { name: 'Baby Girl Clothing' },
          { name: 'Boys Clothing' },
          { name: 'Girls Clothing' },
        ],
      },
      {
        name: 'Shoes',
        children: [
          {
            name: "Women's Shoes",
            children: [
              { name: 'Heels & Pumps' },
              { name: 'Sneakers' },
              { name: 'Boots & Ankle Boots' },
              { name: 'Flats & Loafers' },
              { name: 'Sandals & Slides' },
            ],
          },
          {
            name: "Men's Shoes",
            children: [
              { name: 'Sneakers & Athletic' },
              { name: 'Dress Shoes & Oxfords' },
              { name: 'Boots' },
              { name: 'Loafers & Slip-Ons' },
              { name: 'Sandals & Flip-Flops' },
            ],
          },
          { name: "Kids' Shoes" },
        ],
      },
      {
        name: 'Bags & Luggage',
        children: [
          { name: 'Handbags & Totes' },
          { name: 'Backpacks' },
          { name: 'Crossbody & Shoulder Bags' },
          { name: 'Wallets & Clutches' },
          { name: 'Luggage & Suitcases' },
        ],
      },
      {
        name: 'Jewelry & Watches',
        children: [
          { name: 'Necklaces & Pendants' },
          { name: 'Rings' },
          { name: 'Earrings' },
          { name: 'Bracelets & Bangles' },
          { name: "Men's Watches" },
          { name: "Women's Watches" },
        ],
      },
      {
        name: 'Accessories',
        children: [
          { name: 'Sunglasses & Eyewear' },
          { name: 'Hats & Caps' },
          { name: 'Belts' },
          { name: 'Scarves & Wraps' },
        ],
      },
    ],
  },
  {
    name: 'Electronics',
    children: [
      {
        name: 'Smartphones & Mobile Accessories',
        children: [
          { name: 'Smartphones' },
          { name: 'Phone Cases & Covers' },
          { name: 'Chargers & Cables' },
          { name: 'Power Banks' },
          { name: 'Screen Protectors' },
        ],
      },
      {
        name: 'Computers & Laptops',
        children: [
          {
            name: 'Laptops',
            children: [
              { name: 'Gaming Laptops' },
              { name: 'Business Laptops' },
              { name: 'Ultrabooks' },
              { name: 'Chromebooks' },
            ],
          },
          { name: 'Desktops & All-in-Ones' },
          { name: 'Monitors & Displays' },
          {
            name: 'PC Components',
            children: [
              { name: 'Graphics Cards (GPUs)' },
              { name: 'Processors (CPUs)' },
              { name: 'RAM Memory' },
              { name: 'SSD & Hard Drives' },
            ],
          },
        ],
      },
      { name: 'Tablets & E-Readers' },
      {
        name: 'TVs & Home Entertainment',
        children: [
          { name: 'Smart TVs' },
          { name: 'Streaming Devices & Sticks' },
          { name: 'Soundbars & Home Speakers' },
          { name: 'Projectors' },
        ],
      },
      {
        name: 'Audio & Headphones',
        children: [
          { name: 'Wireless Earbuds' },
          { name: 'Over-Ear Headphones' },
          { name: 'Bluetooth Speakers' },
          { name: 'Microphones & Studio Gear' },
        ],
      },
      {
        name: 'Cameras & Drones',
        children: [
          { name: 'Digital Cameras' },
          { name: 'Action Cameras' },
          { name: 'Camera Drones' },
          { name: 'Lenses & Filters' },
        ],
      },
      {
        name: 'Gaming & Accessories',
        children: [
          { name: 'PlayStation Consoles & Games' },
          { name: 'Xbox Consoles & Games' },
          { name: 'Nintendo Switch' },
          { name: 'PC Gaming Gear (Gamepads, Keyboards)' },
        ],
      },
      {
        name: 'Smart Home & Automation',
        children: [
          { name: 'Smart Speakers & Hubs' },
          { name: 'Security Cameras & Doorbells' },
          { name: 'Smart Lighting' },
          { name: 'Smart Plugs & Switches' },
        ],
      },
    ],
  },
  {
    name: 'Home & Living',
    children: [
      {
        name: 'Furniture',
        children: [
          { name: 'Living Room Furniture' },
          { name: 'Bedroom Furniture' },
          { name: 'Home Office Furniture' },
          { name: 'Dining Room Furniture' },
        ],
      },
      {
        name: 'Kitchen & Dining',
        children: [
          { name: 'Cookware Sets' },
          { name: 'Bakeware' },
          { name: 'Kitchen Utensils & Gadgets' },
          {
            name: 'Small Kitchen Appliances',
            children: [
              { name: 'Air Fryers' },
              { name: 'Blenders & Juicers' },
              { name: 'Coffee Makers & Espresso' },
            ],
          },
          { name: 'Dinnerware & Drinkware' },
        ],
      },
      {
        name: 'Bedding & Bath',
        children: [
          { name: 'Bed Sheets & Pillowcases' },
          { name: 'Comforters & Duvets' },
          { name: 'Bath Towels' },
          { name: 'Bath Mats' },
        ],
      },
      {
        name: 'Home Decor',
        children: [
          { name: 'Wall Art & Canvas' },
          { name: 'Rugs & Carpets' },
          { name: 'Curtains & Blinds' },
          { name: 'Candles & Diffusers' },
        ],
      },
      { name: 'Storage & Organization' },
      { name: 'Lighting' },
      { name: 'Cleaning & Vacuum Cleaners' },
      { name: 'Garden & Outdoor Living' },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    children: [
      {
        name: 'Skincare',
        children: [
          { name: 'Cleansers & Toners' },
          { name: 'Facial Serums & Treatments' },
          { name: 'Moisturizers & Creams' },
          { name: 'Sunscreen & Sun Care' },
          { name: 'Sheet Masks' },
        ],
      },
      {
        name: 'Makeup',
        children: [
          { name: 'Face Makeup (Foundations, Concealers)' },
          { name: 'Eye Makeup (Mascara, Eyeliner)' },
          { name: 'Lip Makeup (Lipsticks, Lip Gloss)' },
        ],
      },
      {
        name: 'Hair Care',
        children: [
          { name: 'Shampoos & Conditioners' },
          { name: 'Hair Treatments & Oils' },
          { name: 'Hair Styling Tools' },
        ],
      },
      { name: 'Fragrances & Perfumes' },
      { name: "Men's Grooming" },
      { name: 'Bath & Body' },
      { name: 'Oral Care' },
      { name: 'Beauty Tools & Appliances' },
    ],
  },
  {
    name: 'Health & Wellness',
    children: [
      { name: 'Vitamins & Supplements' },
      { name: 'Medical Supplies & Thermometers' },
      { name: 'First Aid Kits' },
      { name: 'Mobility & Supports' },
      { name: 'Health Monitors' },
      { name: 'Massage & Relaxation' },
      { name: 'Sexual Wellness' },
    ],
  },
  {
    name: 'Sports & Outdoors',
    children: [
      {
        name: 'Fitness & Exercise',
        children: [
          { name: 'Yoga Mats & Accessories' },
          { name: 'Resistance Bands' },
          { name: 'Dumbbells & Weights' },
          { name: 'Treadmills & Exercise Bikes' },
        ],
      },
      {
        name: 'Camping & Hiking',
        children: [
          { name: 'Tents & Tarps' },
          { name: 'Sleeping Bags' },
          { name: 'Camping Stoves' },
          { name: 'Hiking Backpacks' },
        ],
      },
      { name: 'Cycling & Bikes' },
      { name: 'Running & Apparel' },
      { name: 'Water Sports' },
      { name: 'Team Sports' },
      { name: 'Outdoor Recreation' },
    ],
  },
  {
    name: 'Automotive',
    children: [
      {
        name: 'Car Electronics & GPS',
        children: [
          { name: 'DVR & Dash Cameras' },
          { name: 'Car Stereos & Radios' },
          { name: 'GPS Trackers' },
          { name: 'Car Chargers & Transmitters' },
        ],
      },
      {
        name: 'Interior Accessories',
        children: [
          { name: 'Floor Mats & Liners' },
          { name: 'Car Seat Covers' },
          { name: 'Steering Wheel Covers' },
          { name: 'Organizers & Storage' },
        ],
      },
      { name: 'Exterior Accessories' },
      { name: 'Car Care & Detailing' },
      {
        name: 'Tools & Maintenance',
        children: [
          { name: 'OBD2 Diagnostic Scanners' },
          { name: 'Car Jump Starters' },
          { name: 'Tire Inflators' },
        ],
      },
      {
        name: 'Motorcycle Gear',
        children: [
          { name: 'Helmets & Visors' },
          { name: 'Jackets & Gloves' },
          { name: 'Bluetooth Headsets' },
        ],
      },
    ],
  },
  {
    name: 'Toys, Kids & Baby',
    children: [
      {
        name: 'Baby Gear & Nursery',
        children: [
          { name: 'Strollers & Prams' },
          { name: 'Car Seats' },
          { name: 'Baby Carriers & Wraps' },
          { name: 'High Chairs' },
        ],
      },
      { name: 'Feeding & Nursing' },
      { name: 'Diapers & Wipes' },
      {
        name: 'Toys & Games',
        children: [
          { name: 'Building Blocks & LEGO' },
          { name: 'Action Figures & Collectibles' },
          { name: 'Dolls & Dollhouses' },
          { name: 'RC Cars & Drones' },
          { name: 'Educational Toys & STEM Kits' },
          { name: 'Board Games & Puzzles' },
        ],
      },
    ],
  },
  {
    name: 'Food & Beverages',
    children: [
      {
        name: 'Coffee, Tea & Beverages',
        children: [
          { name: 'Whole Bean & Ground Coffee' },
          { name: 'Espresso Pods' },
          { name: 'Organic & Herbal Teas' },
          { name: 'Juices & Carbonated Drinks' },
        ],
      },
      { name: 'Snacks & Sweets' },
      { name: 'Pantry Staples' },
      { name: 'Fresh Produce & Organic Foods' },
      { name: 'Bakery & Desserts' },
    ],
  },
  {
    name: 'Office, Books & Pets',
    children: [
      { name: 'Office & School Supplies' },
      { name: 'Books & Literature' },
      { name: 'Art & Craft Supplies' },
      { name: 'Printers & Ink Cartridges' },
      {
        name: 'Pet Supplies',
        children: [
          { name: 'Dog Food & Treats' },
          { name: 'Cat Food & Treats' },
          { name: 'Pet Leashes & Harnesses' },
          { name: 'Pet Beds & Crates' },
          { name: 'Pet Grooming & Clippers' },
        ],
      },
    ],
  },
];

async function seedCategoryBranch(
  prisma: PrismaClient,
  tenantId: string,
  node: CategoryNode,
  parentId: string | null = null,
  prefixSlug = ''
) {
  const currentSlug = prefixSlug ? `${prefixSlug}-${slugify(node.name)}` : slugify(node.name);

  const category = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId, slug: currentSlug } },
    update: { name: node.name, parentId },
    create: {
      tenantId,
      name: node.name,
      slug: currentSlug,
      parentId,
    },
  });

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await seedCategoryBranch(prisma, tenantId, child, category.id, currentSlug);
    }
  }
}

export async function seedCategories(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Deep Enterprise Master Category Taxonomy (Up to 4 Levels)...\n');

  for (const tenantId of Object.values(TENANT_IDS)) {
    for (const rootCategory of ENTERPRISE_MARKETPLACE_TAXONOMY) {
      await seedCategoryBranch(prisma, tenantId, rootCategory);
    }
  }

  process.stdout.write('🎉 Ultra-Comprehensive Marketplace Category Tree Seeded Successfully across all Tenants!\n');
}
