"use client";

import { useState } from "react";

type SyncResult = {
  ok?: boolean;
  tiendanubeProducts?: number;
  linkedProducts?: number;
  linkedVariants?: number;
  unmatchedVariants?: number;
  imagesUpdated?: number;
  error?: string;
  detail?: string;
};

export default function SyncCatalogButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function syncCatalog() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/tiendanube/sync-catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as SyncResult;

      if (!response.ok) {
        setResult({
          error: data.error ?? "No se pudo sincronizar el catálogo.",
          detail: data.detail,
        });
        return;
      }

      setResult(data);
    } catch (error) {
      setResult({
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado al sincronizar.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={syncCatalog}
        disabled={loading}
        className="min-h-11 w-full rounded-xl bg-[#d96898] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#c65082] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Sincronizando..." : "Sincronizar catálogo"}
      </button>

      {result?.ok && (
        <div className="mt-3 rounded-xl border border-[#d9eadf] bg-[#f3faf6] p-4 text-sm text-[#365c48]">
          <p className="font-bold">Sincronización completada</p>

          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <p>
              Productos en Tiendanube:{" "}
              <strong>{result.tiendanubeProducts ?? 0}</strong>
            </p>

            <p>
              Productos vinculados:{" "}
              <strong>{result.linkedProducts ?? 0}</strong>
            </p>

            <p>
              Variantes vinculadas:{" "}
              <strong>{result.linkedVariants ?? 0}</strong>
            </p>

            <p>
              Sin coincidencia:{" "}
              <strong>{result.unmatchedVariants ?? 0}</strong>
            </p>

            <p>
              Imágenes actualizadas:{" "}
              <strong>{result.imagesUpdated ?? 0}</strong>
            </p>
          </div>
        </div>
      )}

      {result?.error && (
        <div className="mt-3 rounded-xl border border-[#f2ccd8] bg-[#fff4f7] p-4 text-sm text-[#9a3659]">
          <p className="font-bold">No se pudo sincronizar</p>
          <p className="mt-1 text-xs">{result.error}</p>

          {result.detail && (
            <p className="mt-1 break-words text-xs opacity-80">
              {result.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}