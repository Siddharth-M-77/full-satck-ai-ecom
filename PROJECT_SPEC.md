# MASTER PROMPT — "ShopSense AI": AI-Powered Full-Stack E-commerce Platform

> Paste this whole file into Antigravity / Cursor / Claude Code / any AI coding agent.
> Keep it in the repo root as `PROJECT_SPEC.md` so the agent can re-read it every session.

---

## 0. How you (the AI agent) must work

1. **Do NOT write code first.** Start with **Phase 0 (Planning)** below and output:
   - final tech stack with one-line reason for each choice
   - folder structure
   - database schema (all collections, fields, indexes)
   - full API route list
   - AI architecture (which model, which tools, how data flows)
   - list of env variables
   - risks / open questions
   Then **STOP and wait for my approval.**
2. Build **one phase at a time**. At the end of every phase:
   - run lint + type-check + tests, fix all failures
   - give me a short summary: what was built, how to run it, how to test it manually
   - **STOP and wait for "next"**
3. Everything must be **production-ready**: TypeScript strict mode, input validation, error handling, logging, no hard-coded secrets, no TODO placeholders, no fake/mock data in production code paths (seed script is fine).
4. Explain every non-obvious decision in code comments or in `docs/DECISIONS.md` — I must be able to explain this project in interviews.
5. Never silently change the stack or skip a feature. If something is unclear, ask.

---

## 1. Product overview

A multi-vendor-ready (single store for v1) e-commerce platform with:
- **Customer storefront** (SEO-friendly)
- **Admin panel** (full store management)
- **Razorpay payments** (test mode for demo)
- **AI features**: semantic search, AI shopping assistant agent, admin AI copilot agent, AI product content generation, review summarisation, recommendations

Target: deployable demo at `shop.devsidd.cloud` + `admin.devsidd.cloud`, public GitHub repo with strong README.

---

## 2. Tech stack (agent may suggest changes in Phase 0, but must justify)

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo (`apps/api`, `apps/web`, `apps/admin`, `packages/shared`) |
| Backend | Node.js 20, Express, **TypeScript**, Zod validation |
| Database | MongoDB Atlas + Mongoose (Atlas **Vector Search** for AI embeddings) |
| Cache / queues | Redis — caching, rate limiting, **BullMQ** background jobs, Socket.IO adapter |
| Storefront | **Next.js 14 (App Router)**, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand (cart) |
| Admin panel | React + Vite, TypeScript, Redux Toolkit, TanStack Query + TanStack Table, Tailwind, shadcn/ui, Recharts |
| Payments | **Razorpay** (Orders API + signature verification + webhooks, refunds) |
| AI | **Vercel AI SDK** (provider-agnostic) with OpenAI / Anthropic / Gemini; embeddings model for vectors |
| Media | Cloudinary (signed uploads) |
| Email | Resend or SendGrid via BullMQ queue |
| Realtime | Socket.IO (order status to customer, new-order alerts to admin) |
| Auth | JWT access token (15 min) + refresh token (httpOnly cookie, rotation), bcrypt, RBAC |
| Testing | Vitest + Supertest (API), Playwright (checkout E2E) |
| Docs | Swagger / OpenAPI at `/api/docs` |
| DevOps | Docker + docker-compose (local), GitHub Actions CI, deploy on VPS with Nginx + PM2 cluster, SSL via Certbot |
| Observability | pino logger, request IDs, `/health` + `/ready` endpoints, error tracking (Sentry optional) |

---

## 3. Core features (non-AI)

### 3.1 Auth & users
- Register, login, logout, refresh-token rotation, email verification, forgot/reset password
- Roles: `customer`, `staff`, `admin` with permission-based RBAC middleware
- Address book (multiple addresses, default address)
- Rate limit login + OTP/reset endpoints (Redis)

### 3.2 Catalog
- Categories (nested, slug-based), brands, tags
- Products with **variants** (size/colour), SKU per variant, price, compare-at price, stock per variant, images (Cloudinary), SEO fields
- Listing with filters (category, price range, brand, rating, in-stock), sorting, cursor/offset pagination
- Product detail page with reviews, ratings, related products
- Redis cache for hot listings + product pages, with proper invalidation on update

### 3.3 Cart, wishlist, coupons
- Guest cart (localStorage) + server cart for logged-in users, **merge on login**
- Wishlist
- Coupons: flat / percentage, min order value, expiry, usage limit per user and global
- Server always recalculates prices — never trust client totals

