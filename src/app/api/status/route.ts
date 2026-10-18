import { NextResponse } from "next/server";
import { gemmaStatus } from "@/lib/gemma";

export async function GET() {
  const gemma = gemmaStatus();
  return NextResponse.json({
    gemma,
    routing: process.env.ORS_API_KEY ? "openrouteservice" : "OpenStreetMap walking (Valhalla)",
    idCheck: gemma.provider !== "none",
  });
}
