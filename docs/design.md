# Design Notes

## Intent

The interface should feel more like a field notebook than a generic admin dashboard: warm paper, deep moss, restrained amber, and high-contrast editorial typography. It makes uncertainty visible rather than hiding it in a tooltip.

## Hierarchy

1. The first visual level is the currently published price and power-system metrics.
2. A plain-language reading strip translates the current source observations before the detailed visuals begin.
3. The generation mix uses stable colours by technology, shows its largest categories first, and collapses low-volume categories to reduce cognitive load.
4. The map is a geographic index with a plain-language anti-misinterpretation panel, not a decorative heatmap.
5. The provenance ledger communicates limits after the core reading path without burying them.
6. Charts are the default reading mode; the compact source table and CSV provide the exact values without forcing a dense numeric dashboard.
7. A price view can switch between line and bars, while the weather chart offers temperature or wind. This avoids overloading one chart with incomparable units.
8. Weather appears beside anomalies only with a geography warning: Stuttgart station data is context for German/DE-LU series, not an attribution model.
9. The price/load comparison normalizes each series to its first matched value (index 100), clearly labelled to avoid hiding their different units.
10. The generation trend displays direct sums of named, published generation technologies instead of visually inferred categories.

## Accessibility

- Text and interactive states have non-colour cues.
- Native buttons and link semantics are retained.
- The map has an accessible label and each district path has a title.
- Mobile layouts collapse grids before text or controls become cramped.
