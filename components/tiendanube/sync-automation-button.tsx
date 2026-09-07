"use client";

import { useState } from "react";

export function SyncAutomationButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensure() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/tiendanube/webhooks/ensure", { method: "POST", headers: { Accept: "application/json" } });
      const text = await response.text();
      const data = JSON.parse(text) as { ok?: boolean; created?: number; skipped?: boolean; reason?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || data.reason || `HTTP ${response.status}`);
      setMessage(data.created ? `Automatización activa. Se crearon ${data.created} webhooks.` : "Automatización activa. Los webhooks ya estaban configurados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la automatización");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={ensure} disabled={loading} className="pt-button-secondary inline-flex items-center px-4 text-sm disabled:opacity-60">
        {loading ? "Revisando..." : "Activar / revisar automatización"}
      </button>
      {message && <div className="rounded-2xl border border-[#cfe8db] bg-[#f5fbf8] p-3 text-sm font-semibold text-[#36785b]">✓ {message}</div>}
      {error && <div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-3 text-sm font-semibold text-[#a94658]">{error}</div>}
    </div>
  );
}
