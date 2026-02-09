# Task: Add Chart Rendering Capability to AIME Chat via new tool `render_chart` (Recharts)

## Goal
Enable AIME chat to respond with visual charts sometimes (line/bar/pie). When the user asks for a visual display (e.g., “show monthly sales”), the LLM should output a `render_chart` tool call containing:
- the selected chart type (from a strict enum)
- chart metadata (title, axes labels, formatting hints)
- **data shaped in a consistent JSON structure**
The frontend chat UI will detect this tool call and render a chart message bubble using Recharts.

We must implement:
1) a new tool definition: `render_chart`
2) a domain knowledge file explaining the supported chart types + data-shaping rules (Recharts-oriented)
3) backend wiring so the model is aware of and can emit `render_chart`
4) frontend rendering changes on AIME chat page to render the chart bubble when tool call is present
5) validation/guardrails to avoid UI breakage (unknown types, bad data, excessive datapoints, etc.)

---

## Chart Types to Support (limit to these 3)
Use these 3 chart types and **do not allow others**:
- `bar`
- `pie`
- `line` (supports multiple series in the same chart)

---

## Tool Contract: `render_chart`
### Tool Name
`render_chart`

### Tool Input/Output Shape (single schema)
The tool call payload must match this shape:

```ts
type ChartType = "bar" | "pie" | "line";

type RenderChartPayload = {
  kind: "render_chart"; // for easy detection
  chartType: ChartType;

  title?: string;
  subtitle?: string;
  description?: string; // optional insight text for bubble

  // Recharts-friendly row-based data.
  // Each row is one x-category/time bucket, with numeric series keys.
  data: Array<Record<string, string | number | null>>;

  // x-axis mapping for cartesian charts
  x: { key: string; label?: string };

  // series definitions (1..N). Each series key must exist in data rows as numeric values.
  series: Array<{
    key: string;          // e.g. "sales"
    label?: string;       // e.g. "Sales"
    // For line charts, multiple series are allowed.
    format?: "number" | "currency:LKR" | "percent";
  }>;

  y?: {
    label?: string;
    format?: "number" | "currency:LKR" | "percent";
    min?: number;
    max?: number;
  };

  options?: {
    // pie behaviors
    pieInnerRadius?: number; // optional (e.g. 60)
    // display controls
    showLegend?: boolean;
  };
};
