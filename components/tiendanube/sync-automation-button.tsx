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
      <button type="button" onClick={ensure} disabled={loading} className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60">
        {loading ? "Activando..." : "Activar / revisar sincronización automática"}
      </button>
      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">✓ {message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    </div>
  );
}
