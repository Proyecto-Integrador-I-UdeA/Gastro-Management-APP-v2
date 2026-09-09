import { describe, expect, it } from "vitest";
import {
  normalizeSalesSearchText,
  searchSalesCatalogItems,
  type SearchableSalesCatalogItem,
} from "@/utils/salesCatalogSearch";

const items: SearchableSalesCatalogItem[] = [
  {
    id: 3,
    name: "Limonada natural",
    description: "Bebida fría de la casa",
    kind: "STANDARD",
    available: false,
    category: { name: "Bebidas" },
  },
  {
    id: 2,
    name: "Hamburguesa clásica",
    description: "Carne, queso y vegetales",
    kind: "STANDARD",
    available: true,
    category: { name: "Platos fuertes" },
  },
  {
    id: 4,
    name: "Limón adicional",
    description: null,
    kind: "ADDITION",
    available: true,
    category: { name: "Adiciones" },
  },
  {
    id: 1,
    name: "Ajiaco santafereño",
    description: "Sopa tradicional",
    kind: "STANDARD",
    available: true,
    category: { name: "Sopas" },
  },
];

describe("búsqueda determinística del catálogo de ventas", () => {
  it("normaliza mayúsculas, acentos y espacios sin alterar el texto fuente", () => {
    expect(normalizeSalesSearchText("  LIMÓN   Natural ")).toBe("limon natural");
  });

  it("busca por nombre sin distinguir mayúsculas", () => {
    expect(searchSalesCatalogItems(items, "HAMBURGUESA").map(item => item.id)).toEqual([2]);
  });

  it("normaliza acentos en la consulta", () => {
    expect(searchSalesCatalogItems(items, "limon").map(item => item.id)).toEqual([4, 3]);
  });

  it("admite coincidencias parciales de nombre", () => {
    expect(searchSalesCatalogItems(items, "hamb").map(item => item.id)).toEqual([2]);
  });

  it("busca por categoría", () => {
    expect(searchSalesCatalogItems(items, "bebida").map(item => item.id)).toEqual([3]);
  });

  it("busca por descripción", () => {
    expect(searchSalesCatalogItems(items, "vegetales").map(item => item.id)).toEqual([2]);
  });

  it("busca por tipo de MenuItem", () => {
    expect(searchSalesCatalogItems(items, "addition").map(item => item.id)).toEqual([4]);
  });

  it("excluye elementos sin coincidencia", () => {
    expect(searchSalesCatalogItems(items, "pasta")).toEqual([]);
  });

  it("ordena disponibles antes que agotados y aplica relevancia después", () => {
    expect(searchSalesCatalogItems(items, "limon").map(item => item.id)).toEqual([4, 3]);
  });

  it("mantiene un orden determinístico para búsqueda vacía", () => {
    expect(searchSalesCatalogItems(items, "").map(item => item.id)).toEqual([1, 2, 4, 3]);
  });
});
