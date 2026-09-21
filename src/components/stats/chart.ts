export const PIE_COLORS = [
  "#e8b64c",
  "#e0685c",
  "#57c785",
  "#a48cff",
  "#78b4ff",
  "#f3d493",
  "#7fd4c1",
  "#d98cc2",
];

export const SERIES_COLORS = ["#e8b64c", "#e0685c"];

export const TOOLTIP_STYLE = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-ink)",
};

export interface TrendRow {
  key: string;
  label: string;
  count: number;
  movie: number;
  tv: number;
  joint: number;
  a: number;
  b: number;
}
