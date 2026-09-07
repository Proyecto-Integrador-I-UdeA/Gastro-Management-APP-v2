import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuItemImageField, {
  MAX_MENU_IMAGE_BYTES,
} from "@/components/menu/MenuItemImageField";
import type { MenuItemImageSummary } from "@/components/menu/MenuItemImageField";

const objectUrl = vi.fn();
const revokeObjectUrl = vi.fn();

function Harness({
  currentImage = null,
  onDeleteCurrent,
}: {
  currentImage?: MenuItemImageSummary | null;
  onDeleteCurrent?: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  return (
    <MenuItemImageField
      itemName="Pollo a la plancha"
      currentImage={currentImage}
      selectedFile={selectedFile}
      onSelectedFileChange={setSelectedFile}
      onDeleteCurrent={onDeleteCurrent}
    />
  );
}

beforeEach(() => {
  objectUrl.mockReset();
  revokeObjectUrl.mockReset();
  let sequence = 0;
  objectUrl.mockImplementation(() => `blob:menu-preview-${++sequence}`);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: objectUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
});

describe("MenuItemImageField", () => {
  it("muestra placeholder cuando el plato no tiene imagen", () => {
    render(<Harness />);
    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
    expect(screen.getByLabelText("Seleccionar imagen")).toHaveAttribute(
      "accept",
      expect.stringContaining(".webp"),
    );
  });

  it.each([
    ["plato.jpg", "image/jpeg"],
    ["plato.png", "image/png"],
    ["plato.webp", "image/webp"],
  ])("genera preview local para %s", async (name, type) => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(
      screen.getByLabelText("Seleccionar imagen"),
      new File(["image-bytes"], name, { type }),
    );

    expect(objectUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "Fotografía de Pollo a la plancha" }))
      .toHaveAttribute("src", "blob:menu-preview-1");
  });

  it("rechaza archivos mayores de 5 MiB con un mensaje comprensible", () => {
    render(<Harness />);
    const file = new File(
      [new Uint8Array(MAX_MENU_IMAGE_BYTES + 1)],
      "grande.jpg",
      { type: "image/jpeg" },
    );
    fireEvent.change(screen.getByLabelText("Seleccionar imagen"), {
      target: { files: [file] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La imagen supera el tamaño máximo de 5 MB.",
    );
    expect(objectUrl).not.toHaveBeenCalled();
  });

  it("rechaza extensión o MIME no soportado", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Seleccionar imagen"), {
      target: { files: [new File(["svg"], "vector.svg", { type: "image/svg+xml" })] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Formato no permitido. Usa JPG, PNG o WebP.",
    );
  });

  it("reemplaza la preview, revoca la URL anterior y permite descartar la selección", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Seleccionar imagen");

    await user.upload(input, new File(["one"], "one.jpg", { type: "image/jpeg" }));
    await user.upload(screen.getByLabelText("Cambiar imagen"), new File(
      ["two"],
      "two.png",
      { type: "image/png" },
    ));

    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:menu-preview-2");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:menu-preview-1");

    await user.click(screen.getByRole("button", { name: "Quitar imagen seleccionada" }));
    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:menu-preview-2");
  });

  it("muestra imagen existente y ofrece la eliminación administrativa", async () => {
    const onDeleteCurrent = vi.fn();
    const user = userEvent.setup();
    render(<Harness
      currentImage={{
        assetId: 7,
        url: "/menu-media/files/example.png",
        width: 1200,
        height: 900,
      }}
      onDeleteCurrent={onDeleteCurrent}
    />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/menu-media/files/example.png"),
    );
    await user.click(screen.getByRole("button", { name: "Eliminar imagen" }));
    expect(onDeleteCurrent).toHaveBeenCalledTimes(1);
  });
});
