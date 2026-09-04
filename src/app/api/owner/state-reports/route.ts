import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createWorker } from "tesseract.js";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const REPORT_TYPES = ["SETTLED_PACK", "ACTIVATED", "INVENTORY"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS state_lottery_reports (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL,
      week_start DATE NOT NULL,
      file_name TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      uploaded_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      content TEXT NOT NULL,
      UNIQUE(store_id, report_type, week_start)
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS mime_type TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS ocr_text TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'PENDING'`);
  schemaReady = true;
}

function reportingMonday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function isReportType(value: string): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

function canViewReports(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canViewReports(session.role)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    await ensureSchema();
    const stores = await prisma.store.findMany({
      where: session.role === "OWNER"
        ? {
            OR: [
              { ownerUserId: session.userId },
              { users: { some: { id: session.userId, role: "OWNER", active: true } } },
            ],
          }
        : { id: session.storeId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const storeIds = stores.map((store: { id: string; name: string }) => store.id);
    const reports = storeIds.length === 0 ? [] : await prisma.$queryRawUnsafe(
      `
            SELECT id, store_id AS "storeId", report_type AS "reportType", week_start AS "weekStart",
              file_name AS "fileName", row_count AS "rowCount", uploaded_at AS "uploadedAt",
              image_url AS "imageUrl", verification_status AS "verificationStatus"
      FROM state_lottery_reports
      WHERE store_id = ANY($1::text[]) AND week_start = $2::date
      ORDER BY uploaded_at DESC
      `,
      storeIds,
      reportingMonday()
    );
    return NextResponse.json({ stores, weekStart: reportingMonday(), reports, canUpload: session.role === "MANAGER" });
  } catch (error) {
    console.error("[GET /api/owner/state-reports]", error);
    return NextResponse.json({ error: "Unable to load state reports." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Only managers can upload state reports." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const form = await req.formData();
  const storeId = String(form.get("storeId") ?? "").trim();
  const reportType = String(form.get("reportType") ?? "").trim();
  const file = form.get("file");
  if (!storeId || !isReportType(reportType) || !(file instanceof File)) {
    return NextResponse.json({ error: "Store, report type, and CSV file are required." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Upload a CSV file or receipt photo." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const store = await prisma.store.findFirst({ where: { id: storeId, ownerUserId: session.userId }, select: { id: true } });
    const managerStore = session.role === "MANAGER" && storeId === session.storeId;
    if (!store && !managerStore) return NextResponse.json({ error: "Store is not available for this account." }, { status: 404 });
    const isPhoto = file.type.startsWith("image/");
    const content = isPhoto ? "" : await file.text();
    const rows = isPhoto ? 0 : content.split(/\r?\n/).filter((line) => line.trim()).length;
    if (!isPhoto && rows < 2) return NextResponse.json({ error: "The CSV must include a header and at least one report row." }, { status: 400 });

    const imageUrl = isPhoto
      ? (await put(`stores/${storeId}/${reportingMonday().slice(0, 4)}/${reportingMonday()}/${reportType.toLowerCase()}/${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: true })).url
      : null;
    let ocrText: string | null = null;
    let verificationStatus = isPhoto ? "OCR_PENDING" : "PENDING";
    if (isPhoto) {
      try {
        const worker = await createWorker("eng");
        const result = await worker.recognize(Buffer.from(await file.arrayBuffer()));
        ocrText = result.data.text.trim() || null;
        verificationStatus = ocrText ? "OCR_COMPLETE" : "OCR_EMPTY";
        await worker.terminate();
      } catch (error) {
        console.error("State report OCR failed:", error);
        verificationStatus = "OCR_FAILED";
      }
    }

    const id = `slr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO state_lottery_reports
        (id, store_id, report_type, week_start, file_name, row_count, uploaded_by_id, content, image_url, mime_type, ocr_text, verification_status)
      VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (store_id, report_type, week_start)
      DO UPDATE SET file_name = EXCLUDED.file_name, row_count = EXCLUDED.row_count,
                    uploaded_by_id = EXCLUDED.uploaded_by_id, uploaded_at = NOW(), content = EXCLUDED.content,
                    image_url = EXCLUDED.image_url, mime_type = EXCLUDED.mime_type
                    , ocr_text = EXCLUDED.ocr_text, verification_status = EXCLUDED.verification_status
      `,
      id,
      storeId,
      reportType,
      reportingMonday(),
      file.name,
      rows - 1,
      session.userId,
      content,
      imageUrl,
      file.type || null,
      ocrText,
      verificationStatus
    );
    return NextResponse.json({ success: true, reportType, storeId, rowCount: isPhoto ? 0 : rows - 1, imageUrl });
  } catch (error) {
    console.error("[POST /api/owner/state-reports]", error);
    return NextResponse.json({ error: "Unable to save state report." }, { status: 500 });
  }
}
