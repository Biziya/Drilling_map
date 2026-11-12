import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Sidebar from "../../../src/components/Sidebar/Sidebar.jsx";
import { APP_VERSION } from "../../../src/config/version.js";

afterEach(cleanup);

const renderSidebar = (props = {}) => render(
  <Sidebar activePage="techno-map" isCollapsed={false} onNavigate={() => {}} onToggle={() => {}} {...props} />,
);

describe("sidebar version", () => {
  it("shows the website version right under the backend status", () => {
    const { container } = renderSidebar();
    const status = screen.getByRole("status");
    const version = container.querySelector(".sidebar__version");

    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(version.textContent).toBe(`v${APP_VERSION}`);
    expect(status.nextElementSibling).toBe(version);
    expect(status.getAttribute("title")).toContain(`Version ${APP_VERSION}`);
  });

  it("keeps the version in the status tooltip when collapsed, where the text is hidden", () => {
    const { container } = renderSidebar({ isCollapsed: true });

    expect(container.querySelector(".sidebar.is-collapsed .sidebar__version")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("title")).toContain(APP_VERSION);
  });
});
