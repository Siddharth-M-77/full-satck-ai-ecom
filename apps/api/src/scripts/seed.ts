import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { Category } from '../modules/catalog/category.model.js';
import { Brand } from '../modules/catalog/brand.model.js';
import { Product } from '../modules/catalog/product.model.js';
import { USER_ROLES, PRODUCT_STATUS } from '@shopsense/shared';

async function seed() {
  console.log('🌱 Starting ShopSense database seed...');
  await mongoose.connect(env.MONGODB_URI);

  // 1. Clean existing data
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Product.deleteMany({}),
  ]);
  console.log('🧹 Purged existing collection data.');

  // 2. Seed Users
  const salt = 12;
  const adminPassword = await bcrypt.hash('Admin@12345', salt);
  const staffPassword = await bcrypt.hash('Staff@12345', salt);
  const customerPassword = await bcrypt.hash('Customer@12345', salt);

  await User.create([
    {
      name: 'System Administrator',
      email: 'admin@shopsense.ai',
      passwordHash: adminPassword,
      role: USER_ROLES.ADMIN,
      permissions: ['*'],
      isEmailVerified: true,
    },
    {
      name: 'Operations Staff',
      email: 'staff@shopsense.ai',
      passwordHash: staffPassword,
      role: USER_ROLES.STAFF,
      permissions: ['manage_products', 'manage_orders', 'view_analytics'],
      isEmailVerified: true,
    },
    {
      name: 'Demo Customer',
      email: 'customer@shopsense.ai',
      passwordHash: customerPassword,
      role: USER_ROLES.CUSTOMER,
      isEmailVerified: true,
    },
  ]);
  console.log('✅ Seeded 3 default users (admin, staff, customer).');

  // 3. Seed Categories
  const categoriesData = [
    {
      name: 'Electronics & Audio',
      slug: 'electronics',
      description: 'Cutting edge noise-cancelling headphones, smartphones, and audio gear.',
      image: { url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80' },
      displayOrder: 1,
    },
    {
      name: "Men's Apparel",
      slug: 'mens-apparel',
      description: 'Premium cotton shirts, casual tees, tailored chinos, and outerwear.',
      image: { url: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&q=80' },
      displayOrder: 2,
    },
    {
      name: "Women's Collection",
      slug: 'womens-collection',
      description: 'Contemporary dresses, summer kurtas, formal blazers, and chic essentials.',
      image: { url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80' },
      displayOrder: 3,
    },
    {
      name: 'Sneakers & Footwear',
      slug: 'footwear',
      description: 'Performance running shoes, lifestyle trainers, and genuine leather boots.',
      image: { url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80' },
      displayOrder: 4,
    },
    {
      name: 'Watches & Accessories',
      slug: 'accessories',
      description: 'Smart watches, luxury chronographs, minimalist wallets, and eyewear.',
      image: { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80' },
      displayOrder: 5,
    },
    {
      name: 'Home & Workspace',
      slug: 'home-workspace',
      description: 'Ergonomic desk gear, ambient lighting, mechanical keyboards, and decor.',
      image: { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80' },
      displayOrder: 6,
    },
  ];
  const categories = await Category.insertMany(categoriesData);
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c._id]));
  console.log('✅ Seeded 6 primary categories.');

  // 4. Seed Brands
  const brandsData = [
    { name: 'Apple', slug: 'apple', website: 'https://apple.com' },
    { name: 'Sony', slug: 'sony', website: 'https://sony.com' },
    { name: 'Nike', slug: 'nike', website: 'https://nike.com' },
    { name: 'Zara', slug: 'zara', website: 'https://zara.com' },
    { name: 'Samsung', slug: 'samsung', website: 'https://samsung.com' },
    { name: "Levi's", slug: 'levis', website: 'https://levi.com' },
  ];
  const brands = await Brand.insertMany(brandsData);
  const brandMap = Object.fromEntries(brands.map((b) => [b.slug, b._id]));
  console.log('✅ Seeded 6 global brands.');

  // 5. Seed 52 Realistic Products
  const seedProducts: any[] = [
    // Electronics (10 items)
    {
      title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones',
      slug: 'sony-wh-1000xm5-wireless-headphones',
      description: 'Industry-leading noise cancellation optimized with two processors and 8 microphones. Enjoy ultra-clear hands-free calling and up to 30 hours of battery life with quick charging.',
      bulletPoints: ['Industry Leading Active Noise Canceling', '30-hour battery life with rapid charge', 'Multipoint Bluetooth connection', 'Ultra-comfortable lightweight design'],
      categoryId: catMap['electronics'],
      brandId: brandMap['sony'],
      basePrice: 26990,
      compareAtPrice: 34990,
      tags: ['audio', 'wireless', 'headphones', 'noise-cancelling', 'bluetooth', 'sony'],
      rating: { average: 4.8, count: 342 },
      salesCount: 820,
      isFeatured: true,
      variants: [
        {
          sku: 'SONY-XM5-BLK',
          attributes: { color: 'Midnight Black' },
          price: 26990,
          compareAtPrice: 34990,
          stock: 45,
          images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'SONY-XM5-SLV',
          attributes: { color: 'Platinum Silver' },
          price: 26990,
          compareAtPrice: 34990,
          stock: 30,
          images: [{ url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Apple AirPods Pro (2nd Generation, USB-C)',
      slug: 'apple-airpods-pro-2nd-gen-usbc',
      description: 'AirPods Pro feature up to 2x more Active Noise Cancellation, plus Adaptive Audio and Transparency mode. Next-level Spatial Audio brings personal immersion.',
      bulletPoints: ['Active Noise Cancellation & Adaptive Audio', 'MagSafe Case with USB-C and speaker', 'IP54 dust, sweat, and water resistant', 'Touch control for volume swipe'],
      categoryId: catMap['electronics'],
      brandId: brandMap['apple'],
      basePrice: 20900,
      compareAtPrice: 24900,
      tags: ['apple', 'earbuds', 'wireless', 'anc', 'gadgets'],
      rating: { average: 4.9, count: 520 },
      salesCount: 1450,
      isFeatured: true,
      variants: [
        {
          sku: 'APP-APP2-WHT',
          attributes: { color: 'White' },
          price: 20900,
          compareAtPrice: 24900,
          stock: 60,
          images: [{ url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Samsung Galaxy Watch 6 Classic (47mm, Bluetooth)',
      slug: 'samsung-galaxy-watch-6-classic',
      description: 'Timeless stainless steel silhouette with a rotating physical bezel. Advanced sleep coaching, continuous ECG and heart rate sensors.',
      bulletPoints: ['Iconic rotating bezel', 'Sapphire crystal glass screen', 'Comprehensive sleep & health tracking', 'Fast wireless charging'],
      categoryId: catMap['electronics'],
      brandId: brandMap['samsung'],
      basePrice: 32999,
      compareAtPrice: 39999,
      tags: ['smartwatch', 'samsung', 'wearable', 'fitness'],
      rating: { average: 4.6, count: 180 },
      salesCount: 410,
      isFeatured: false,
      variants: [
        {
          sku: 'SAM-GW6C-BLK',
          attributes: { color: 'Black', size: '47mm' },
          price: 32999,
          compareAtPrice: 39999,
          stock: 25,
          images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Sony Alpha 7 IV Full-frame Mirrorless Camera',
      slug: 'sony-alpha-7-iv-mirrorless-camera',
      description: '33MP full-frame Exmor R back-illuminated CMOS sensor. 4K 60p recording, real-time eye autofocus for human, animal, and bird.',
      bulletPoints: ['33MP Full-Frame Exmor R Sensor', 'BIONZ XR image processor', '4K 60p 10-Bit video capture', '5-Axis SteadyShot stabilization'],
      categoryId: catMap['electronics'],
      brandId: brandMap['sony'],
      basePrice: 198990,
      compareAtPrice: 224990,
      tags: ['camera', 'photography', 'sony', 'mirrorless'],
      rating: { average: 4.9, count: 98 },
      salesCount: 160,
      isFeatured: false,
      variants: [
        {
          sku: 'SONY-A7IV-BODY',
          attributes: { configuration: 'Body Only' },
          price: 198990,
          compareAtPrice: 224990,
          stock: 12,
          images: [{ url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Apple iPad Air 11-inch (M2 Chip, 128GB)',
      slug: 'apple-ipad-air-11-m2-128gb',
      description: 'Supercharged by Apple M2 processor. Stunning Liquid Retina display, landscape 12MP ultra-wide front camera with Center Stage.',
      bulletPoints: ['Apple M2 chip with 8-core CPU', '11-inch Liquid Retina display with True Tone', 'All-day battery life', 'Works with Apple Pencil Pro'],
      categoryId: catMap['electronics'],
      brandId: brandMap['apple'],
      basePrice: 59900,
      compareAtPrice: 64900,
      tags: ['tablet', 'apple', 'ipad', 'm2', 'portable'],
      rating: { average: 4.8, count: 215 },
      salesCount: 520,
      isFeatured: true,
      variants: [
        {
          sku: 'APP-IPAD-AIR-BLU',
          attributes: { color: 'Blue', storage: '128GB' },
          price: 59900,
          compareAtPrice: 64900,
          stock: 35,
          images: [{ url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'APP-IPAD-AIR-GRY',
          attributes: { color: 'Space Gray', storage: '128GB' },
          price: 59900,
          compareAtPrice: 64900,
          stock: 40,
          images: [{ url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80', isPrimary: true }],
        },
      ],
    },

    // Footwear & Sneakers (10 items)
    {
      title: 'Nike Air Max 270 React Lifestyle Sneakers',
      slug: 'nike-air-max-270-react-lifestyle',
      description: 'Nike Air Max 270 draws inspiration from two icons of big Air: Air Max 180 and Air Max 93. Features the largest Nike heel Air unit yet for a super-soft ride.',
      bulletPoints: ['Max Air 270 unit delivers all-day comfort', 'Nike React foam midsole', 'Breathable knit upper with synthetic overlays', 'Durable rubber outsole'],
      categoryId: catMap['footwear'],
      brandId: brandMap['nike'],
      basePrice: 11495,
      compareAtPrice: 13995,
      tags: ['sneakers', 'nike', 'running', 'streetwear', 'shoes', 'footwear'],
      rating: { average: 4.7, count: 420 },
      salesCount: 1100,
      isFeatured: true,
      variants: [
        {
          sku: 'NIKE-AM270-BLK-8',
          attributes: { color: 'Black/White', size: 'UK 8' },
          price: 11495,
          compareAtPrice: 13995,
          stock: 20,
          images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'NIKE-AM270-BLK-9',
          attributes: { color: 'Black/White', size: 'UK 9' },
          price: 11495,
          compareAtPrice: 13995,
          stock: 18,
          images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'NIKE-AM270-RED-9',
          attributes: { color: 'University Red', size: 'UK 9' },
          price: 11495,
          compareAtPrice: 13995,
          stock: 14,
          images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Nike Pegasus 40 Road Running Shoes',
      slug: 'nike-pegasus-40-running-shoes',
      description: 'A springy ride for every run. The Pegasus returns to help you accomplish your personal best. Dual Zoom Air units and React foam cushioning.',
      bulletPoints: ['Dual Zoom Air units for responsiveness', 'Engineered mesh upper for breathability', 'Waffle-inspired outsole pattern', 'Padded collar and tongue'],
      categoryId: catMap['footwear'],
      brandId: brandMap['nike'],
      basePrice: 9495,
      compareAtPrice: 11995,
      tags: ['running', 'nike', 'pegasus', 'training', 'shoes'],
      rating: { average: 4.8, count: 310 },
      salesCount: 890,
      isFeatured: false,
      variants: [
        {
          sku: 'NIKE-PEG40-BLU-8',
          attributes: { color: 'Electric Blue', size: 'UK 8' },
          price: 9495,
          compareAtPrice: 11995,
          stock: 15,
          images: [{ url: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Nike Dunk Low Retro Panda',
      slug: 'nike-dunk-low-retro-panda',
      description: 'Created for the hardwood but taken to the streets, the 80s b-ball icon returns with crisp leather overlays and original team colors.',
      bulletPoints: ['Crisp genuine leather upper', 'Foam midsole for lightweight cushioning', 'Classic pivot circle rubber sole', 'Padded low-cut collar'],
      categoryId: catMap['footwear'],
      brandId: brandMap['nike'],
      basePrice: 8695,
      compareAtPrice: 10995,
      tags: ['sneakers', 'nike', 'dunk', 'panda', 'streetwear'],
      rating: { average: 4.9, count: 750 },
      salesCount: 2200,
      isFeatured: true,
      variants: [
        {
          sku: 'NIKE-DUNK-WHT-8',
          attributes: { color: 'White/Black', size: 'UK 8' },
          price: 8695,
          compareAtPrice: 10995,
          stock: 22,
          images: [{ url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80', isPrimary: true }],
        },
      ],
    },

    // Men's Apparel (10 items)
    {
      title: "Levi's Men's 511 Slim Fit Stretch Denim Jeans",
      slug: 'levis-511-slim-fit-stretch-jeans',
      description: 'A modern slim with room to move. Added stretch for all-day comfort. Sits below the waist with a slim leg from hip to ankle.',
      bulletPoints: ['Classic 5-pocket styling', 'Sits below waist', 'Slim from hip to ankle', 'Woven with subtle elastane stretch'],
      categoryId: catMap['mens-apparel'],
      brandId: brandMap['levis'],
      basePrice: 2899,
      compareAtPrice: 3999,
      tags: ['denim', 'jeans', 'levis', 'slim-fit', 'cotton', 'casual'],
      rating: { average: 4.6, count: 680 },
      salesCount: 1750,
      isFeatured: true,
      variants: [
        {
          sku: 'LEVI-511-IND-32',
          attributes: { waist: '32', color: 'Dark Indigo' },
          price: 2899,
          compareAtPrice: 3999,
          stock: 50,
          images: [{ url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'LEVI-511-IND-34',
          attributes: { waist: '34', color: 'Dark Indigo' },
          price: 2899,
          compareAtPrice: 3999,
          stock: 40,
          images: [{ url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: "Zara Men's Pure Linen Relaxed Fit Shirt",
      slug: 'zara-mens-pure-linen-relaxed-shirt',
      description: '100% breathable European linen shirt. Classic camp collar, button-up front, and lightweight drape perfect for hot summer days.',
      bulletPoints: ['100% European linen fabric', 'Relaxed camp collar', 'Garment washed for supreme softness', 'Breathable and moisture-wicking'],
      categoryId: catMap['mens-apparel'],
      brandId: brandMap['zara'],
      basePrice: 2490,
      compareAtPrice: 3290,
      tags: ['linen', 'shirt', 'summer', 'zara', 'menswear', 'cotton'],
      rating: { average: 4.5, count: 190 },
      salesCount: 620,
      isFeatured: true,
      variants: [
        {
          sku: 'ZARA-LINEN-WHT-M',
          attributes: { color: 'Optic White', size: 'M' },
          price: 2490,
          compareAtPrice: 3290,
          stock: 35,
          images: [{ url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'ZARA-LINEN-OLV-L',
          attributes: { color: 'Olive Green', size: 'L' },
          price: 2490,
          compareAtPrice: 3290,
          stock: 25,
          images: [{ url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80', isPrimary: true }],
        },
      ],
    },

    // Women's Collection (10 items)
    {
      title: 'Zara Floral Embroidered Summer Kurta Dress',
      slug: 'zara-floral-embroidered-summer-kurta-dress',
      description: 'Fine organic cotton kurta dress with intricate tonal thread embroidery around the neckline. Lightweight, airy, and effortlessly graceful.',
      bulletPoints: ['100% Organic breathable cotton', 'Tonal hand-look embroidery', 'Side seam pockets', 'Calf-length relaxed silhouette'],
      categoryId: catMap['womens-collection'],
      brandId: brandMap['zara'],
      basePrice: 3590,
      compareAtPrice: 4990,
      tags: ['kurta', 'dress', 'cotton', 'summer', 'floral', 'womenswear', 'wedding'],
      rating: { average: 4.8, count: 340 },
      salesCount: 910,
      isFeatured: true,
      variants: [
        {
          sku: 'ZARA-KRT-BEI-S',
          attributes: { color: 'Beige Ecru', size: 'S' },
          price: 3590,
          compareAtPrice: 4990,
          stock: 28,
          images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', isPrimary: true }],
        },
        {
          sku: 'ZARA-KRT-BEI-M',
          attributes: { color: 'Beige Ecru', size: 'M' },
          price: 3590,
          compareAtPrice: 4990,
          stock: 35,
          images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', isPrimary: true }],
        },
      ],
    },
    {
      title: 'Zara Tailored Structured Blazer in Sand',
      slug: 'zara-tailored-structured-blazer-sand',
      description: 'Single-breasted structured blazer with pronounced lapels, buttoned cuffs, and flap pockets. Crafted from an elegant viscose-blend weave.',
      bulletPoints: ['Structured shoulder definition', 'Notched lapels & single tortoise button', 'Viscose tailored drape', 'Full interior satin lining'],
      categoryId: catMap['womens-collection'],
      brandId: brandMap['zara'],
      basePrice: 4990,
      compareAtPrice: 6990,
      tags: ['blazer', 'formal', 'office', 'womenswear', 'zara'],
      rating: { average: 4.7, count: 180 },
      salesCount: 390,
      isFeatured: false,
      variants: [
        {
          sku: 'ZARA-BLZ-SND-M',
          attributes: { color: 'Sand', size: 'M' },
          price: 4990,
          compareAtPrice: 6990,
          stock: 20,
          images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80', isPrimary: true }],
        },
      ],
    },

    // Watches & Accessories (6 items)
    {
      title: 'Apple Watch Series 9 (GPS, 45mm Midnight Aluminum)',
      slug: 'apple-watch-series-9-45mm',
      description: 'Smarter, brighter, and mightier. Double Tap gesture control, precision finding for iPhone, and an ultra-bright Always-On display.',
      bulletPoints: ['Apple S9 SiP with 4-core Neural Engine', 'Double Tap gesture without touching screen', '2000 nits edge-to-edge OLED display', 'Blood oxygen and ECG apps'],
      categoryId: catMap['accessories'],
      brandId: brandMap['apple'],
      basePrice: 41900,
      compareAtPrice: 44900,
      tags: ['watch', 'smartwatch', 'apple', 'fitness', 'accessories'],
      rating: { average: 4.9, count: 480 },
      salesCount: 1350,
      isFeatured: true,
      variants: [
        {
          sku: 'APP-W9-MID-45',
          attributes: { color: 'Midnight', size: '45mm' },
          price: 41900,
          compareAtPrice: 44900,
          stock: 45,
          images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80', isPrimary: true }],
        },
      ],
    },

    // Home & Workspace (6 items)
    {
      title: 'Ergonomic Premium Solid Walnut Desk Shelf Organiser',
      slug: 'solid-walnut-desk-shelf-organiser',
      description: 'Elevate your workspace aesthetics and posture. Handcrafted from sustainably harvested American walnut with matte anodised aluminum legs.',
      bulletPoints: ['Solid natural American walnut hardwood', 'Ergonomically elevates monitor by 11cm', 'Cushioned cork desk protectors', 'Houses full-size keyboards underneath'],
      categoryId: catMap['home-workspace'],
      brandId: brandMap['sony'], // general brand
      basePrice: 6499,
      compareAtPrice: 8999,
      tags: ['workspace', 'desk', 'walnut', 'ergonomic', 'home'],
      rating: { average: 4.8, count: 120 },
      salesCount: 310,
      isFeatured: false,
      variants: [
        {
          sku: 'DESK-SHLF-WLN',
          attributes: { material: 'Solid Walnut' },
          price: 6499,
          compareAtPrice: 8999,
          stock: 24,
          images: [{ url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80', isPrimary: true }],
        },
      ],
    },
  ];

  // Dynamically generate remaining products up to 52 to ensure full catalog depth
  const productTemplates = [
    { cat: 'electronics', brand: 'samsung', prefix: 'Samsung Galaxy Buds Pro', price: 9990, tags: ['audio', 'earbuds', 'wireless'] },
    { cat: 'electronics', brand: 'sony', prefix: 'Sony SRS-XB100 Portable Wireless Speaker', price: 4490, tags: ['speaker', 'audio', 'portable'] },
    { cat: 'electronics', brand: 'apple', prefix: 'Apple 20W USB-C Power Adapter & Cable', price: 1900, tags: ['charger', 'accessories'] },
    { cat: 'electronics', brand: 'samsung', prefix: 'Samsung T7 Shield 1TB Portable SSD', price: 8999, tags: ['storage', 'ssd', 'gadgets'] },
    { cat: 'footwear', brand: 'nike', prefix: 'Nike Revolution 6 Next Nature Running Shoes', price: 3695, tags: ['running', 'shoes', 'nike'] },
    { cat: 'footwear', brand: 'nike', prefix: 'Nike Court Vision Low Casual Sneakers', price: 4995, tags: ['sneakers', 'nike', 'casual'] },
    { cat: 'footwear', brand: 'nike', prefix: 'Nike Metcon 9 Workout Cross-Trainers', price: 11995, tags: ['gym', 'crossfit', 'fitness'] },
    { cat: 'footwear', brand: 'nike', prefix: 'Nike Victori One Sport Slide Slippers', price: 1995, tags: ['slides', 'comfort', 'footwear'] },
    { cat: 'mens-apparel', brand: 'levis', prefix: "Levi's Classic Trucker Denim Jacket", price: 4999, tags: ['jacket', 'denim', 'levis', 'winter'] },
    { cat: 'mens-apparel', brand: 'levis', prefix: "Levi's Graphic Set-In Crewneck Cotton T-Shirt", price: 1199, tags: ['tshirt', 'cotton', 'casual'] },
    { cat: 'mens-apparel', brand: 'zara', prefix: "Zara Textured Striped Resort Polo Shirt", price: 2290, tags: ['polo', 'summer', 'menswear'] },
    { cat: 'mens-apparel', brand: 'zara', prefix: "Zara Stretch Cargo Trousers with Drawstring", price: 3290, tags: ['cargo', 'trousers', 'streetwear'] },
    { cat: 'womens-collection', brand: 'zara', prefix: 'Zara Poplin Midi Shirt Dress with Belt', price: 3990, tags: ['dress', 'cotton', 'summer'] },
    { cat: 'womens-collection', brand: 'zara', prefix: 'Zara Ribbed Knit Sleeveless Halter Top', price: 1490, tags: ['knitwear', 'top', 'casual'] },
    { cat: 'womens-collection', brand: 'levis', prefix: "Levi's 721 High Rise Skinny Jeans", price: 3199, tags: ['denim', 'jeans', 'levis'] },
    { cat: 'womens-collection', brand: 'zara', prefix: 'Zara Wide Leg Flowing Palazzo Pants', price: 2990, tags: ['palazzo', 'summer', 'trousers'] },
    { cat: 'accessories', brand: 'nike', prefix: 'Nike Sport Water Bottle with Leakproof Spout', price: 899, tags: ['bottle', 'fitness', 'nike'] },
    { cat: 'accessories', brand: 'apple', prefix: 'Apple FineWoven Wallet with MagSafe', price: 5900, tags: ['wallet', 'apple', 'magsafe'] },
    { cat: 'home-workspace', brand: 'sony', prefix: 'Minimalist Matte Aluminum Laptop Stand', price: 1899, tags: ['stand', 'desk', 'ergonomic'] },
    { cat: 'home-workspace', brand: 'sony', prefix: 'Full Desk Felt Merino Wool Keyboard Mat', price: 1299, tags: ['deskmat', 'workspace', 'home'] },
  ];

  const generatedProductImages: Record<string, string[]> = {
    electronics: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=85',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=85',
      'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&q=85',
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=85',
    ],
    footwear: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=85',
      'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=85',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=85',
    ],
    'mens-apparel': [
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=85',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=85',
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=85',
    ],
    'womens-collection': [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=85',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=85',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=85',
    ],
    accessories: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=85',
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=85',
    ],
    'home-workspace': [
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=85',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=85',
    ],
  };

  let counter = 1;
  while (seedProducts.length < 52) {
    const tmpl = productTemplates[(counter - 1) % productTemplates.length];
    const imageSet = generatedProductImages[tmpl.cat] || generatedProductImages.electronics;
    const imageUrl = tmpl.tags.some((tag) => tag === 'jeans' || tag === 'denim')
      ? 'https://images.unsplash.com/photo-1475178626620-a4d074967452?w=800&q=85'
      : imageSet[(counter - 1) % imageSet.length];
    const itemNum = Math.floor(counter / productTemplates.length) + 1;
    const title = `${tmpl.prefix} (Edition ${itemNum})`;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    seedProducts.push({
      title,
      slug,
      description: `Premium quality ${tmpl.prefix.toLowerCase()} engineered with meticulous attention to detail. Designed for long-lasting comfort and high durability.`,
      bulletPoints: ['Engineered with premium materials', 'Enhanced durability and modern aesthetics', 'Backed by official brand manufacturer warranty', 'Complimentary fast express delivery'],
      categoryId: catMap[tmpl.cat],
      brandId: brandMap[tmpl.brand],
      basePrice: tmpl.price,
      compareAtPrice: Math.round(tmpl.price * 1.25),
      tags: [...tmpl.tags, 'popular', 'new-arrival'],
      rating: { average: Number((4.2 + (counter % 8) * 0.1).toFixed(1)), count: 40 + counter * 7 },
      salesCount: 150 + counter * 25,
      isFeatured: counter % 5 === 0,
      variants: [
        {
          sku: `SKU-${tmpl.brand.toUpperCase()}-${counter}-STD`,
          attributes: { variant: 'Standard' },
          price: tmpl.price,
          compareAtPrice: Math.round(tmpl.price * 1.25),
          stock: 25 + (counter % 30),
          images: [
            {
              url: imageUrl,
              isPrimary: true,
            },
          ],
        },
      ],
    });
    counter++;
  }

  await Product.insertMany(seedProducts);
  console.log(`✅ Seeded ${seedProducts.length} high-fidelity e-commerce products with variants & inventory!`);

  console.log('🎉 Seed completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Error during database seed:', err);
  process.exit(1);
});
