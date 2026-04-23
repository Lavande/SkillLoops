import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = path.join(process.cwd(), "public", "reflection-skill", "SKILL.md");
  const text = fs.readFileSync(p, "utf8");
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="slp-reflection-SKILL.md"',
    },
  });
}
