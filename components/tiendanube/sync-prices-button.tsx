"use client";

import { useState } from "react";

type Result = {
  ok?: boolean;
  error?: string;
  variants?: number;
  updatedVariants?: number;
  batches?: number;
  skipped?: number;

  errors?: Array<{
    batch: number;
    status: number;
    detail: string;
  }>;
};

export function SyncPricesButton() {
  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<Result | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  async function syncPrices() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/tiendanube/sync-prices",
          {
            method: "POST",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const text =
        await response.text();

      let data: Result;

      try {
        data =
          JSON.parse(text);
      } catch {
        throw new Error(
          `Respuesta inválida. HTTP ${response.status}`
        );
      }

      setResult(data);

      if (
        !response.ok ||
        data.ok === false
      ) {
        throw new Error(
          data.error ||
            "Tiendanube rechazó algunos precios"
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron sincronizar los precios"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={syncPrices}
        disabled={loading}
        className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Sincronizando precios..."
          : "Sincronizar precios"}
      </button>

      {result?.ok && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✓ Precios sincronizados ·{" "}
          {result.updatedVariants ??
            0}{" "}
          variantes
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}