### 3.4 Checkout & payments (most important — interviewers will dig here)
- Flow: validate cart → **reserve stock** → create internal order (`PENDING_PAYMENT`) → create Razorpay order → client pays → verify signature on server → mark `PAID`
- **Razorpay webhook is the source of truth** (`payment.captured`, `payment.failed`, `refund.processed`); signature-verified, **idempotent** (store processed event IDs)
- **Stock race condition handling**: atomic conditional update (`findOneAndUpdate` with `stock >= qty`) inside a MongoDB transaction; reservation expires via TTL / BullMQ job if payment not completed in 15 min → stock released
- Order state machine: `PENDING_PAYMENT → PAID → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`, `REFUND_REQUESTED`, `REFUNDED`; invalid transitions rejected
- Refunds from admin panel via Razorpay Refund API
- Cash on Delivery option (flag)
- GST-style tax + shipping fee rules (configurable)
- Invoice PDF generation (queue job) + order confirmation email

### 3.5 Orders & notifications
- Customer order history, order detail, cancel before shipping, track status
- Real-time status updates via Socket.IO
- Emails for: signup verify, order placed, shipped, delivered, refund

### 3.6 Reviews
- Only verified buyers can review; one review per product per user
- Admin moderation (approve / hide)

---

## 4. Admin panel

- **Dashboard**: revenue (today/7d/30d), orders count, AOV, top products, low-stock list, sales chart, recent orders — backed by MongoDB aggregation pipelines + Redis cache
- **Products**: CRUD, variants, bulk CSV import/export, image upload, publish/draft
- **Inventory**: stock per variant, low-stock threshold, stock adjustment history (audit)
- **Orders**: filter/search, detail view, status update (state-machine enforced), refund, print invoice
- **Customers**: list, detail, order history, block/unblock
- **Coupons**: CRUD, usage stats
- **Reviews**: moderation queue
- **Staff & roles**: invite staff, assign permissions
- **Audit log**: who changed what and when (every admin write action)
- **Settings**: store info, tax, shipping rules, payment toggles
- Real-time toast + sound on new order (Socket.IO)
- **AI Copilot panel** (see section 5.3)

---

## 5. AI features (this is what makes it a "full-stack AI" project)

### 5.1 Semantic search
- On product create/update, a BullMQ job generates an **embedding** (title + description + category + attributes) and stores it on the product
- Search endpoint combines **Atlas Vector Search** (meaning) + text search (keywords) = **hybrid search**
- Example: "cotton kurta for summer wedding under 2000" returns relevant products even without exact keyword match
- Cache frequent query embeddings in Redis

### 5.2 AI Shopping Assistant (customer-facing agent)
- Chat widget on storefront, **streaming** responses
- Implemented as an **agent with tool calling**. Tools (all Zod-validated, all go through existing service layer — never raw DB access):
  - `searchProducts(query, filters)`
  - `getProductDetails(productId)`
  - `checkStock(productId, variant)`
  - `addToCart(productId, variant, qty)` — only for logged-in user, requires explicit user confirmation in UI
  - `getOrderStatus(orderId)` — only the user's own orders
  - `getApplicableCoupons(cartTotal)`
- Conversation memory per session (Redis, last N messages)
- Guardrails: system prompt limits scope to shopping; refuses unrelated tasks; prompt-injection defence (tool outputs treated as data); per-user rate limit and daily token budget; PII never sent to logs
- Every AI call logged (model, tokens, latency, cost, user) in an `ai_logs` collection

### 5.3 Admin AI Copilot (admin-facing agent)
- Natural-language questions over store data using **predefined safe analytics tools** (no LLM-generated DB queries):
  - `getSalesSummary(range)`, `getTopProducts(range, limit)`, `getLowStock(threshold)`, `getOrdersByStatus(status, range)`, `getCustomerStats(range)`
  - Example: "Last 7 days mein kaunse 5 products sabse zyada bike aur kiska stock khatam hone wala hai?"
- **Product content generator**: from product name + attributes (+ optional image) generate title, description, bullet highlights, SEO meta title/description, tags — admin reviews before saving
- **Restock suggestions**: based on last 30 days sales velocity vs current stock
- **Review summariser**: per product, pros/cons summary + overall sentiment, regenerated by background job when new reviews arrive
- All write actions proposed by AI need admin click-to-confirm (human-in-the-loop)

### 5.4 Recommendations
- "Similar products" using vector similarity
- "Frequently bought together" using order co-occurrence aggregation (non-AI, nightly job)

