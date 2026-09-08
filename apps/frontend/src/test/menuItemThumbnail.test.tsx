import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MenuItemThumbnail from "@/components/menu/MenuItemThumbnail";

vi.mock("@/config/apiBaseUrl", () => ({
  API_BASE_URL: "https://api.example.test",
}));

describe("MenuItemThumbnail administrativo", () => {
  it("mantiene una caja 4:3 compacta para imagen y placeholder", () => {
    const { rerender } = render(
      <MenuItemThumbnail itemName="Plato sin foto" image={null} size="admin" />,
    );

    const placeholderBox = screen.getByText("Sin imagen").parentElement;
    expect(placeholderBox).toHaveClass(
      "aspect-[4/3]",
      "max-w-[260px]",
      "sm:w-[250px]",
    );

    rerender(
      <MenuItemThumbnail
        itemName="Pollo a la plancha"
        image={{
          url: "/menu-media/files/plato.jpg",
          width: 1200,
          height: 900,
        }}
        size="admin"
      />,
    );

    const image = screen.getByRole("img", { name: "Fotografía de Pollo a la plancha" });
    expect(image).toHaveClass("h-full", "w-full", "object-cover");
    expect(image.parentElement).toHaveClass(
      "aspect-[4/3]",
      "max-w-[260px]",
      "sm:w-[250px]",
    );
  });

  it("reduce en 12% la huella visual de la variante comercial sin afectar admin", () => {
    render(
      <MenuItemThumbnail itemName="Plato comercial" image={null} size="sales" />,
    );

    const salesThumbnail = screen.getByText("Sin imagen").parentElement;
    expect(salesThumbnail).toHaveClass("aspect-[4/3]", "w-[88%]", "mx-auto");
    expect(salesThumbnail).not.toHaveClass("max-w-[260px]", "sm:w-[250px]");
  });
});
