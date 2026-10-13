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

### Report preview and printing

Use **View Report** to preview a data-only document or **Print Report** to print it directly. A4 documents are rendered in isolated frames, without dashboard navigation, filters, or action buttons; browser printing also supports saving as PDF. Shipment archive rows provide these actions for individual receiving transactions.

Shift documents include ticket positions, sales, physical audit variance, and recorded drawer reconciliation. Payment-method splits and shift-specific returns/voids are currently not recorded, so documents explicitly mark those fields rather than inventing totals.

Receiving documents include invoice/confirmation numbers, optional supplier details, the saved receiver, confirmation timestamp, and pack line items. Deploy the shipment supplier migration with `npm run db:deploy` before using the updated receiving workflow; older records without supplier details show “Not recorded.”

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

---

##  Tech Stack

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
