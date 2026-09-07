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
        className="pt-button-primary px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Sincronizando precios..."
          : "Sincronizar precios"}
      </button>

      {result?.ok && (
        <div className="rounded-[18px] border border-[#d6ece0] bg-[#f5fbf8] p-3 text-sm text-[#2f7356]">
          ✓ Precios sincronizados ·{" "}
          {result.updatedVariants ??
            0}{" "}
          variantes
        </div>
      )}

      {error && (
        <div className="rounded-[18px] border border-[#f0d2d9] bg-[#fff7f9] p-3 text-sm text-[#b14359]">
          {error}
        </div>
      )}
    </div>
  );
}