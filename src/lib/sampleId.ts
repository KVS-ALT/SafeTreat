"use client";

/**
 * Draws a generic "SAMPLE PHOTO ID" card for demos (only offered when ID_CHECK_ALLOW_SAMPLES=true).
 * Deliberately plain and clearly marked SAMPLE — no government branding, never a usable document.
 */
export async function drawSampleId(name: string, address: string): Promise<File> {
  const c = document.createElement("canvas");
  c.width = 1000;
  c.height = 630;
  const g = c.getContext("2d")!;
  g.fillStyle = "#eef3f7";
  g.fillRect(0, 0, 1000, 630);
  g.fillStyle = "#5b6b7b";
  g.fillRect(0, 0, 1000, 90);
  g.fillStyle = "#fff";
  g.font = "bold 44px Arial";
  g.fillText("SAMPLE PHOTO ID", 40, 60);
  g.font = "bold 24px Arial";
  g.fillText("FOR SOFTWARE TESTING ONLY - NOT VALID", 480, 58);
  g.fillStyle = "#c9d3dc";
  g.fillRect(40, 130, 260, 330);
  g.fillStyle = "#7d8b99";
  g.font = "28px Arial";
  g.fillText("PHOTO", 120, 300);

  // "Maria Elena Garcia" → "GARCIA, MARIA ELENA"; "65 Archdekin Dr, Brampton, ON" → two lines.
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const printed = (last ? `${last}, ${parts.join(" ")}` : parts.join(" ")).toUpperCase();
  const [street, ...rest] = address.split(",").map((s) => s.trim());
  const expiry = `${new Date().getFullYear() + 4}/04/15`;
  const rows: [string, string][] = [["NAME / NOM", printed], ["ADDRESS / ADRESSE", street.toUpperCase()], ["", rest.join(" ").toUpperCase()], ["EXPIRES / EXP", expiry]];
  let y = 160;
  for (const [label, value] of rows) {
    if (label) {
      g.font = "22px Arial";
      g.fillStyle = "#5b6b7b";
      g.fillText(label, 340, y);
      y += 38;
    }
    g.font = "bold 34px Arial";
    g.fillStyle = "#1d2733";
    g.fillText(value.slice(0, 32), 340, y);
    y += 52;
  }
  g.save();
  g.translate(560, 470);
  g.rotate(-0.18);
  g.fillStyle = "rgba(200,30,30,0.55)";
  g.font = "bold 90px Arial";
  g.fillText("SAMPLE", -200, 40);
  g.restore();
  const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/png"));
  return new File([blob], "safetreat-sample-id.png", { type: "image/png" });
}
