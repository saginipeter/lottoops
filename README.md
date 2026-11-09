# LottoOps

**Lottery retail operations and inventory management**

LottoOps helps lottery retailers manage scratch-ticket inventory, sales shifts, audits, reports, and customer-facing ticket displays from one store-scoped application.

- **Production application:** [lottoops.vercel.app](https://lottoops.vercel.app)
- **Marketing domain:** `lottoops.com` is registered separately from this application repository. Connect it to the marketing-site hosting project when that site is ready to launch.

## Product areas

### Store operations

- Receive shipments and maintain active and back-stock inventory.
- Manage games, packs, display positions, ticket direction, and artwork.
- Scan tickets and reconcile opening and closing physical audits.
- Open and close shifts, record cash reconciliation, and review ticket returns.

### Customer TV display

- Show up to **50 displays per screen** in a responsive 10-column by 5-row layout.
- Automatically rotate between screens every **30 seconds** when additional screens are needed.
- Show game-specific artwork, ticket price, animated current/next ticket indicators, and a three-digit display label such as **`#040`**.
- Use a signed kiosk link for a customer-facing screen without requiring a staff login.

### Reports

Reports provide store activity, sales, shift, inventory, and audit information. The report workspace supports date filtering; report documents can be previewed, printed, or saved as PDF through the browser’s print dialog.

### Game artwork

The Games area can synchronize game artwork from the Texas Lottery catalog. Authorized staff can replace a game’s artwork and restore its default artwork. Image uploads require Vercel Blob storage configuration.

## Access roles

LottoOps uses store-scoped permissions and the following application roles:

| Role | Typical access |
| --- | --- |
| **Platform Admin** | SaaS-level platform and tenant administration |
| **Owner** | Store oversight and owner-level management |
| **Manager** | Store management and operational controls |
| **Shift Lead** | Shift and scan duties, with any additional permissions explicitly granted |
| **Employee** | Shift opening/closing and live scanning |
| **Auditor** | Read-only reports and documents |

Exact access is enforced by the application’s role and permission checks; this table is a high-level guide.

## Technology

- Next.js App Router, React, and TypeScript
- PostgreSQL with Prisma
- Tailwind CSS
- Vercel deployment and Vercel Blob for uploaded artwork
- Stripe billing integration is optional and must be explicitly configured

## Local development

### Requirements

- Node.js (current LTS recommended)
- pnpm
- A PostgreSQL database

### Setup

```bash
git clone https://github.com/saginipeter/lottoops.git
cd lottoops
pnpm install
cp .env.example .env.local
```

Set the required local values in `.env.local`:

- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — a long, random secret used to sign sessions.

Set `BLOB_READ_WRITE_TOKEN` if you need to test artwork uploads locally; it is required in production for that feature.

Apply pending migrations and start the development server:

```bash
pnpm db:deploy
pnpm dev
```

The local application is then available at `http://localhost:3000`.

### Environment configuration

See [`.env.example`](.env.example) for the supported variable names. Optional integrations include Stripe billing, WhatsApp report delivery, scheduled report email, and setup provisioning. Keep production secrets in the deployment provider’s environment-variable manager—never commit `.env.local`, tokens, passwords, or webhook secrets.

Keep `ALLOW_OFFLINE_AUTH` disabled in production. Keep billing disabled until the correct live Stripe keys, price IDs, and webhook endpoint have been configured and verified. Restrict first-run setup to a controlled provisioning window.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local Next.js development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build locally |
| `pnpm test` | Run the unit test suite |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm lint` | Run ESLint |
| `pnpm db:migrate` | Create/apply migrations during development |
| `pnpm db:deploy` | Apply checked-in migrations to a deployment database |
| `pnpm db:studio` | Open Prisma Studio |

Before a release, run at least:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

Run end-to-end checks against a dedicated test database/environment, not production.

## Deployment notes

LottoOps is deployed on Vercel. Configure environment variables separately for the required deployment environments, verify the PostgreSQL connection and Blob token, and apply pending migrations with `pnpm db:deploy` as part of a controlled release. Do not assume that `pnpm build` applies database migrations.

The LottoOps app and public marketing website can use separate subdomains of the same registered domain—for example, `app.lottoops.com` for the application and `lottoops.com` for the marketing site. A subdomain does not require buying another domain; configure its DNS records at the domain registrar and add it to the appropriate Vercel project.

## Repository layout

```text
src/app/       Next.js pages, layouts, and API routes
src/components Shared and feature-specific UI
src/lib/       Application services, permissions, and utilities
prisma/        Database schema, migrations, and development seed
public/        Small static assets
```
