"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { lamportsToSol } from "@/lib/units";

export interface RevenuePoint {
  periodStart: number;
  revenue: number; // lamports
}

export function RevenueBars({ data }: { data: RevenuePoint[] }) {
  const rows = data.map((d) => ({
    label: new Date(d.periodStart * 1000).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" }),
    sol: Number(lamportsToSol(d.revenue).toFixed(4)),
  }));
  if (rows.length === 0) {
    return (
      <div className="font-mono text-xs text-muted italic px-2 py-6 border border-dashed border-ink">
        no settled periods yet — revenue history populates after first settle
      </div>
    );
  }
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#D9D4C7" strokeDasharray="2 3" />
          <XAxis dataKey="label" tick={{ fill: "#0B0B0B", fontFamily: "var(--font-mono)", fontSize: 10 }} stroke="#0B0B0B" />
          <YAxis tick={{ fill: "#0B0B0B", fontFamily: "var(--font-mono)", fontSize: 10 }} stroke="#0B0B0B" />
          <Tooltip
            contentStyle={{ background: "#F4F1EA", border: "1px solid #0B0B0B", borderRadius: 0, fontFamily: "var(--font-mono)", fontSize: 11 }}
            formatter={(v) => [`${v} SOL`, "period"]}
          />
          <Bar dataKey="sol" fill="#0B0B0B" stroke="#0B0B0B" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
