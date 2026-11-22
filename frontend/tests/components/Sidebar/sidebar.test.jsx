import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Sidebar from "../../../src/components/Sidebar/Sidebar.jsx";
import { APP_VERSION } from "../../../src/config/version.js";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

describe("sidebar page icons", () => {
  const links = () => within(screen.getByRole("navigation", { name: "Main navigation" })).getAllByRole("button");

  it("gives every page its own outline icon, hidden from screen readers", () => {
    renderSidebar();
    const icons = links().map((link) => link.querySelector(".sidebar__icon[aria-hidden='true'] > svg"));

    expect(icons.map((icon) => icon.dataset.icon)).toEqual(["exploration-map", "techno-map", "drilling-details", "drilling-by-rig"]);
    icons.forEach((icon) => {
      expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(icon.getAttribute("stroke")).toBe("currentColor");
      expect(icon.getAttribute("stroke-width")).toBe("2");
      expect(icon.getAttribute("fill")).toBe("none");
    });
    expect(links().map((link) => link.textContent)).toEqual(["Exploration Map", "Techno Map", "Drilling Details", "Drilling by Rig"]);
  });

  it("keeps the icon files free of fixed colours, sizes and backgrounds, so CSS sizes and colours them", () => {
    const dir = resolve(import.meta.dirname, "../../../src/assets/sidebar");
    const files = readdirSync(dir).filter((name) => name.endsWith(".svg"));

    expect(files.sort()).toEqual(["icon-drilling-by-rig.svg", "icon-drilling-details.svg", "icon-exploration-map.svg", "icon-techno-map.svg"]);
    files.forEach((name) => {
      const svg = readFileSync(resolve(dir, name), "utf8");
      const root = svg.match(/<svg\b[^>]*>/)[0];

      expect(root, name).toContain('viewBox="0 0 24 24"');
      expect(root, name).toContain('stroke="currentColor"');
      expect(root, name).toContain('fill="none"');
      expect(root, name).not.toMatch(/\s(width|height)=/);
      expect(svg, name).not.toMatch(/(fill|stroke|color)="(#|rgb|white|black)/i);
      expect(svg, name).not.toMatch(/<rect\b[^>]*width="24"/);
    });
  });

  it("names each page in a tooltip when collapsed, instead of the native title", () => {
    renderSidebar({ isCollapsed: true });

    expect(links().map((link) => link.dataset.tooltip)).toEqual(["Exploration Map", "Techno Map", "Drilling Details", "Drilling by Rig"]);
    expect(links().every((link) => !link.hasAttribute("title"))).toBe(true);
  });

  it("keeps the native title when expanded", () => {
    renderSidebar();

    expect(links().map((link) => link.title)).toEqual(["Exploration Map", "Techno Map", "Drilling Details", "Drilling by Rig"]);
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
