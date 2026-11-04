import {createContext} from "react-router";

// Numeric durations and fixed stage names only. Never capture URLs, payloads or identifiers.
export class RequestTiming {
  readonly durations: Record<string, number> = {};
  async measure<T>(name: string, work: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try { return await work(); }
    finally { this.durations[name] = performance.now() - started; }
  }
  header() {
    return Object.entries(this.durations).map(([name,ms]) => `pw_${name};dur=${ms.toFixed(1)}`).join(", ");
  }
}
export const requestTimingContext = createContext<RequestTiming>();

// Only fixed numeric stages are allowed out of the control plane.
const backendStages = new Set(["app", "db", "provider_http", "billing", "tenancy", "lookup", "authorize", "proof", "selection", "catalog", "validate", "consume", "payload", "execution", "analytics"]);
export function backendTimings(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key,ms]) => backendStages.has(key) && typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 && ms <= 120_000).map(([key,ms]) => [`backend_${key}`, Number(ms)]));
}
