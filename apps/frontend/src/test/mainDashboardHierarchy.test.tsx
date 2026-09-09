import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/dashboard";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/components/Sidebar", () => ({ default: () => <aside /> }));
vi.mock("@/components/Header", () => ({ default: () => <header /> }));

function tokenWithPermissions(permissions: string[]): string {
  return `header.${btoa(JSON.stringify({ permissions }))}.signature`;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("jerarquía del dashboard principal", () => {
  it("mantiene Ventas como único módulo raíz aunque el usuario tenga kitchen.read", async () => {
    localStorage.setItem(
      "token",
      tokenWithPermissions(["sales.read", "kitchen.read"]),
    );

    render(<Dashboard />);

    expect(await screen.findByRole("heading", { name: "VENTAS" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "COCINA" })).not.toBeInTheDocument();
  });
});
