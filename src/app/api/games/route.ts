import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

  try {
    const games = await prisma.game.findMany({
      where: {
        storeId: session.storeId,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { gameNumber: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serialized = games.map((g: any) => ({
      ...g,
      price: Number(g.price),
    }));

    return NextResponse.json({ games: serialized });
  } catch (err) {
    console.error("[GET /api/games]", err);
    return NextResponse.json(
      { error: "Failed to load games" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "You don't have permission to create games." },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const { gameNumber, name, price, ticketsPerPack, active } = await req.json();

    const normalizedGameNumber = String(gameNumber ?? "").trim();
    const normalizedName = String(name ?? "").trim();
    const normalizedPrice = Number(price);
    const normalizedTicketsPerPack = Number(ticketsPerPack);

    if (!normalizedGameNumber) {
      return NextResponse.json({ error: "Game number is required." }, { status: 400 });
    }
    if (!normalizedName) {
      return NextResponse.json({ error: "Game name is required." }, { status: 400 });
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return NextResponse.json({ error: "Price must be greater than 0." }, { status: 400 });
    }
    if (!Number.isInteger(normalizedTicketsPerPack) || normalizedTicketsPerPack <= 0) {
      return NextResponse.json(
        { error: "Tickets per pack must be a whole number greater than 0." },
        { status: 400 }
      );
    }

    const created = await prisma.game.create({
      data: {
        storeId: session.storeId,
        gameNumber: normalizedGameNumber,
        name: normalizedName,
        price: normalizedPrice,
        ticketsPerPack: normalizedTicketsPerPack,
        active: active !== false,
      },
    });

    return NextResponse.json({
      success: true,
      game: {
        ...created,
        price: Number(created.price),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A game with this game number already exists." },
        { status: 409 }
      );
    }
    console.error("[POST /api/games]", err);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "You don't have permission to update games." },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const { id, gameNumber, name, price, ticketsPerPack, active } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Game id is required." }, { status: 400 });
    }

    const existing = await prisma.game.findUnique({
      where: { id: String(id) },
      select: { id: true, storeId: true },
    });
    if (!existing || existing.storeId !== session.storeId) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    const data: {
      gameNumber?: string;
      name?: string;
      price?: number;
      ticketsPerPack?: number;
      active?: boolean;
    } = {};

    if (gameNumber !== undefined) {
      const normalized = String(gameNumber).trim();
      if (!normalized) {
        return NextResponse.json({ error: "Game number cannot be empty." }, { status: 400 });
      }
      data.gameNumber = normalized;
    }
    if (name !== undefined) {
      const normalized = String(name).trim();
      if (!normalized) {
        return NextResponse.json({ error: "Game name cannot be empty." }, { status: 400 });
      }
      data.name = normalized;
    }
    if (price !== undefined) {
      const normalized = Number(price);
      if (!Number.isFinite(normalized) || normalized <= 0) {
        return NextResponse.json({ error: "Price must be greater than 0." }, { status: 400 });
      }
      data.price = normalized;
    }
    if (ticketsPerPack !== undefined) {
      const normalized = Number(ticketsPerPack);
      if (!Number.isInteger(normalized) || normalized <= 0) {
        return NextResponse.json(
          { error: "Tickets per pack must be a whole number greater than 0." },
          { status: 400 }
        );
      }
      data.ticketsPerPack = normalized;
    }
    if (active !== undefined) {
      data.active = Boolean(active);
    }

    const updated = await prisma.game.update({
      where: { id: String(id) },
      data,
    });

    return NextResponse.json({
      success: true,
      game: {
        ...updated,
        price: Number(updated.price),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A game with this game number already exists." },
        { status: 409 }
      );
    }
    console.error("[PATCH /api/games]", err);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }
}
