import type { HistoryPoint } from '../../types';

export function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => {
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };
  const body = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function historyToCsvRows(metric: string, points: HistoryPoint[]): string[][] {
  const rows: string[][] = [['metric', 'value', 'type', 'received_at']];
  for (const point of points) {
    rows.push([metric, String(point.value), point.type, point.received_at]);
  }
  return rows;
}

export function mergeHistoryCsv(metrics: Record<string, HistoryPoint[]>): string[][] {
  const rows: string[][] = [['metric', 'value', 'type', 'received_at']];
  for (const [metric, points] of Object.entries(metrics)) {
    for (const point of points) {
      rows.push([metric, String(point.value), point.type, point.received_at]);
    }
  }
  rows.sort((a, b) => new Date(a[3]!).getTime() - new Date(b[3]!).getTime());
  return rows;
}
