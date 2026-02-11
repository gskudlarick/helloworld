# Vercel + Next.js vs AWS: When to Use What

## The Mental Model

```
Vercel / Next.js  =  WordPress on steroids (marketing, content, sign-up)
AWS / Containers  =  The real business engine (product, data, logic)
```

## SaaS Architecture Pattern

```
┌──────────────────────────────────────────────────────┐
│              Vercel (Next.js)                         │
│              yourproduct.com                          │
│                                                      │
│   Landing page → Pricing → Blog → Sign up            │
│   Stripe checkout → pick $49 or $99 tier             │
│                         │                            │
│                    "Start using product"              │
└─────────────────────┬────────────────────────────────┘
                      │ redirect
                      ▼
┌──────────────────────────────────────────────────────┐
│              AWS (Terraform-managed)                  │
│              app.yourproduct.com                      │
│                                                      │
│   React dashboard (the actual product)               │
│        │                                             │
│        ▼                                             │
│   Express / Node API (BFF layer)                     │
│        │                                             │
│        ├──> Postgres (business data)                 │
│        ├──> Redis (sessions, cache)                  │
│        ├──> S3 (file uploads)                        │
│        └──> Background workers (jobs, emails)        │
└──────────────────────────────────────────────────────┘
```

## Side-by-Side Comparison

| Aspect | Vercel + Next.js | AWS + Containers |
|--------|-----------------|------------------|
| **Best for** | Marketing, content, SEO, sign-up | Product dashboard, business logic, data |
| **Deploy** | `git push` | `git push` → GitHub Actions → AWS |
| **Scaling** | Automatic (edge CDN) | You control (Fargate, EC2 auto-scale) |
| **Cost (small)** | Free - $20/mo | $8-12/mo (EC2) |
| **Cost (scale)** | Gets expensive (per-invocation) | Predictable (you control infra) |
| **Vendor lock-in** | High (Vercel-specific features) | Low (Docker = portable) |
| **Database** | Need 3rd party (Neon, Supabase) | RDS Postgres (managed, you own it) |
| **Backend logic** | Serverless functions (limited) | Full Express/Node/Python/Java |
| **Real-time** | Difficult | WebSockets, queues, workers |
| **Background jobs** | Not supported | Full control |
| **Customization** | Limited | Unlimited |

## Who Uses What

| Company | Marketing / Public | Product / Backend |
|---------|-------------------|-------------------|
| Netflix | Next.js (careers, marketing) | Separate microservices |
| Walmart | Next.js (storefront) | Separate backend systems |
| Stripe | Next.js (docs, marketing) | Separate API platform |
| Notion | Next.js (landing page) | Separate Kotlin/Node backend |
| Most SaaS startups | Vercel or similar | AWS / GCP / separate backend |

**Pattern**: Big companies use Next.js for the public-facing layer. Core product always has a separate backend.

## BFF (Backend for Frontend) Pattern

```
Without BFF:
  React app → calls 5 different services directly
  (frontend knows too much, tightly coupled)

With BFF:
  React app → Express API (one endpoint) → orchestrates services
  (clean separation, frontend talks to one thing)
```

For our setup, the Express backend IS the BFF. No need for a separate one until you have multiple microservices.

## The Game Plan

### Phase 2 (tomorrow): AWS Foundation
See `1-1-plan-aws-terraform-cicd.md`
- Add Postgres + state data
- Terraform → EC2 + Docker Compose
- GitHub Actions CI/CD
- Public URL to test

### Phase 3 (future): Add Vercel Marketing Layer
- Create a separate Next.js project for the marketing site
- Deploy to Vercel (free tier)
- Connect Stripe for pricing/sign-up
- Redirect authenticated users to the AWS-hosted product

### Phase 4 (future): Scale AWS
- Migrate EC2 → ECS Fargate (auto-scaling)
- Migrate Docker Postgres → RDS (managed, backups)
- Add ALB + HTTPS + custom domain
- Add Redis for sessions/caching

## Cost Projection

| Phase | Setup | Monthly Cost |
|-------|-------|-------------|
| Phase 2 (POC) | EC2 + Docker Compose | ~$8-12/mo |
| Phase 3 (marketing) | + Vercel free tier | ~$8-12/mo |
| Phase 4 (production) | Fargate + RDS + ALB | ~$50-80/mo |
| Scale (1000+ users) | Auto-scaling Fargate + RDS | ~$150-300/mo |

## Key Takeaway

Vercel/Next.js and AWS are not competitors. They solve different problems:

- **Vercel**: Get a beautiful marketing site live in minutes
- **AWS**: Run the actual business with full control

Use both. That's what the best SaaS companies do.
