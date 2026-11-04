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
