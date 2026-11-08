export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    let message = `The request could not be completed (${response.status}).`;
    try {
      const error = await response.json();
      if (typeof error.detail === 'string') message = error.detail;
      else if (Array.isArray(error.detail)) message = error.detail.map((item: { msg?: string }) => item.msg || 'Invalid value').join('. ');
      else if (typeof error.error === 'string') message = error.error;
    } catch { /* The HTTP status remains useful when the upstream response is not JSON. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const patchUrl = (id: string) => `/api/patches/${encodeURIComponent(id)}.jpg`;
export const format = (n: number | null | undefined, digits = 3) => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(n);
export const fixed = (n: number | null | undefined, digits = 4) => n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);
export const percent = (n: number | null | undefined, digits = 1) => n == null || !Number.isFinite(n) ? '—' : `${format(n * 100, digits)}%`;
export const titleCase = (value: string) => value.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const CLUSTER_NAMES: Record<number, string> = {
  0: 'Sea & Lake (Wetlands)',
  1: 'Industrial Buildings',
  2: 'Forest',
  3: 'River & Waterways',
  4: 'Annual Crops',
  5: 'Permanent Crops',
  6: 'Sea & Lake (Deep Water)',
  7: 'Herbaceous Vegetation',
  8: 'Pasture & Grassland',
  9: 'Residential Buildings',
};

export function clusterName(cluster: { id?: number; name?: string } | number | null | undefined): string {
  if (cluster == null) return '';
  if (typeof cluster === 'number') {
    return CLUSTER_NAMES[cluster] || `Group ${String(cluster + 1).padStart(2, '0')}`;
  }
  return cluster.name || (cluster.id != null ? CLUSTER_NAMES[cluster.id] : undefined) || `Group ${String((cluster.id ?? 0) + 1).padStart(2, '0')}`;
}

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
