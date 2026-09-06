"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { apiFetch } from "@/lib/api";
import { showError, showSuccess } from "@/utils/toast";

type MenuItemSummary = {
  id: number;
  name: string;
  active: boolean;
};

type PublishedPrice = {
  id: number;
  amount: string;
  marginRate: string;
  taxRate: string;
  validFrom: string;
  validUntil: string | null;
};

type SalePricePreview = {
  menuItemId: number;
  cost: {
    baseCost: string;
    indirectCost: string;
    totalCost: string;
  };
  pricing: {
    marginRate: string;
    taxRate: string;
    priceBeforeTax: string;
    taxAmount: string;
    calculatedAmount: string;
    roundingIncrement: string;
    amount: string;
    currency: string;
    taxIncluded: boolean;
  };
  currentPrice: PublishedPrice | null;
};

function formatCop(value: string | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function validRates(marginRate: string, taxRate: string): boolean {
  const margin = Number(marginRate);
  const tax = Number(taxRate);
  return marginRate.trim() !== ""
    && taxRate.trim() !== ""
    && Number.isFinite(margin)
    && Number.isFinite(tax)
    && margin >= 0
    && margin < 1
    && tax >= 0
    && tax <= 1;
}

export default function PriceCalculationPage() {
  const [menuItems, setMenuItems] = useState<MenuItemSummary[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [marginRate, setMarginRate] = useState("0.400000");
  const [taxRate, setTaxRate] = useState("0.190000");
  const [preview, setPreview] = useState<SalePricePreview | null>(null);
  const [history, setHistory] = useState<PublishedPrice[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const response = await apiFetch("/menu-items");
        const items = Array.isArray(response) ? response : response?.data ?? [];
        setMenuItems(items.filter((item: MenuItemSummary) => item.active));
      } catch (error) {
        console.error(error);
        showError("No fue posible cargar el menú");
      }
    };

    void loadMenuItems();
  }, []);

  const loadHistory = async (menuItemId: string) => {
    const response = await apiFetch(`/costs/menu-items/${menuItemId}/sale-prices`);
    setHistory(Array.isArray(response) ? response : []);
  };

  useEffect(() => {
    if (!selectedItem) {
      setHistory([]);
      return;
    }

    void loadHistory(selectedItem).catch(error => {
      console.error(error);
      showError("No fue posible cargar el historial de precios");
    });
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem || !validRates(marginRate, taxRate)) {
      setPreview(null);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const response = await apiFetch(
          `/costs/menu-items/${selectedItem}/sale-price/calculate`,
          {
            method: "POST",
            body: JSON.stringify({ marginRate, taxRate }),
          },
        );
        setPreview(response);
      } catch (error) {
        console.error(error);
        setPreview(null);
        showError("No fue posible calcular el precio de venta");
      } finally {
        setLoadingPreview(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [selectedItem, marginRate, taxRate]);

  const currentPrice = useMemo(
    () => preview?.currentPrice ?? history.find(price => price.validUntil === null) ?? null,
    [preview, history],
  );

  const publishPrice = async () => {
    if (!selectedItem || !preview || publishing) return;

    setPublishing(true);
    try {
      const response = await apiFetch(
        `/costs/menu-items/${selectedItem}/sale-price`,
        {
          method: "POST",
          body: JSON.stringify({ marginRate, taxRate }),
        },
      );
      setPreview(response);
      await loadHistory(selectedItem);
      showSuccess("Precio de venta publicado correctamente");
    } catch (error) {
      console.error(error);
      showError("No fue posible publicar el precio de venta");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Cálculo de Precio de Venta
      </h1>

      <div className="bg-gray-400/20 p-6 rounded-2xl space-y-6">
        <div>
          <label htmlFor="menu-item">Seleccionar plato</label>
          <select
            id="menu-item"
            value={selectedItem}
            onChange={event => setSelectedItem(event.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Seleccionar --</option>
            {menuItems.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="margin-rate">Margen de utilidad</label>
            <input
              id="margin-rate"
              aria-label="Margen de utilidad"
              type="number"
              min="0"
              max="0.999999"
              step="0.01"
              value={marginRate}
              onChange={event => setMarginRate(event.target.value)}
              className="border p-2 rounded w-full"
            />
            <p className="text-sm text-gray-500">0.40 equivale a 40 % sobre venta.</p>
          </div>

          <div>
            <label htmlFor="tax-rate">Impuesto</label>
            <input
              id="tax-rate"
              aria-label="Impuesto"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={taxRate}
              onChange={event => setTaxRate(event.target.value)}
              className="border p-2 rounded w-full"
            />
            <p className="text-sm text-gray-500">0.19 equivale a 19 %.</p>
          </div>
        </div>

        {loadingPreview && <p>Calculando precio actual…</p>}
      </div>

      {selectedItem && (
        <section className="mt-8 bg-white p-6 rounded-xl shadow space-y-3">
          <h2 className="text-xl font-semibold">Precio vigente</h2>
          {currentPrice ? (
            <p className="text-2xl font-bold text-blue-700">
              {formatCop(currentPrice.amount)}
            </p>
          ) : (
            <p className="text-gray-500">Este plato todavía no tiene precio publicado.</p>
          )}
        </section>
      )}

      {preview && (
        <section className="mt-8 bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">Preview de precio</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <p><strong>Costo base:</strong> {formatCop(preview.cost.baseCost)}</p>
            <p><strong>Costo indirecto:</strong> {formatCop(preview.cost.indirectCost)}</p>
            <p><strong>Costo actual:</strong> {formatCop(preview.cost.totalCost)}</p>
            <p><strong>Margen:</strong> {Number(preview.pricing.marginRate) * 100} %</p>
            <p><strong>Precio antes de impuesto:</strong> {formatCop(preview.pricing.priceBeforeTax)}</p>
            <p><strong>Impuesto calculado:</strong> {formatCop(preview.pricing.taxAmount)}</p>
            <p><strong>Precio calculado:</strong> {formatCop(preview.pricing.calculatedAmount)}</p>
            <p className="text-green-700 text-xl font-bold">
              <strong>Precio final:</strong> {formatCop(preview.pricing.amount)}
            </p>
          </div>

          <div className="mt-6">
            <Button onClick={publishPrice} disabled={publishing}>
              {publishing
                ? "Publicando…"
                : currentPrice
                  ? "Actualizar precio de venta"
                  : "Guardar precio de venta"}
            </Button>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-8 bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">Historial de precios</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left">Vigencia</th>
                <th className="text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {history.map(price => (
                <tr key={price.id} className="border-b">
                  <td>{price.validUntil === null ? "Vigente" : "Histórico"}</td>
                  <td className="text-right">{formatCop(price.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </DashboardLayout>
  );
}
