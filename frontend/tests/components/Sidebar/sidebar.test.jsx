import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("sidebar toggle", () => {
  it("is one big button holding the D badge, the title and the arrow", () => {
    const onToggle = vi.fn();
    const { container } = renderSidebar({ onToggle });
    const toggle = screen.getByRole("button", { name: "Collapse navigation" });

    expect(container.querySelectorAll(".sidebar__brand button")).toHaveLength(1);
    expect(toggle.querySelector(".sidebar__brand-mark").textContent).toBe("D");
    expect(toggle.querySelector(".sidebar__brand-text").textContent).toBe("Drilling Map");
    expect(toggle.querySelector(".sidebar__collapse").textContent).toBe("«");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // Clicking the badge or the title toggles too: they are inside the button.
    fireEvent.click(toggle.querySelector(".sidebar__brand-mark"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("keeps the D badge with » when collapsed", () => {
    renderSidebar({ isCollapsed: true });
    const toggle = screen.getByRole("button", { name: "Expand navigation" });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.querySelector(".sidebar__brand-mark").textContent).toBe("D");
    expect(toggle.querySelector(".sidebar__collapse").textContent).toBe("»");
  });
});
