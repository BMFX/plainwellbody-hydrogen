// Fills the Shopify store with everything the Hydrogen storefront reads: the content model,
// images, interface text, sections, pages, collections, coming-soon products, routines,
// site settings, menus and URL redirects.
//
//   node scripts/shopify/setup.mjs              read-only check: scopes, products, files
//   node scripts/shopify/setup.mjs --apply      create whatever is missing
//   node scripts/shopify/setup.mjs --apply --overwrite   also reset existing entries to the seed
//
// Without --overwrite an entry that already exists in Shopify is left as it is, so edits
// made in Shopify survive a rerun. The live Liquid theme is untouched: it reads none of the
// metaobjects, menus or new collections, the coming-soon products are published to the
// Hydrogen channel only, and URL redirects apply only to paths that would otherwise 404.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { admin, check, HYDROGEN, REPO, scopes } from "./admin.mjs";
import { ensureModel } from "./model.mjs";
import * as SEED from "./seed/content.mjs";
import { TEXT } from "./seed/text.mjs";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const OVERWRITE = args.has("--overwrite");
let PUBLICATION = "Hydrogen"; // PW_PUBLICATION in .env or the environment overrides it

const REQUIRED_SCOPES = [
  "write_products",
  "write_publications",
  "write_files",
  "write_online_store_navigation",
  "write_online_store_pages",
  "write_metaobject_definitions",
  "write_metaobjects",
];

// ─── Operations ────────────────────────────────────────────────────────────────

