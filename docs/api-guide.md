# 🔌 Frontend Integration & REST API Guide (`all-in-one-v2-api`)

Comprehensive reference documentation for frontend engineers (`mapanytime-market-web`, `mapanytime-market-app`) building UI components, forms, storefronts, and seller management portals.

---

## 1. Quick Navigation for Frontend Engineers

| Feature / UI View        | Component                                    | Required Endpoints                                                                                                 | Key Function                                                              |
| :----------------------- | :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **Auth Modals**          | Login / Signup Dialogs, Navbar Logout        | `POST /api/v2/auth/login`<br>`POST /api/v2/auth/register`<br>`POST /api/v2/auth/refresh-token`                     | Authenticate user, obtain & rotate JWT bearer tokens                      |
| **User Profile**         | User Menu, Account Settings Page             | `GET /api/v2/users/me`                                                                                             | Fetch active user credentials, email, & roles                             |
| **Supplier Sourcing**    | Seller Import Page (`/seller/ai-upload`)     | `GET /api/v2/product-search`<br>`POST /api/v2/products/import`                                                     | Search external supplier catalogs (CJ/AliExpress) & import to local store |
| **Store Taxonomy**       | Top Navbar, Category Drawer                  | `GET /api/v2/categories`<br>`GET /api/v2/categories/:slug`                                                         | Render category trees and product listing pages                           |
| **Featured Collections** | Homepage Banners, Curated Grids              | `GET /api/v2/collections`<br>`GET /api/v2/collections/slug/:slug`                                                  | Display curated collections & sorted item lists                           |
| **Product Detail**       | Product Page, Variant Selector               | `GET /api/v2/attributes`<br>`GET /api/v2/size-guides/product/:id`                                                  | Fetch product options (Color, Size) & size measurement charts             |
| **Shopping Cart**        | Cart Slide-Over, Cart Page                   | `GET /api/v2/cart`<br>`POST /api/v2/cart/items`<br>`PUT /api/v2/cart/items/:id`<br>`DELETE /api/v2/cart/items/:id` | Manage items in cart (supports guest carts via `x-session-id`)            |
| **Checkout & Orders**    | Checkout Page, Customer Orders List          | `POST /api/v2/orders/checkout`<br>`GET /api/v2/orders/my-orders`<br>`GET /api/v2/orders/:id`                       | Place orders from cart & view customer order history                      |
| **Seller Order Hub**     | Seller Dashboard Table (`/seller/dashboard`) | `PATCH /api/v2/orders/:id/status`<br>`POST /api/v2/products/sync`                                                  | Advance order state (`PREPARING` → `READY_FOR_PICKUP` → `COMPLETED`)      |
| **Payment Drawer**       | Checkout Payment Form                        | `POST /api/v2/payments/intents`                                                                                    | Generate payment gateway intent tokens                                    |
| **Store Content**        | Hero Carousel, Announcement Bar, FAQ         | `GET /api/v2/cms/banners`<br>`GET /api/v2/cms/announcements`<br>`GET /api/v2/cms/faqs`                             | Render dynamic homepage & store announcements                             |
| **Promotions**           | Cart Discount Input                          | `GET /api/v2/promotions/code/:code`                                                                                | Validate coupon code & calculate dynamic cart discount                    |

---

## 2. Request Headers & Client Setup

Configure your HTTP client (Axios, Fetch, or React Query) as follows:

```typescript
// src/shared/lib/http.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v2',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  // 1. Attach JWT Access Token if user is logged in
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 2. Attach Guest Session ID so unauthenticated users can maintain a persistent Cart
  let sessionId = localStorage.getItem('guest_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('guest_session_id', sessionId);
  }
  config.headers['x-session-id'] = sessionId;

  return config;
});
```

---

## 3. Module Endpoint Specifications

---

### 🔑 3.1 Authentication & User Profile (`/api/v2/auth` & `/api/v2/users`)

#### **Register User**

- **Which component uses this:** Signup Modal / Registration Form page.
- **What it does:** Creates a new customer account, hashes password, and returns access token.
- **How to call:**
  ```text
  POST /api/v2/auth/register
  ```
  **Body:**
  ```json
  {
    "email": "customer@example.com",
    "password": "Password123!",
    "username": "johndoe",
    "name": "John Doe"
  }
  ```
  **Success Response (201 Created):**
  ```json
  {
    "message": "User created successfully",
    "data": {
      "user": { "id": "usr_123", "email": "customer@example.com", "username": "johndoe" },
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG..."
    }
  }
  ```

