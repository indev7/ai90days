export const AIME_CHARTS = `
This knowledge describes how to use the render_chart tool and how to shape chart data.

Supported chart types (strict):
- bar
- pie
- line (supports multiple series in one chart)

General rules:
- Use render_chart only when the user asks for a visual chart.
- The tool payload must include: kind, chartType, data, x, series.
- data is row-based: each row is one x-category or time bucket. Each series key must exist in every row.
- Keep data compact: prefer <= 50 rows and <= 6 series.
- CHAT_WINDOW_WIDTH_PX (if provided) is the chat window width, not full screen. Size labels and data density to fit that width (aim for ~90-95% of it).

Bar chart:
- chartType: "bar"
- x.key is the category or time label.
- series can include multiple bars per category.

Line chart:
- chartType: "line"
- x.key is the category or time label.
- series can include multiple line series in the same chart.

Pie chart:
- chartType: "pie"
- Use x.key as the slice label.
- Use exactly one series entry; its key is the numeric value for each slice.

Formatting:
- series[].format or y.format can be "number", "currency:LKR", or "percent".
- Use percent only when values already represent percent numbers.
- Colors are assigned by the UI using the same palette as the 12-week clock (objective colors).

Example (line with multiple series):
{
  "kind": "render_chart",
  "chartType": "line",
  "title": "Monthly Sales",
  "data": [
    { "month": "Jan", "north": 120, "south": 95 },
    { "month": "Feb", "north": 140, "south": 110 }
  ],
  "x": { "key": "month", "label": "Month" },
  "series": [
    { "key": "north", "label": "North", "format": "currency:LKR" },
    { "key": "south", "label": "South", "format": "currency:LKR" }
  ],
  "options": { "showLegend": true }
}
`;
