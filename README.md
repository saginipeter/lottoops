#  LottoOps

**Scratch-Off Lottery Display & Inventory Management System**

---

## Overview

LottoOps is a web-based application designed for convenience stores, gas stations, and retail businesses to manage scratch-off lottery tickets digitally. The system replaces manual tracking with a digital display board, inventory tracking, slot management, and shift closeout tools.

---

##  How LottoOps Works

LottoOps has two main parts: an **Admin Dashboard** for store staff and a **TV Display Board** for customers. Here is the end-to-end workflow:

1. **Receive Inventory** – Staff receives new packs from the supplier. The system checks for duplicate serial numbers and saves the pack as Back Stock.

2. **Activate to Display** – Manager selects an empty or sold-out (000) display slot, chooses a Back Stock pack, enters the starting ticket number, and activates it. The pack status changes to Active.

3. **TV Display Board** – Customers see all active tickets on a TV screen with game numbers, prices, remaining tickets, and sold-out badges. The board auto-refreshes every 15 seconds.

4. **Open Shift** – Staff opens a shift at the start of the day. The system automatically creates shift lines for all active displays, pulling current ticket numbers as beginning tickets.

5. **Close Shift** – At closing time, staff enters ending ticket numbers. The system automatically calculates tickets sold and sales amount. If Ending Ticket = 000, the pack is marked Sold Out.

6. **Reports** – Managers can view daily summaries, scan logs, and activity history to track sales and inventory movement.

---

##  Key Features

| Feature | Description |
| :--- | :--- |
|  **TV Display Board** | Customer-facing screen showing available tickets with auto-refresh |
|  **Inventory Management** | Receive packs, track back stock, activate to displays |
|  **Shift Reconciliation** | Open/close shifts with automatic ticket and sales calculations |
|  **Reporting** | Daily summaries, sales tracking, activity logs |
|  **Role-Based Access** | Manager, Clerk, and Viewer permissions |
|  **Sold-Out Logic** | Supports 000 as valid sold-out value |
|  **Profit Tracking** | Track pack cost, retail value, and potential profit per pack |
|  **Audit Trail** | Every action logged in Scan Log for accountability |

### Report preview and printing

Use the separate **View Report** and **Print Report** actions on a report or
individual shift/shipment. View opens an isolated document preview; Print sends
the same data-only document to the browser's print dialog, where it can also be
saved as PDF. Dashboard navigation, filters, and action controls are not included.
Print templates use A4 by default and support an 80 mm receipt layout.

Receiving records are available after confirmation and from each shipment in the
Reports archive. Supplier information entered during receiving is retained for
these documents. Historical or unsupported values, including untracked payment
methods, returns, and voids, are labeled **Not recorded**, not assumed to be zero.
Deploy the shipment supplier/details migration with `npm run db:deploy` before
running this version against an existing database.

---

##  Tech Stack

### Owner-approved store assistance

Platform admins request store assistance from **Store Access Controls**. Delivery is
**in-app only**: the actual store owner opens **Support** (`/support`), reviews the
requesting admin, and explicitly approves and generates a single-use link. There
is no email delivery. The owner must copy and share that link directly with the
requesting admin; it is displayed once and cannot be retrieved by admins.

The link expires after **15 minutes** and can only be redeemed by that exact
authenticated requesting admin. Opening the shared link while signed in automatically
redeems it via POST; the paste field in Store Access Controls is a fallback.
Redemption is POST-only and starts a **30-minute**, store-scoped support
session. Only a token hash is stored; URL fragments keep tokens out of request
URLs. Owners can decline requests or revoke access from Support. Suspension,
owner changes, inactive accounts, access/requester-session revocation, and expiration block access.
Requests, approvals, redemptions, and revocations are audited without link tokens.
The existing **Exit support** action restores the admin session.

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React with TypeScript |
| **Framework** | Next.js |
| **Backend** | Node.js with Express |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Authentication** | JWT (JSON Web Tokens) |


---
##  Progress
https://lottoops.vercel.app/

Dev credentials 

ManagerLogins
manager@lottoops.test
Clerk
clerk@lottoops.test
Viewer
viewer@lottoops.test
Password (all)
password123