#### **Login User**

- **Which component uses this:** Login Modal / Store Sign-in Form.
- **What it does:** Authenticates user credentials and issues session tokens.
- **How to call:**
  ```text
  POST /api/v2/auth/login
  ```
  **Body:**
  ```json
  {
    "email": "customer@example.com",
    "password": "Password123!"
  }
  ```

#### **Refresh Access Token**

- **Which component uses this:** Axios HTTP response interceptor (on 401 token expiry).
- **What it does:** Obtains a fresh `accessToken` using the valid `refreshToken`.
- **How to call:**
  ```text
  POST /api/v2/auth/refresh-token
  ```
  **Body:** `{ "refreshToken": "eyJhbG..." }`

#### **Get Authenticated User Profile**

- **Which component uses this:** Navbar User Avatar dropdown, Account Profile Page.
- **What it does:** Retrieves details of the logged-in user.
- **How to call:**
  ```text
  GET /api/v2/users/me
  Headers: Authorization: Bearer <accessToken>
  ```

---

### 📦 3.2 Product Search, Sourcing & Import (`/api/v2/product-search` & `/api/v2/products`)

#### **Search External Suppliers**

- **Which component uses this:** Seller AI Import Portal search bar (`/seller/ai-upload`).
- **What it does:** Queries external dropshipping suppliers (CJ Dropshipping, AliExpress) concurrently and returns normalized cached results.
- **How to call:**
  ```text
  GET /api/v2/product-search?q=wireless+headphones&page=1&limit=20
  Headers: Authorization: Bearer <accessToken>
  ```
  **Success Response (200 OK):**
  ```json
  {
    "status": "success",
    "statusCode": 200,
    "message": "Product search completed successfully",
    "data": {
      "items": [
        {
          "externalId": "CJ123456",
          "supplierId": "cj-dropshipping",
          "title": "Wireless Bluetooth Earbuds",
          "costPrice": 12.5,
          "suggestedRetailPrice": 29.99,
          "image": "https://img.cj.com/123.jpg"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 20
    }
  }
  ```

#### **Import Supplier Product**

- **Which component uses this:** "Import to Store" button on Seller Sourcing cards.
- **What it does:** Saves product to local catalog, calculates dynamic retail prices via platform margin rules, and publishes it.
- **How to call:**
  ```text
  POST /api/v2/products/import
  Headers: Authorization: Bearer <accessToken>
  ```
  **Body:**
  ```json
  {
    "supplierId": "cj-dropshipping",
    "externalId": "CJ123456",
    "tenantSlug": "fashion"
  }
  ```

#### **Trigger Supplier Sync Job**

- **Which component uses this:** "Sync Products" action on Seller Product Management Page.
- **What it does:** Enqueues a RabbitMQ worker job to fetch live supplier stock and prices.
- **How to call:**
  ```text
  POST /api/v2/products/sync
  Headers: Authorization: Bearer <accessToken>
  ```

---

### 🏷️ 3.3 Storefront Taxonomy & Categories (`/api/v2/categories`)

#### **List Category Tree**

- **Which component uses this:** Storefront Header Navigation, Category Menu Drawer, Sidebar Filters.
- **What it does:** Returns top-level categories with nested subcategories.
- **How to call:**
  ```text
  GET /api/v2/categories
  ```

#### **Get Category by Slug**

- **Which component uses this:** Category Product Listing Page (`/category/[slug]`).
- **What it does:** Fetches category info, parent category, and display banner metadata.
- **How to call:**
  ```text
  GET /api/v2/categories/electronics
  ```

---

### 🖼️ 3.4 Product Collections (`/api/v2/collections`)

#### **List Active Collections**

- **Which component uses this:** Homepage Curated Sections, Trending Collections Widget.
- **What it does:** Fetches list of active collections (e.g., "Summer Sale", "Best Sellers").
- **How to call:**
  ```text
  GET /api/v2/collections
  ```

#### **Get Collection Details with Items**

- **Which component uses this:** Collection Landing Page (`/collections/[slug]`).
- **What it does:** Returns collection header details and ordered product items.
- **How to call:**
  ```text
  GET /api/v2/collections/slug/summer-sale
  ```

---

### 🎨 3.5 Variant Attributes & Size Guides (`/api/v2/attributes` & `/api/v2/size-guides`)

#### **Get Store Attribute Options**

