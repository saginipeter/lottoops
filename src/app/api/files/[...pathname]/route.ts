import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pathname: string[] }> },
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { pathname: pathnameParts } = await params;
  const pathname = pathnameParts.join("/");
  const expectedPrefix = `stores/${session.storeId}/`;
  if (!pathname.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const result = await get(pathname, {
    access: "private",
    ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
  });
  if (!result || result.statusCode === 304) {
    if (result?.statusCode === 304) return new NextResponse(null, { status: 304 });
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "Content-Disposition": result.blob.contentDisposition,
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
    },
  });
}
