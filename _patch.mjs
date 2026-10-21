import { readFileSync, writeFileSync } from 'node:fs';
const p = 'tests/pages/legendSizes.test.jsx';
let s = readFileSync(p, 'utf8');
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a); s = s.replace(a, b); };
rep(`    expect(variable("--legend-symbol-box-width")).toBe(\`\${legend.symbols.boxWidth}px\`);
    expect(variable("--legend-symbol-box-height")).toBe(\`\${legend.symbols.boxHeight}px\`);
    expect(variable("--legend-symbol-size")).toBe(\`\${legend.symbols.size}px\`);
    expect(variable("--legend-rig-size")).toBe(\`\${legend.symbols.rigIconSize}px\`);
    expect(variable("--legend-label-size")).toBe(\`\${legend.labelFontSize}px\`);
    expect(variable("--legend-title-size")).toBe(\`\${legend.titleFontSize}px\`);
    expect(variable("--legend-gt-width")).toBe(\`\${legend.gt.width}px\`);
    expect(variable("--legend-redox-height")).toBe(\`\${legend.redox.height}px\`);`, `    expect(variable("--legend-symbol-size")).toBe(\`\${legend.symbolSize}px\`);
    expect(variable("--legend-rig-scale")).toBe(String(legend.symbols.rigIconScale));
    expect(variable("--legend-label-size")).toBe(\`\${legend.labelFontSize}px\`);
    expect(variable("--legend-title-size")).toBe(\`\${legend.titleFontSize}px\`);
    expect(variable("--legend-gt-row-gap")).toBe(\`\${legend.gt.rowGap}px\`);
    expect(variable("--legend-redox-row-gap")).toBe(\`\${legend.redox.rowGap}px\`);`);
rep(`default: { ...actual, legend: { ...actual.legend, symbols: { ...actual.legend.symbols, size: 22 } } },
    }));
    const { MAP_CONFIG: reloaded } = await import(configPath);

    expect(reloaded.legend.symbols.size).toBe(22);`, `default: { ...actual, legend: { ...actual.legend, symbolSize: 22 } },
    }));
    const { MAP_CONFIG: reloaded } = await import(configPath);

    expect(reloaded.legend.symbolSize).toBe(22);`);
rep(`legend: { ...actual.legend, gt: { ...actual.legend.gt, width: -4 } } },
    }));

    await expect(import(configPath)).rejects.toThrow(/legend\.gt\.width: expected 0 or more/);`, `legend: { ...actual.legend, symbolSize: -4 } },
    }));

    await expect(import(configPath)).rejects.toThrow(/legend\.symbolSize: expected 0 or more/);`);
rep(`  it("keeps the three sections in order", () => {`, `  // GT circles and Redox squares sit in the same symbol box as the type
  // symbols, so every section's labels line up.
  it("centres every GT, Redox and type symbol in the same box", () => {
    const { container } = render(<MapLegend />);
    const rows = [...container.querySelectorAll(".map-legend li")];

    expect(rows.length).toBeGreaterThan(9);
    rows.forEach((row) => expect(row.firstElementChild.className).toBe("legend-symbol"));
    expect(container.querySelectorAll(".map-legend__gt .legend-symbol > .legend-dot")).toHaveLength(MAP_CONFIG.gtRanges.length);
    expect(container.querySelectorAll(".map-legend__redox .legend-symbol > .legend-swatch")).toHaveLength(3);
  });

  it("keeps the three sections in order", () => {`);
writeFileSync(p, s);