- **Which component uses this:** Storefront Product Filter Sidebar (Filter by Color, Size, Brand).
- **What it does:** Lists filterable attribute definitions and available values.
- **How to call:**
  ```text
  GET /api/v2/attributes
  ```

#### **Get Product Size Guide**

- **Which component uses this:** "View Size Chart" modal button on Product Detail Page.
- **What it does:** Returns measurement table (Chest, Waist, Length) for clothing items.
- **How to call:**
  ```text
  GET /api/v2/size-guides/product/prod_789
  ```

---

### 🛒 3.6 Shopping Cart (`/api/v2/cart`)

#### **Get Cart**

- **Which component uses this:** Cart Slide-Over Drawer, Cart Counter badge on Header.
- **What it does:** Resolves cart by user JWT or `x-session-id` and returns items, prices, and subtotal.
- **How to call:**
  ```text
  GET /api/v2/cart
  Headers: x-session-id: <uuid> (or Authorization: Bearer <token>)
  ```
  **Success Response (200 OK):**
  ```json
  {
    "status": "success",
    "statusCode": 200,
    "data": {
      "id": "cart_999",
      "items": [
        {
          "id": "item_1",
          "productVariantId": "var_123",
          "quantity": 2,
          "unitPrice": 29.99,
          "product": { "title": "Wireless Headphones", "image": "..." }
        }
      ],
      "subtotal": 59.98
    }
  }
  ```

#### **Add Item to Cart**

- **Which component uses this:** "Add to Cart" button on Product Detail Page & Quick View modals.
- **What it does:** Appends variant to active cart or increments existing quantity.
- **How to call:**
  ```text
  POST /api/v2/cart/items
  Headers: x-session-id: <uuid>
  ```
  **Body:**
  ```json
  {
    "productVariantId": "var_123",
    "quantity": 1
  }
  ```

#### **Update Cart Item Quantity**

- **Which component uses this:** Quantity Stepper (`+` / `-`) on Cart Drawer.
- **How to call:**
  ```text
  PUT /api/v2/cart/items/item_1
  ```
  **Body:** `{ "quantity": 3 }`

#### **Remove Cart Item**

- **Which component uses this:** Trash / Remove icon on Cart Drawer.
- **How to call:**
  ```text
  DELETE /api/v2/cart/items/item_1
  ```

---

### 💳 3.7 Orders & Checkout (`/api/v2/orders`)

#### **Checkout Order**

- **Which component uses this:** "Place Order" button on Checkout Page.
- **What it does:** Converts active cart into a formal order, calculates taxes/shipping, and clears cart.
- **How to call:**
  ```text
  POST /api/v2/orders/checkout
  Headers: x-session-id: <uuid> (or Authorization: Bearer <token>)
  ```
  **Body:**
  ```json
  {
    "shippingAddressId": "addr_456",
    "currency": "PHP"
  }
  ```

#### **Get Customer Orders List**

- **Which component uses this:** "My Orders" tab under Customer Account Portal.
- **What it does:** Returns paginated past order history for the logged-in customer.
- **How to call:**
  ```text
  GET /api/v2/orders/my-orders?page=1&limit=10
  Headers: Authorization: Bearer <token>
  ```

#### **Update Order Fulfillment Status**

- **Which component uses this:** Action Buttons on Seller Merchant Dashboard (`/seller/dashboard`).
- **What it does:** Advances order pipeline state (`PENDING` → `PREPARING` → `READY_FOR_PICKUP` → `COMPLETED`).
- **How to call:**
  ```text
  PATCH /api/v2/orders/ord_1001/status
  Headers: Authorization: Bearer <admin_token>
  ```
  **Body:** `{ "status": "READY_FOR_PICKUP" }`

---

### 💸 3.8 Payments (`/api/v2/payments`)

#### **Create Payment Intent**

- **Which component uses this:** Payment Section on Checkout (Card processing / E-Wallet setup).
- **What it does:** Initializes gateway intent and returns client secret for payment rendering.
- **How to call:**
  ```text
  POST /api/v2/payments/intents
  ```
  **Body:** `{ "orderId": "ord_1001", "provider": "stripe" }`

---

### 🏭 3.9 Multi-Location Inventory (`/api/v2/inventory`)

#### **Get Variant Stock Levels**

- **Which component uses this:** Seller Inventory Table / Stock Level Indicator badge.
- **What it does:** Returns available stock counts across registered warehouses/locations.
- **How to call:**
  ```text
  GET /api/v2/inventory/variant/var_123
  Headers: Authorization: Bearer <token>
  ```

