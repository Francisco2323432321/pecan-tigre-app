"use client";

import { useState } from "react";

export function SyncProductsButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncProducts() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const productResponse = await fetch(
        "/api/tiendanube/sync-products/base",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const productText = await productResponse.text();

      let productData: {
        ok?: boolean;
        error?: string;
        updated?: number;
      };

      try {
        productData = JSON.parse(productText);
      } catch {
        throw new Error(
          `Respuesta inválida sincronizando productos. HTTP ${productResponse.status}`
        );
      }

      if (!productResponse.ok || productData.ok === false) {
        throw new Error(
          productData.error || "Error sincronizando productos"
        );
      }

      const variantResponse = await fetch(
        "/api/tiendanube/sync-products/variants",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const variantText = await variantResponse.text();

      let variantData: {
        ok?: boolean;
        error?: string;
        variantsUpdated?: number;
      };

      try {
        variantData = JSON.parse(variantText);
      } catch {
        throw new Error(
          `Respuesta inválida sincronizando variantes. HTTP ${variantResponse.status}`
        );
      }

      if (!variantResponse.ok || variantData.ok === false) {
        throw new Error(
          variantData.error || "Error sincronizando variantes"
        );
      }

      setMessage(
        `Productos actualizados: ${productData.updated ?? 0}. Variantes actualizadas: ${variantData.variantsUpdated ?? 0}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron sincronizar los productos"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={syncProducts}
        disabled={loading}
        className="pt-button-primary px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Sincronizando productos..."
          : "Sincronizar productos y características"}
      </button>

      {message && (
        <div className="rounded-[18px] border border-[#d6ece0] bg-[#f5fbf8] p-3 text-sm text-[#2f7356]">
          ✓ {message}
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