### 5.5 AI engineering requirements
- Provider abstraction layer so model can be switched via env
- Prompts stored as versioned files in `apps/api/src/ai/prompts/`
- Timeouts, retries with backoff, graceful fallback (e.g., if AI down → normal keyword search)
- Small **eval script** (`pnpm eval:search`, `pnpm eval:assistant`) with ~20 test queries to check quality before deploy
- AI usage dashboard in admin (tokens + cost per day)

---

## 6. Data models (agent must finalise in Phase 0)

`User`, `Address`, `Category`, `Brand`, `Product` (with embedded `variants[]` + `embedding`), `InventoryLog`, `Cart`, `Wishlist`, `Coupon`, `CouponUsage`, `Order` (items snapshot, pricing breakdown, status history), `Payment` (Razorpay IDs, status, raw webhook refs), `WebhookEvent` (idempotency), `StockReservation` (TTL index), `Review`, `ReviewSummary`, `AuditLog`, `AiLog`, `ChatSession`, `Setting`

Required: proper indexes (compound, text, TTL, unique), `timestamps`, soft delete where needed.

---

## 7. Security & quality checklist

- helmet, CORS whitelist, rate limiting, request size limits, mongo-sanitize, XSS-safe rendering
- Zod validation on every route (body, params, query)
- Centralised error handler with typed `AppError`, no stack traces in production responses
- Secrets only via env; `.env.example` committed
- Passwords bcrypt (cost 12); refresh tokens hashed in DB
- Webhook + payment signature verification with constant-time compare
- RBAC on every admin route + audit log
- Unit tests for services (pricing, coupons, stock, order state machine), integration tests for auth/checkout/webhook, one Playwright E2E for full checkout
- ESLint + Prettier + Husky pre-commit
- Lighthouse 90+ on storefront home and product page

---

## 8. Folder structure (suggested)

```
shopsense-ai/
├─ apps/
│  ├─ api/          # Express + TS
│  │  └─ src/{config,modules/{auth,users,catalog,cart,orders,payments,coupons,reviews,admin,ai},jobs,sockets,middlewares,utils}
│  ├─ web/          # Next.js storefront
│  └─ admin/        # React + Vite admin panel
├─ packages/
│  └─ shared/       # shared Zod schemas, types, constants
├─ docker-compose.yml
├─ .github/workflows/ci.yml
├─ docs/{ARCHITECTURE.md,DECISIONS.md,API.md}
└─ PROJECT_SPEC.md  # this file
```

---

## 9. Build phases (STOP after each)

| Phase | Scope | Done when |
|---|---|---|
| 0 | Planning (section 0) | I approve the plan |
| 1 | Monorepo setup, Docker (Mongo + Redis), API skeleton, logger, error handler, health checks, CI | `pnpm dev` runs all apps, CI green |
| 2 | Auth + RBAC + addresses | Tests pass for register/login/refresh/roles |
| 3 | Catalog (categories, products, variants, images, filters, caching) + seed script (50+ realistic products) | Listing + detail APIs work, cache invalidates |
| 4 | Storefront UI: home, listing, product page, cart, wishlist | Guest + logged-in cart merge works |
| 5 | Checkout, stock reservation, Razorpay (test mode), webhook, order state machine, emails, invoice | Full paid order in test mode, concurrent-buy test proves no overselling |
| 6 | Admin panel: dashboard, products, inventory, orders, refunds, customers, coupons, reviews, audit log | All CRUD + refund works |
| 7 | AI: embeddings job, hybrid semantic search, similar products | Eval script shows relevant results |
| 8 | AI Shopping Assistant agent (tools, streaming, guardrails, logging) | Assistant finds products, checks stock, adds to cart with confirmation |
| 9 | Admin AI Copilot (analytics tools, content generator, restock, review summary) + AI usage dashboard | Copilot answers analytics questions correctly |
| 10 | Realtime (Socket.IO), tests hardening, Playwright E2E, Lighthouse, security pass | All checklists in section 7 pass |
| 11 | Deployment (VPS: Nginx + PM2 + SSL, or Docker), README with architecture diagram, screenshots, demo credentials | Live URLs working |

---

## 10. README must include

- Architecture diagram (Mermaid)
- Checkout + payment sequence diagram (Mermaid)
- AI agent flow diagram (user → LLM → tools → services → response)
- Tech stack table, features list, screenshots/GIF, live demo links, demo admin credentials (read-only demo role)
- "Key engineering decisions" section: stock race condition, webhook idempotency, hybrid search, agent guardrails, caching strategy

---

## 11. Start now

Begin with **Phase 0** only. Output the plan, then stop and wait for my approval.