#### **Update Location Stock**

- **Which component uses this:** Stock Quantity adjustment input in Seller Portal.
- **How to call:**
  ```text
  POST /api/v2/inventory/stock
  Headers: Authorization: Bearer <token>
  ```
  **Body:** `{ "variantId": "var_123", "locationId": "loc_01", "quantity": 150 }`

---

### 🎁 3.10 Promotions & Coupons (`/api/v2/promotions`)

#### **Validate Coupon Code**

- **Which component uses this:** "Apply Promo Code" input field on Checkout / Cart page.
- **What it does:** Checks code validity, expiration date, minimum spend requirements, and discount percentage.
- **How to call:**
  ```text
  GET /api/v2/promotions/code/SUMMER2026
  ```

---

### 📰 3.11 CMS Content & Multi-Tenancy (`/api/v2/cms` & `/api/v2/tenants`)

#### **Get Homepage Banners**

- **Which component uses this:** Storefront Hero Carousel Slider.
- **How to call:** `GET /api/v2/cms/banners`

#### **Get Announcement Bar**

- **Which component uses this:** Top Notification Bar above header.
- **How to call:** `GET /api/v2/cms/announcements`

#### **Get Store Tenants / Verticals**

- **Which component uses this:** Vertical Selector Switcher in Header / Multi-storefront navigation.
- **How to call:** `GET /api/v2/tenants`

---

### 📁 3.12 File Uploads (`/api/v2/file-uploads`)

#### **Upload File / Image**

- **Which component uses this:** Product image uploader, Avatar upload input, Banner image picker.
- **What it does:** Uploads image payload and returns file URL metadata.
- **How to call:**
  ```text
  POST /api/v2/file-uploads/upload
  Content-Type: multipart/form-data
  ```
  **FormData:** `file: <binary_file_data>`

---

### 📦 3.13 Dropshipping & Supplier Integration (`/api/v2/suppliers` & `/api/v2/products`)

#### **Get Available Supplier Partners**

- **Which component uses this:** Dropshipping Supplier Dropdown filter in Admin Portal.
- **What it does:** Returns list of active registered suppliers (`cj-dropshipping`, `printful`, `aliexpress`).
- **How to call:** `GET /api/v2/suppliers/available`

#### **Search Live Supplier Catalog**

- **Which component uses this:** Supplier Search & Discovery Catalog Grid in Admin Dashboard.
- **What it does:** Live search across external supplier API without exposing API keys on client.
- **How to call:** `GET /api/v2/suppliers/cj-dropshipping/search?q=running+shoes`

#### **Get Supplier Product Details**

- **Which component uses this:** Supplier Product Preview Modal / Detail Drawer.
- **What it does:** Fetches complete external product details including variants, pricing, and images.
- **How to call:** `GET /api/v2/suppliers/cj-dropshipping/products/CJ123456789`

#### **Import Supplier Product to Store Catalog**

- **Which component uses this:** "Import to Store" Button on Supplier Catalog Card.
- **What it does:** Fetches full supplier product data, normalizes attributes, and creates/upserts into target tenant catalog.
- **How to call:**
  ```text
  POST /api/v2/products/import
  Headers: Authorization: Bearer <admin_token>
  ```
  **Body:**
  ```json
  {
    "supplierId": "cj-dropshipping",
    "externalId": "CJ123456789",
    "tenantSlug": "fashion"
  }
  ```

---

## 4. Error Code Troubleshooting Matrix

| HTTP Status        | Primary Cause                                       | How Frontend Should Handle                                             |
| :----------------- | :-------------------------------------------------- | :--------------------------------------------------------------------- |
| `400 Bad Request`  | Missing query param or validation error             | Display inline field error message on form                             |
| `401 Unauthorized` | Expired or missing Bearer token                     | Trigger `refreshToken` endpoint or redirect user to Login modal        |
| `403 Forbidden`    | User lacks `ADMIN` permission                       | Show permission alert or hide admin-only buttons                       |
| `404 Not Found`    | Target resource or item ID missing                  | Render 404 Empty State component                                       |
| `409 Conflict`     | Duplicate resource (e.g., email already registered) | Highlight conflicting field with red helper text                       |
| `500 Server Error` | Backend server or database failure                  | Render fallback error alert ("Something went wrong, please try again") |