export const OPS = {
  PUBLICATIONS: `
    query PwPublications {
      publications(first: 50) {
        nodes { id catalog { title } }
      }
    }
  `,
  FILES: `
    query PwFiles($query: String!) {
      files(first: 20, query: $query) {
        nodes {
          id
          fileStatus
          ... on MediaImage { image { url } }
        }
      }
    }
  `,
  FILE_STATUS: `
    query PwFileStatus($id: ID!) {
      node(id: $id) {
        ... on MediaImage { fileStatus image { url } }
      }
    }
  `,
  STAGED_UPLOADS: `
    mutation PwStagedUploads($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }
  `,
  FILE_CREATE: `
    mutation PwFileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id fileStatus }
        userErrors { field message code }
      }
    }
  `,
  METAOBJECTS: `
    query PwMetaobjects($type: String!, $after: String) {
      metaobjects(type: $type, first: 250, after: $after) {
        nodes { id handle }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  METAOBJECT_UPSERT: `
    mutation PwMetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message code }
      }
    }
  `,
  PRODUCTS: `
    query PwProducts($after: String) {
      products(first: 100, after: $after, query: "tag:plainwell") {
        nodes {
          id
          handle
          title
          tags
          options { name optionValues { name } }
          metafields(first: 20, namespace: "plainwell") { nodes { key } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  PRODUCT_SET: `
    mutation PwProductSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input, synchronous: true) {
        product { id handle }
        userErrors { field message code }
      }
    }
  `,
  METAFIELDS_SET: `
    mutation PwMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message code }
      }
    }
  `,
  PAGES: `
    query PwPages {
      pages(first: 100) {
        nodes {
          id
          handle
          seoTitle: metafield(namespace: "global", key: "title_tag") { value }
          seoDescription: metafield(namespace: "global", key: "description_tag") { value }
          sections: metafield(namespace: "plainwell", key: "sections") { value }
        }
      }
    }
  `,
  PAGE_CREATE: `
    mutation PwPageCreate($page: PageCreateInput!) {
      pageCreate(page: $page) {
        page { id handle }
        userErrors { field message code }
      }
    }
  `,
  COLLECTION: `
    query PwCollection($handle: String!) {
      collectionByIdentifier(identifier: { handle: $handle }) { id handle }
    }
  `,
  COLLECTION_CREATE: `
    mutation PwCollectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id handle }
        userErrors { field message }
      }
    }
  `,
  COLLECTION_UPDATE: `
    mutation PwCollectionUpdate($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection { id handle }
        userErrors { field message }
      }
    }
  `,
  COLLECTION_REORDER: `
    mutation PwCollectionReorder($id: ID!, $moves: [MoveInput!]!) {
      collectionReorderProducts(id: $id, moves: $moves) {
        job { id }
        userErrors { field message }
      }
    }
  `,
  PUBLISH: `
    mutation PwPublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `,
  UNPUBLISH: `
    mutation PwUnpublish($id: ID!, $input: [PublicationInput!]!) {
      publishableUnpublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `,
  MENUS: `
    query PwMenus {
      menus(first: 50) {
        nodes { id handle title items { title } }
      }
    }
  `,
  MENU_CREATE: `
    mutation PwMenuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
      menuCreate(title: $title, handle: $handle, items: $items) {
        menu { id }
        userErrors { field message code }
      }
    }
  `,
  MENU_UPDATE: `
    mutation PwMenuUpdate($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
        menu { id }
        userErrors { field message code }
      }
    }
  `,
  REDIRECTS: `
    query PwRedirects($query: String!) {
      urlRedirects(first: 5, query: $query) { nodes { id path target } }
    }
  `,
  REDIRECT_CREATE: `
    mutation PwRedirectCreate($urlRedirect: UrlRedirectInput!) {
      urlRedirectCreate(urlRedirect: $urlRedirect) {
        urlRedirect { id }
        userErrors { field message code }
      }
    }
  `,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

let SITE = ""; // https://<store>.myshopify.com: absolute URLs for link fields; the storefront makes them relative.
const abs = (to) => (/^https?:/.test(to) ? to : `${SITE}${to}`);
const log = (...a) => console.log(...a);
const plan = (what) => log(`  ${APPLY ? "+" : "·"} ${what}${APPLY ? "" : " (would create)"}`);

async function readEnv() {
  const text = await readFile(path.join(HYDROGEN, ".env"), "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^"|"$/g, "")]),
  );
}

/** Rich text from plain text: blank lines separate paragraphs; [label](/path) is a link. */
function richValue(text) {
  const paragraph = (para) => {
    const children = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    for (let m; (m = re.exec(para)); last = re.lastIndex) {
      if (m.index > last) children.push({ type: "text", value: para.slice(last, m.index) });
      children.push({ type: "link", url: abs(m[2]), children: [{ type: "text", value: m[1] }] });
    }
    if (last < para.length) children.push({ type: "text", value: para.slice(last) });
    return { type: "paragraph", children };
  };
  return JSON.stringify({ type: "root", children: text.split(/\n{2,}/).map(paragraph) });
}

async function paginate(query, variables, pick) {
  const out = [];
  for (let after = null; ; ) {
    const conn = pick(await admin(query, { ...variables, after }));
    out.push(...conn.nodes);
    if (!conn.pageInfo?.hasNextPage) return out;
    after = conn.pageInfo.endCursor;
  }
}

// ─── State resolved while running ──────────────────────────────────────────────

const ids = {
  files: {}, // image name → file gid
  products: {}, // handle → product gid
  metaobjects: {}, // `${type}/${handle}` → gid
  pages: {}, // handle → page gid
  collections: {}, // handle → collection gid
};
const vars = {}; // {{live_count}}, {{live_count_words}}

function resolve(value, where) {
  if (value == null) return null;
  // Only seed copy uses {{live_count}}; interface text keeps its own {placeholders}.
  if (typeof value === "string") return value.replace(/\{\{(live_count|live_count_words)\}\}/g, (_, k) => vars[k]);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const list = value.map((v) => resolve(v, where)).filter(Boolean);
    return JSON.stringify(list);
  }
  const need = (map, key, kind) => {
    const id = map[key];
    if (!id) {
      if (APPLY) throw new Error(`${where}: no ${kind} "${key}" in Shopify`);
      return `gid://pending/${kind}/${key}`;
    }
    return id;
  };
  if (value.$img) return need(ids.files, value.$img, "image");
  if (value.$product) return need(ids.products, value.$product, "product");
  if (value.$ref) return need(ids.metaobjects, value.$ref.join("/"), "metaobject");
  if (value.$page) return need(ids.pages, value.$page, "page");
  if (value.$collection) return need(ids.collections, value.$collection, "collection");
  if (value.$url) return abs(value.$url);
  if (value.$link) return JSON.stringify({ text: resolve(value.$link[0]), url: abs(value.$link[1]) });
  if (value.$rich) return richValue(value.$rich);
  throw new Error(`${where}: unknown value ${JSON.stringify(value)}`);
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

async function checkScopes() {
  const have = new Set(await scopes());
  const missing = REQUIRED_SCOPES.filter((s) => !have.has(s));
  if (missing.length) {
    console.error(`The Admin app is missing scopes: ${missing.join(", ")}.`);
    console.error("Add them to the app in the Dev Dashboard, release a new version and install it, then rerun.");
    process.exit(1);
  }
  log("Scopes: ok");
}

async function findPublication() {
  const nodes = (await admin(OPS.PUBLICATIONS)).publications.nodes;
  const match = nodes.find((n) => n.catalog?.title?.toLowerCase().includes(PUBLICATION.toLowerCase()));
  if (!match) throw new Error(`No publication named like "${PUBLICATION}". Found: ${nodes.map((n) => n.catalog?.title).join(", ")}. Set PW_PUBLICATION.`);
  log(`Publication: ${match.catalog.title}`);
  return match.id;
}

async function imageBuffer(name, spec) {
  const src = path.join(REPO, spec.file);
  if (spec.make === "trim") return { data: await sharp(src).trim().png({ compressionLevel: 9 }).toBuffer(), ext: "png", mime: "image/png" };
  if (spec.make === "share") {
    const data = await sharp(src).resize({ width: 1200, height: 630, fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return { data, ext: "jpg", mime: "image/jpeg" };
  }
  if (spec.make === "icon") {
    // The "P" of the wordmark, centred on cream: favicon, touch icon and logo in search.
    const trimmed = await sharp(src).trim().toBuffer({ resolveWithObject: true });
    const lineHeight = Math.round(trimmed.info.height * 0.46);
    const glyph = await sharp(trimmed.data).extract({ left: 0, top: 0, width: Math.round(lineHeight * 0.66), height: lineHeight }).trim().toBuffer();
    const size = 512;
    const inner = Math.round(size * 0.6);
    const g = await sharp(glyph).resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    const data = await sharp({ create: { width: size, height: size, channels: 4, background: "#f6f4ef" } }).composite([{ input: g, gravity: "centre" }]).png({ compressionLevel: 9 }).toBuffer();
    return { data, ext: "png", mime: "image/png" };
  }
  const ext = path.extname(src).slice(1);
  return { data: await readFile(src), ext, mime: ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg" };
}

async function waitForFile(id) {
  for (let i = 0; i < 30; i++) {
    const node = (await admin(OPS.FILE_STATUS, { id })).node;
    if (node?.fileStatus === "READY") return;
    if (node?.fileStatus === "FAILED") throw new Error(`File ${id} failed to process`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`File ${id} is still processing`);
}

/** Uploads an image once (found again by its pw- file name) and returns its file gid. */
async function ensureFile(name, spec) {
  const base = `pw-${name}`;
  const nodes = (await admin(OPS.FILES, { query: `filename:${base}*` })).files.nodes;
  const re = new RegExp(`/${base}(_[^/.]+)?\\.\\w+(\\?|$)`);
  const existing = nodes.find((n) => n.image?.url && re.test(n.image.url));
  if (existing) return existing.id;
  await stat(path.join(REPO, spec.file));
  if (!APPLY) {
    plan(`image ${base}`);
    return null;
  }
  const { data, ext, mime } = await imageBuffer(name, spec);
  const filename = `${base}.${ext}`;
  const target = check(
    "stagedUploadsCreate",
    (await admin(OPS.STAGED_UPLOADS, { input: [{ filename, mimeType: mime, resource: "IMAGE", httpMethod: "POST", fileSize: String(data.length) }] })).stagedUploadsCreate,
  ).stagedTargets[0];
  const form = new FormData();
  for (const { name: key, value } of target.parameters) form.append(key, value);
  form.append("file", new Blob([data], { type: mime }), filename);
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload of ${filename} failed: ${res.status}`);
  const file = check(
    `fileCreate ${filename}`,
    (await admin(OPS.FILE_CREATE, { files: [{ originalSource: target.resourceUrl, alt: spec.alt, contentType: "IMAGE", filename }] })).fileCreate,
  ).files[0];
  await waitForFile(file.id);
  log(`  + image ${filename}`);
  return file.id;
}

async function loadProducts() {
  const nodes = await paginate(OPS.PRODUCTS, {}, (d) => d.products);
  for (const n of nodes) ids.products[n.handle] = n.id;
  return nodes;
}

async function loadMetaobjects(type) {
  const nodes = await paginate(OPS.METAOBJECTS, { type }, (d) => d.metaobjects);
  for (const n of nodes) ids.metaobjects[`${type}/${n.handle}`] = n.id;
}

/** Creates a metaobject unless it exists (or resets it with --overwrite). */
async function upsert(type, handle, fields) {
  const key = `${type}/${handle}`;
  const exists = Boolean(ids.metaobjects[key]);
  if (exists && !OVERWRITE) return;
  const values = Object.entries(fields)
    .map(([k, v]) => ({ key: k, value: resolve(v, key) }))
    .filter((f) => f.value != null && f.value !== "");
  if (!APPLY) {
    if (!exists) plan(`${type} ${handle}`);
    return;
  }
  const res = check(`${key}`, (await admin(OPS.METAOBJECT_UPSERT, { handle: { type, handle }, metaobject: { fields: values } })).metaobjectUpsert);
  ids.metaobjects[key] = res.metaobject.id;
  log(`  ${exists ? "~" : "+"} ${type} ${handle}`);
}

const textHandle = (key) => key.toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function setMetafields(metafields) {
  for (let i = 0; i < metafields.length; i += 25) {
    check("metafieldsSet", (await admin(OPS.METAFIELDS_SET, { metafields: metafields.slice(i, i + 25) })).metafieldsSet);
  }
}

async function publish(id, publicationId, label) {
  check(`publish ${label}`, (await admin(OPS.PUBLISH, { id, input: [{ publicationId }] })).publishablePublish);
}

async function storefrontPolicies(env) {
  const token = env.PUBLIC_STOREFRONT_API_TOKEN;
  const headers = { "content-type": "application/json" };
  if (env.PRIVATE_STOREFRONT_API_TOKEN) headers["Shopify-Storefront-Private-Token"] = env.PRIVATE_STOREFRONT_API_TOKEN;
  else headers["X-Shopify-Storefront-Access-Token"] = token;
  const query = `{ shop {
    privacyPolicy { title handle } refundPolicy { title handle } shippingPolicy { title handle } termsOfService { title handle }
  } }`;
  const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2026-10/graphql.json`, { method: "POST", headers, body: JSON.stringify({ query }) });
  const shop = (await res.json()).data?.shop ?? {};
  return { PRIVACY_POLICY: shop.privacyPolicy, REFUND_POLICY: shop.refundPolicy, SHIPPING_POLICY: shop.shippingPolicy, TERMS_OF_SERVICE: shop.termsOfService };
}

function menuItem(item, policies) {
  const { title, to } = item;
  const children = (item.items ?? []).map((child) => menuItem(child, policies)).filter(Boolean);
  const base = { title, ...(children.length ? { items: children } : {}) };
  if (to.catalog) return { ...base, type: "CATALOG", url: abs("/collections/all") };
  if (to.collection) return { ...base, type: "COLLECTION", resourceId: ids.collections[to.collection] };
  if (to.page) return ids.pages[to.page] ? { ...base, type: "PAGE", resourceId: ids.pages[to.page] } : null;
  if (to.policy) {
    const policy = policies[to.policy];
    return policy ? { ...base, type: "HTTP", url: abs(`/policies/${policy.handle}`) } : null;
  }
  return { ...base, type: "HTTP", url: abs(to.path) };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const env = await readEnv();
  SITE = `https://${env.PUBLIC_STORE_DOMAIN}`;
  PUBLICATION = process.env.PW_PUBLICATION ?? env.PW_PUBLICATION ?? PUBLICATION;
  log(APPLY ? `Applying to ${env.PUBLIC_STORE_DOMAIN}${OVERWRITE ? " (overwriting existing entries)" : ""}` : `Checking ${env.PUBLIC_STORE_DOMAIN} (read-only; --apply to write)`);
  await checkScopes();

  log("Content model");
  if (APPLY) await ensureModel();
  else log("  · definitions are created with --apply");

  const publicationId = await findPublication();

  log("Images");
  for (const [name, spec] of Object.entries(SEED.IMAGES)) {
    const id = await ensureFile(name, spec);
    if (id) ids.files[name] = id;
  }
  for (const product of SEED.COMING_SOON) {
    const name = `product-${product.handle}`;
    const id = await ensureFile(name, { file: product.image, alt: product.title });
    if (id) ids.files[name] = id;
  }

  log("Products");
  const products = await loadProducts();
  const soonHandles = new Set(SEED.COMING_SOON.map((p) => p.handle));
  const live = products.filter((p) => !soonHandles.has(p.handle));
  vars.live_count = String(live.length);
  vars.live_count_words = SEED.countInWords(live.length);
  log(`  ${live.length} Plainwell products on sale`);
  const referenced = new Set([
    ...SEED.ROUTINES.flatMap((r) => r.lines.map((l) => l.handle)),
    ...SEED.SETTINGS.often_added.map((v) => v.$product),
    ...SEED.SECTIONS.flatMap((s) => (s.products ?? []).map((v) => v.$product)),
  ]);
  const missing = [...referenced].filter((h) => !ids.products[h]);
  if (missing.length) throw new Error(`Products referenced by the seed are missing in Shopify: ${missing.join(", ")}`);

  for (const type of ["pw_text", "pw_point", "pw_scent", "pw_teaser", "pw_routine_line", "pw_routine", ...new Set(SEED.SECTIONS.map((s) => s.type)), "pw_settings"]) {
    if (APPLY || (await typeExists(type))) await loadMetaobjects(type);
  }

  log("Scents");
  for (const { handle, ...fields } of SEED.SCENTS) await upsert("pw_scent", handle, fields);

  log("Coming-soon products");
  for (const product of SEED.COMING_SOON) {
    if (ids.products[product.handle] && !OVERWRITE) continue;
    if (!APPLY) {
      plan(`product ${product.handle}`);
      continue;
    }
    const metafields = [
      { namespace: "plainwell", key: "coming_soon", type: "boolean", value: "true" },
      { namespace: "plainwell", key: "family", type: "single_line_text_field", value: product.family },
      { namespace: "plainwell", key: "details", type: "rich_text_field", value: richValue(SEED.detailsFor(product.title, product.size, product.extra)) },
      { namespace: "plainwell", key: "ingredients", type: "rich_text_field", value: richValue(SEED.INGREDIENTS_PLACEHOLDER) },
      { namespace: "plainwell", key: "scent", type: "metaobject_reference", value: resolve(SEED.ref("pw_scent", product.scent), product.handle) },
      ...(SEED.PRODUCT_RITUALS[product.handle]
        ? [{ namespace: "plainwell", key: "ritual_image", type: "file_reference", value: resolve(SEED.PRODUCT_RITUALS[product.handle], product.handle) }]
        : []),
    ];
    const input = {
      title: product.title,
      handle: product.handle,
      status: "ACTIVE",
      vendor: "Plainwell Body Co.",
      productType: product.category,
      tags: ["plainwell", product.category, product.scent, product.family, "coming-soon"],
      descriptionHtml: `<p>${product.description}</p>`,
      productOptions: [{ name: "Size", position: 1, values: [{ name: product.size }] }],
      variants: [{ optionValues: [{ optionName: "Size", name: product.size }], price: "0.00", inventoryPolicy: "DENY", inventoryItem: { tracked: true } }],
      files: [{ id: ids.files[`product-${product.handle}`] }],
      metafields,
    };
    const res = check(`productSet ${product.handle}`, (await admin(OPS.PRODUCT_SET, { identifier: { handle: product.handle }, input })).productSet);
    ids.products[product.handle] = res.product.id;
    await publish(res.product.id, publicationId, product.handle);
    log(`  + ${product.handle}`);
  }

  log("Product details");
  const productMetafields = [];
  for (const product of live) {
    const have = new Set(product.metafields.nodes.map((m) => m.key));
    const size = product.options.find((o) => o.name === "Size")?.optionValues[0]?.name ?? "";
    const scent = SEED.scentOfTags(product.tags);
    const wanted = [
      scent && { key: "scent", type: "metaobject_reference", value: SEED.ref("pw_scent", scent) },
      { key: "family", type: "single_line_text_field", value: SEED.familyOf(product.handle) },
      { key: "details", type: "rich_text_field", value: SEED.rich(SEED.detailsFor(product.title, size)) },
      { key: "ingredients", type: "rich_text_field", value: SEED.rich(SEED.INGREDIENTS_PLACEHOLDER) },
      SEED.PRODUCT_RITUALS[product.handle] && { key: "ritual_image", type: "file_reference", value: SEED.PRODUCT_RITUALS[product.handle] },
    ].filter(Boolean);
    for (const mf of wanted) {
      if (have.has(mf.key) && !OVERWRITE) continue;
      if (!APPLY) {
        plan(`${product.handle} plainwell.${mf.key}`);
        continue;
      }
      productMetafields.push({ ownerId: product.id, namespace: "plainwell", key: mf.key, type: mf.type, value: typeof mf.value === "string" ? mf.value : resolve(mf.value, product.handle) });
    }
  }
  if (productMetafields.length) {
    await setMetafields(productMetafields);
    log(`  + ${productMetafields.length} product metafields`);
  }

  log("Interface text");
  for (const [key, value] of Object.entries(TEXT)) await upsert("pw_text", textHandle(key), { key, value });

  log("Content items");
  const policies = await storefrontPolicies(env);
  for (const [handle, fields] of Object.entries({ ...SEED.POINTS, ...SEED.policyPoints(policies) })) await upsert("pw_point", handle, fields);
  for (const [handle, fields] of Object.entries(SEED.TEASERS)) await upsert("pw_teaser", handle, fields);

  log("Routines");
  for (const routine of SEED.ROUTINES) {
    for (const { handle, ...line } of routine.lines) await upsert("pw_routine_line", `${routine.handle}-${handle}`, line);
    await upsert("pw_routine", routine.handle, {
      name: routine.name,
      scent: routine.scent,
      lines: routine.lines.map((l) => SEED.ref("pw_routine_line", `${routine.handle}-${l.handle}`)),
    });
  }

  log("Sections");
  for (const { type, handle, ...fields } of SEED.SECTIONS) await upsert(type, handle, fields);

  log("Pages");
  const pages = (await admin(OPS.PAGES)).pages.nodes;
  for (const p of pages) ids.pages[p.handle] = p.id;
  for (const seed of SEED.PAGES) {
    const existing = pages.find((p) => p.handle === seed.handle);
    const sections = resolve(seed.sections, `page ${seed.handle}`);
    const seo = [
      seed.seoTitle && { namespace: "global", key: "title_tag", type: "single_line_text_field", value: seed.seoTitle, current: existing?.seoTitle?.value },
      seed.seoDescription && { namespace: "global", key: "description_tag", type: "single_line_text_field", value: seed.seoDescription, current: existing?.seoDescription?.value },
    ].filter(Boolean);
    const sectionsField = { namespace: "plainwell", key: "sections", type: "list.mixed_reference", value: sections, current: existing?.sections?.value };
    if (!existing) {
      if (!APPLY) {
        plan(`page ${seed.handle}`);
        continue;
      }
      const metafields = [sectionsField, ...seo].map(({ current, ...m }) => m);
      const res = check(`page ${seed.handle}`, (await admin(OPS.PAGE_CREATE, { page: { title: seed.title, handle: seed.handle, isPublished: true, body: "", metafields } })).pageCreate);
      ids.pages[seed.handle] = res.page.id;
      log(`  + page ${seed.handle}`);
      continue;
    }
    const updates = [sectionsField, ...seo].filter((m) => !m.current || (OVERWRITE && m.key === "sections"));
    if (!updates.length) continue;
    if (!APPLY) {
      for (const m of updates) plan(`page ${seed.handle} ${m.namespace}.${m.key}`);
      continue;
    }
    await setMetafields(updates.map(({ current, ...m }) => ({ ...m, ownerId: existing.id })));
    log(`  ~ page ${seed.handle} (${updates.map((m) => m.key).join(", ")})`);
  }

  log("Collections");
  for (const seed of SEED.COLLECTIONS) {
    const existing = (await admin(OPS.COLLECTION, { handle: seed.handle })).collectionByIdentifier;
    if (existing) ids.collections[seed.handle] = existing.id;
    if (existing && !OVERWRITE) continue;
    if (!APPLY) {
      plan(`collection ${seed.handle}`);
      continue;
    }
    const imageUrl = (await admin(OPS.FILE_STATUS, { id: ids.files[seed.image] })).node?.image?.url;
    const input = {
      ...(existing ? { id: existing.id } : { handle: seed.handle }),
      title: seed.title,
      descriptionHtml: `<p>${seed.description}</p>`,
      ruleSet: { appliedDisjunctively: false, rules: seed.rules.map((condition) => ({ column: "TAG", relation: "EQUALS", condition })) },
      sortOrder: "MANUAL",
      image: { src: imageUrl, altText: SEED.IMAGES[seed.image].alt },
      seo: { title: seed.title, description: seed.seoDescription },
      metafields: [
        { namespace: "plainwell", key: "eyebrow", type: "single_line_text_field", value: seed.eyebrow },
        { namespace: "plainwell", key: "sections", type: "list.mixed_reference", value: resolve(seed.sections, seed.handle) },
      ],
    };
    const res = existing
      ? check(`collection ${seed.handle}`, (await admin(OPS.COLLECTION_UPDATE, { input })).collectionUpdate)
      : check(`collection ${seed.handle}`, (await admin(OPS.COLLECTION_CREATE, { input })).collectionCreate);
    ids.collections[seed.handle] = res.collection.id;
    await publish(res.collection.id, publicationId, seed.handle);
    if (seed.featured) {
      // Smart collections fill in the background; reorder once the products are in.
      await new Promise((r) => setTimeout(r, 3000));
      const moves = seed.featured.map((h, i) => ({ id: ids.products[h], newPosition: String(i) }));
      const reorder = (await admin(OPS.COLLECTION_REORDER, { id: res.collection.id, moves })).collectionReorderProducts;
      if (reorder.userErrors.length) log(`  ! ${seed.handle}: featured order not set (${reorder.userErrors[0].message}); rerun with --overwrite`);
    }
    log(`  ${existing ? "~" : "+"} collection ${seed.handle}`);
  }

  // The Liquid theme keeps these; the Hydrogen storefront redirects them instead.
  for (const handle of ["plainwell", "frontpage"]) {
    const c = (await admin(OPS.COLLECTION, { handle })).collectionByIdentifier;
    if (!c) continue;
    if (!APPLY) {
      log(`  · would unpublish ${handle} from ${PUBLICATION}`);
      continue;
    }
    check(`unpublish ${handle}`, (await admin(OPS.UNPUBLISH, { id: c.id, input: [{ publicationId }] })).publishableUnpublish);
    log(`  - ${handle} unpublished from ${PUBLICATION}`);
  }

  log("Site settings");
  await upsert("pw_settings", "site", SEED.SETTINGS);

  log("Menus");
  const menus = (await admin(OPS.MENUS)).menus.nodes;
  // Shopify's starter menus are replaced; menus edited since are left alone.
  const STARTER = new Set(["Home", "Catalog", "Contact", "Search", "Your Privacy Choices"]);
  for (const seed of SEED.MENUS) {
    const existing = menus.find((m) => m.handle === seed.handle);
    const isStarter = existing && existing.items.every((i) => STARTER.has(i.title));
    if (existing && !isStarter && !OVERWRITE) continue;
    if (!APPLY) {
      plan(`menu ${seed.handle}${existing ? " (replaces the starter menu)" : ""}`);
      continue;
    }
    const items = seed.items.map((item) => menuItem(item, policies)).filter(Boolean);
    if (existing) check(`menu ${seed.handle}`, (await admin(OPS.MENU_UPDATE, { id: existing.id, title: seed.title, handle: seed.handle, items })).menuUpdate);
    else check(`menu ${seed.handle}`, (await admin(OPS.MENU_CREATE, { title: seed.title, handle: seed.handle, items })).menuCreate);
    log(`  ${existing ? "~" : "+"} menu ${seed.handle}`);
  }

  log("URL redirects");
  for (const redirect of SEED.REDIRECTS) {
    const found = (await admin(OPS.REDIRECTS, { query: `path:${redirect.path}` })).urlRedirects.nodes;
    if (found.some((r) => r.path === redirect.path)) continue;
    if (!APPLY) {
      plan(`redirect ${redirect.path} → ${redirect.target}`);
      continue;
    }
    check(`redirect ${redirect.path}`, (await admin(OPS.REDIRECT_CREATE, { urlRedirect: redirect })).urlRedirectCreate);
    log(`  + ${redirect.path} → ${redirect.target}`);
  }

  log(APPLY ? "Done." : "Check complete. Nothing was written.");
}

const DEFINITION = `query PwDefinition($type: String!) { metaobjectDefinitionByType(type: $type) { id } }`;
async function typeExists(type) {
  return Boolean((await admin(DEFINITION, { type })).metaobjectDefinitionByType);
}
OPS.DEFINITION = DEFINITION;

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
