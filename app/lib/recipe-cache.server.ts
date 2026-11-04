// Server process cache only: never cache shopper cookies, cart IDs or mutation results.
export class PublishedRecipeCache<T extends {valid_until: number}> {
  private entries = new Map<string, {value: T; until: number}>();
  private pending = new Map<string, Promise<T>>();
  private versions = new Map<string, number>();

  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.until > Date.now()) return structuredClone(entry.value);
    const existing = this.pending.get(key);
    if (existing) return structuredClone(await existing);
    if (this.pending.size >= 128) throw new Error('Recipe cache busy.');
    const version = this.versions.get(key) ?? 0;
    const work = loader().then(value => {
      if ((this.versions.get(key) ?? 0) === version) this.store(key, value);
      return value;
    });
    this.pending.set(key, work);
    try { return structuredClone(await work); }
    finally { if (this.pending.get(key) === work) this.pending.delete(key); }
  }

  async refresh(key: string, loader: () => Promise<T | null>): Promise<void> {
    // Do not evict on an invalid notification or an upstream failure.
    const value = await loader();
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
    if (value) this.store(key, value);
    else this.entries.delete(key);
    // Bound bookkeeping along with recipe storage.
    if (this.versions.size > 512) this.versions.delete(this.versions.keys().next().value!);
  }

  private store(key: string, value: T) {
    const until = Math.min(Date.now() + 300_000, value.valid_until * 1000 - 10_000);
    if (!Number.isFinite(until) || until <= Date.now()) throw new Error('Expired recipe.');
    this.entries.delete(key);
    this.entries.set(key, {value: structuredClone(value), until});
    if (this.entries.size > 256) this.entries.delete(this.entries.keys().next().value!);
  }
}

// Per-visit attempt, deliberately absent from the reusable recipe.
export const recipeAttempt = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

// A notification supplies only a code and opaque proof. Always re-fetch the recipe
// from the configured origin; unverified bodies never populate or evict cache entries.
let windowStart = 0;
let notifications = 0;
export async function handleRecipeRefresh(request: Request, refresh: (code:string, notice:string) => Promise<void>) {
  const headers = {"Cache-Control":"no-store"};
  try {
    if (request.method !== "POST") return new Response(null,{status:405,headers});
    if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("body");
    if (Date.now()-windowStart > 60_000) {windowStart=Date.now();notifications=0;}
    if (++notifications > 40) return new Response(null,{status:429,headers});
    const reader = request.body?.getReader();
    if (!reader) throw new Error("body");
    let text=""; let bytes=0; const decoder=new TextDecoder();
    try {for (;;) {const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>16_384)throw new Error("body");text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
    finally {await reader.cancel();}
    const value=JSON.parse(text);
    if (typeof value.code !== "string" || !/^[A-Za-z0-9_-]{3,128}$/.test(value.code)
      || typeof value.notice !== "string" || !value.notice || value.notice.length>8192) throw new Error("notice");
    await refresh(value.code,value.notice);
    return new Response(null,{status:204,headers});
  } catch {return new Response(null,{status:409,headers});}
}
