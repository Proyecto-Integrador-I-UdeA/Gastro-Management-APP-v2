import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  setOpen: vi.fn(),
  router: { asPath: "/kitchen", isReady: true },
}));

vi.mock("next/router", () => ({ useRouter: () => ({ ...mocks.router, push: mocks.push }) }));
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({ open: true, setOpen: mocks.setOpen }),
}));
vi.mock("@/utils/toast", () => ({ showError: vi.fn() }));

function tokenWithPermissions(permissions: string[]): string {
  return `header.${btoa(JSON.stringify({ permissions }))}.signature`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.router.asPath = "/kitchen";
  localStorage.clear();
});

describe("navegación de Cocina", () => {
  it("muestra Cocina y navega solo con kitchen.read", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", tokenWithPermissions(["kitchen.read"]));
    render(<Sidebar />);

    await user.click(await screen.findByRole("button", { name: /Cocina/ }));
    expect(mocks.push).toHaveBeenCalledWith("/kitchen");
  });

  it("no expone Cocina sin kitchen.read", async () => {
    mocks.router.asPath = "/sales";
    localStorage.setItem("token", tokenWithPermissions(["sales.read"]));
    render(<Sidebar />);

    expect(await screen.findByRole("button", { name: /Inicio de ventas/ }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cocina/ })).not.toBeInTheDocument();
  });
});
