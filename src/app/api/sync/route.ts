import { NextResponse } from "next/server";
import { syncIndex, getIndexStats } from "@/lib/search-db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const syncResult = syncIndex();
    const stats = getIndexStats();

    return NextResponse.json({
      sync: syncResult,
      stats,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
