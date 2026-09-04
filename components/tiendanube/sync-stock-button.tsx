"use client";

import { useState } from "react";

type SyncStockResult = {
  ok?: boolean;
  error?: string;
  products?: number;
  variants?: number;
  batches?: number;
  updatedVariants?: number;
  skipped?: number;
  cacheUpdated?: number;
  failedBatches?: number;

  skippedDetails?: Array<{
    variantId: string;
    reason: string;
  }>;

  errors?: Array<{
    batch: number;
    status: number;
    detail: string;
  }>;
};

export function SyncStockButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncStockResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncStock() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/tiendanube/sync-stock",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const text = await response.text();

      let data: SyncStockResult;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Respuesta inválida del servidor. HTTP ${response.status}`
        );
      }

      setResult(data);

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error || `Error HTTP ${response.status}`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar el stock"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={syncStock}
        disabled={loading}
        className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Sincronizando stock..."
          : "Sincronizar stock"}
      </button>

      {result?.ok && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <div className="font-semibold">
            ✓ Stock sincronizado
          </div>

          <div className="mt-2 space-y-1">
            <div>
              Productos: <strong>{result.products ?? 0}</strong>
            </div>

            <div>
              Variantes calculadas:{" "}
              <strong>{result.variants ?? 0}</strong>
            </div>

            <div>
              Variantes actualizadas:{" "}
              <strong>{result.updatedVariants ?? 0}</strong>
            </div>

            <div>
              Lotes enviados:{" "}
              <strong>{result.batches ?? 0}</strong>
            </div>

            <div>
              Omitidas:{" "}
              <strong>{result.skipped ?? 0}</strong>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-semibold">
            Error sincronizando stock
          </div>

          <div className="mt-1">
            {error}
          </div>
        </div>
      )}

      {result?.errors &&
        result.errors.length > 0 && (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {result.errors.map((item) => (
              <div key={item.batch}>
                <strong>
                  Lote {item.batch} · HTTP {item.status}
                </strong>

                <div className="break-words">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}