"use client";

import { useState } from "react";

type ImageError = {
  productId: string;
  status?: number;
  detail: string;
};

type SyncResult = {
  ok?: boolean;
  error?: string;

  tiendanubeProducts?: number;
  linkedProducts?: number;
  linkedVariants?: number;
  unmatchedVariants?: number;

  imagesFound?: number;
  imagesUpdated?: number;
  productsWithoutImages?: number;
  imageFetchErrors?: number;

  variantUpdateErrors?: number;
  productUpdateErrors?: number;

  unmatchedSkus?: string[];
  imageErrors?: ImageError[];
};

export function SyncCatalogButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncCatalog() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/tiendanube/sync-catalog",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      const rawText = await response.text();

      let data: SyncResult;

      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(rawText) as SyncResult;
        } catch {
          throw new Error(
            `El servidor devolvió JSON inválido. HTTP ${response.status}`
          );
        }
      } else {
        throw new Error(
          `El servidor no devolvió JSON. HTTP ${response.status}. ${rawText.slice(
            0,
            200
          )}`
        );
      }

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error ||
            `Error HTTP ${response.status}`
        );
      }

      setResult(data);
    } catch (err) {
      console.error("Error sincronizando Tiendanube:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <button
        type="button"
        onClick={syncCatalog}
        disabled={loading}
        className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Sincronizando..."
          : "Vincular catálogo e imágenes"}
      </button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">
            No se pudo sincronizar
          </div>

          <div className="mt-1 break-words">
            {error}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="mb-3 font-semibold">
            Sincronización completada
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              Productos en Tiendanube:{" "}
              <strong>
                {result.tiendanubeProducts ?? 0}
              </strong>
            </div>

            <div>
              Productos vinculados:{" "}
              <strong>
                {result.linkedProducts ?? 0}
              </strong>
            </div>

            <div>
              Variantes vinculadas:{" "}
              <strong>
                {result.linkedVariants ?? 0}
              </strong>
            </div>

            <div>
              Sin coincidencia:{" "}
              <strong>
                {result.unmatchedVariants ?? 0}
              </strong>
            </div>

            <div>
              Imágenes encontradas:{" "}
              <strong>
                {result.imagesFound ?? 0}
              </strong>
            </div>

            <div>
              Imágenes guardadas:{" "}
              <strong>
                {result.imagesUpdated ?? 0}
              </strong>
            </div>

            <div>
              Productos sin imagen detectada:{" "}
              <strong>
                {result.productsWithoutImages ?? 0}
              </strong>
            </div>

            <div>
              Errores consultando imágenes:{" "}
              <strong>
                {result.imageFetchErrors ?? 0}
              </strong>
            </div>

            <div>
              Errores actualizando variantes:{" "}
              <strong>
                {result.variantUpdateErrors ?? 0}
              </strong>
            </div>

            <div>
              Errores actualizando productos:{" "}
              <strong>
                {result.productUpdateErrors ?? 0}
              </strong>
            </div>
          </div>

          {result.imageErrors &&
            result.imageErrors.length > 0 && (
              <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
                <div className="mb-2 font-semibold">
                  Diagnóstico de imágenes
                </div>

                <div className="space-y-2">
                  {result.imageErrors.map(
                    (imageError, index) => (
                      <div
                        key={`${imageError.productId}-${index}`}
                        className="break-words text-xs"
                      >
                        <strong>
                          Producto Tiendanube{" "}
                          {imageError.productId}
                        </strong>

                        {imageError.status
                          ? ` · HTTP ${imageError.status}`
                          : ""}

                        <div>
                          {imageError.detail}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {result.unmatchedSkus &&
            result.unmatchedSkus.length > 0 && (
              <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
                <strong>SKU sin coincidencia:</strong>

                <div className="mt-1 text-xs">
                  {result.unmatchedSkus.join(", ")}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}