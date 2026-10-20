// Plainwell's content model in Shopify: metaobject definitions (sections, scents, routines,
// interface text, site settings) and the metafield definitions on pages, collections and
// products that point at them. Every definition is readable by the Storefront API.
//
// Page and collection content is a list of sections (list.mixed_reference). The site has a
// component per section type that renders its design; every word and image comes from the
// section's fields in Shopify.
import { admin, check } from "./admin.mjs";

const S = "single_line_text_field";
const M = "multi_line_text_field";
const RICH = "rich_text_field";
const IMAGE = "file_reference";
const LINK = "link";

const f = (key, name, type, extra = {}) => ({ key, name, type, ...extra });
const ref = (key, name, type, list = false) => ({ key, name, type: list ? "list.metaobject_reference" : "metaobject_reference", refType: type });

/** Building blocks, created before the types that reference them. */
export const BASE_TYPES = [
  {
    type: "pw_text",
    name: "Interface text",
    description: "Every word of the site's interface: buttons, labels, messages. Key = where it is used.",
    displayNameKey: "key",
    fields: [f("key", "Key", S, { required: true }), f("value", "Text", M)],
  },
  {
    type: "pw_point",
    name: "Content item",
    description: "A titled piece of text: a list item, FAQ question and answer, fact, or accordion row.",
    displayNameKey: "title",
    fields: [f("title", "Title", S), f("body", "Body", RICH)],
  },
  {
    type: "pw_scent",
    name: "Scent family",
    description: "A scent family: its name, how it reads, and the ritual photograph shown with it.",
    displayNameKey: "name",
    fields: [
      f("name", "Name", S, { required: true }),
      f("note", "Note", S),
      f("short_note", "Short note", S),
      f("ritual_image", "Ritual photograph", IMAGE),
      f("link", "Link", LINK),
      f("sort", "Sort order", "number_integer"),
    ],
  },
  {
    type: "pw_teaser",
    name: "Teaser",
    description: "A linked card: image, eyebrow, title and a line of text.",
    displayNameKey: "title",
    fields: [f("eyebrow", "Eyebrow", S), f("title", "Title", S), f("body", "Text", M), f("image", "Image", IMAGE), f("url", "Link", "url")],
  },
  {
    type: "pw_routine_line",
    name: "Routine line",
    description: "One product in a routine and how many of it each household size gets.",
    displayNameKey: "label",
    fields: [
      f("label", "Label", S),
      f("product", "Product", "product_reference", { required: true }),
      f("qty_1", "Quantity: 1 person", "number_integer"),
      f("qty_2", "Quantity: 2 people", "number_integer"),
      f("qty_3", "Quantity: 3 people", "number_integer"),
      f("qty_4", "Quantity: 4 or more", "number_integer"),
      f("travel", "Travel size (toggle)", "boolean"),
    ],
  },
];

/** Section types: one component each on the site. */
export const SECTION_TYPES = [
  {
    type: "pw_hero",
    name: "Section: hero",
    displayNameKey: "heading",
    fields: [f("eyebrow", "Eyebrow", S), f("heading", "Heading", M), f("body", "Text", M), f("image", "Photograph", IMAGE), f("primary_link", "Primary button", LINK), f("secondary_link", "Secondary button", LINK)],
  },
  {
    type: "pw_statement",
    name: "Section: statement",
    displayNameKey: "text",
    fields: [f("eyebrow", "Eyebrow", S), f("text", "Statement", M), f("link", "Link", LINK)],
  },
  {
    type: "pw_page_head",
    name: "Section: page heading",
    displayNameKey: "heading",
    fields: [f("eyebrow", "Eyebrow", S), f("heading", "Heading", M), f("intro", "Introduction", M), f("align", "Alignment (left or center)", S)],
  },
  {
    type: "pw_banner",
    name: "Section: full-width photograph",
    displayNameKey: "name",
    fields: [f("name", "Name", S), f("image", "Photograph", IMAGE)],
  },
  {
    type: "pw_product_grid",
    name: "Section: product grid",
    displayNameKey: "heading",
    fields: [f("heading", "Heading", S), f("link", "Link", LINK), f("products", "Products", "list.product_reference")],
  },
  {
    type: "pw_split",
    name: "Section: photograph and text",
    displayNameKey: "heading",
    fields: [
      f("eyebrow", "Eyebrow", S),
      f("heading", "Heading", M),
      f("body", "Text", RICH),
      f("image", "Photograph", IMAGE),
      f("link", "Button", LINK),
      f("tone", "Background (olive or paper)", S),
    ],
  },
  {
    type: "pw_scent_tiles",
    name: "Section: scent families",
    displayNameKey: "heading",
    refs: [ref("scents", "Scents", "pw_scent", true)],
    fields: [f("heading", "Heading", M), f("intro", "Introduction", M)],
  },
  {
    type: "pw_feature",
    name: "Section: featured set",
    description: "A photograph with a card listing products and their total.",
    displayNameKey: "heading",
    fields: [f("eyebrow", "Eyebrow", S), f("heading", "Heading", S), f("image", "Photograph", IMAGE), f("products", "Products", "list.product_reference"), f("link", "Button", LINK)],
  },
  {
    type: "pw_teasers",
    name: "Section: teasers",
    displayNameKey: "heading",
    refs: [ref("items", "Teasers", "pw_teaser", true)],
    fields: [f("heading", "Heading", S), f("link", "Link", LINK)],
  },
  {
    type: "pw_points",
    name: "Section: points row",
    displayNameKey: "name",
    refs: [ref("items", "Points", "pw_point", true)],
    fields: [f("name", "Name", S)],
  },
  {
    type: "pw_label_split",
    name: "Section: label explainer",
    description: "Photograph beside a numbered list and a facts card.",
    displayNameKey: "eyebrow",
    refs: [ref("items", "Numbered items", "pw_point", true), ref("facts", "Facts", "pw_point", true)],
    fields: [f("eyebrow", "Eyebrow", S), f("image", "Photograph", IMAGE), f("card_eyebrow", "Card eyebrow", S), f("card_title", "Card title", S)],
  },
  {
    type: "pw_faq",
    name: "Section: questions",
    displayNameKey: "side_eyebrow",
    refs: [ref("items", "Questions", "pw_point", true)],
    fields: [f("side_eyebrow", "Side eyebrow", S), f("side_text", "Side text", M), f("side_link", "Side link", LINK)],
  },
  {
    type: "pw_article",
    name: "Section: article",
    displayNameKey: "name",
    refs: [ref("items", "Paragraphs", "pw_point", true)],
    fields: [f("name", "Name", S), f("link", "Button", LINK)],
  },
  {
    type: "pw_contact",
    name: "Section: contact",
    displayNameKey: "name",
    refs: [ref("items", "Topics", "pw_point", true)],
    fields: [f("name", "Name", S)],
  },
  {
    type: "pw_accordion",
    name: "Section: accordion",
    displayNameKey: "name",
    refs: [ref("items", "Rows", "pw_point", true)],
    fields: [f("name", "Name", S), f("link", "Link", LINK)],
  },
  {
    type: "pw_routine_finder",
    name: "Section: routine finder",
    displayNameKey: "name",
    refs: [ref("routines", "Routines (one per scent)", "pw_routine", true)],
    fields: [f("name", "Name", S), f("household_image", "Household step photograph", IMAGE), f("summary_image", "Summary photograph", IMAGE)],
  },
];

/** Types that reference section or routine types; created after them. */
export const LATE_TYPES = [
  {
    type: "pw_routine",
    name: "Routine",
    description: "The products for one scent family's routine.",
    displayNameKey: "name",
    refs: [ref("scent", "Scent", "pw_scent"), ref("lines", "Lines", "pw_routine_line", true)],
    fields: [f("name", "Name", S)],
  },
  {
    type: "pw_settings",
    name: "Site settings",
    description: "Logos, sharing image, shipping figures and the collection used for Shop all. One entry, handle 'site'.",
    displayNameKey: "name",
    fields: [
      f("name", "Name", S),
      f("logo", "Logo (on light)", IMAGE),
      f("logo_on_dark", "Logo (on dark)", IMAGE),
      f("icon", "Site icon", IMAGE),
      f("share_image", "Default sharing image (1200x630)", IMAGE),
      f("not_found_image", "Page-not-found photograph", IMAGE),
      f("free_shipping_threshold", "Free shipping from (order subtotal)", "number_decimal"),
      f("standard_shipping_rate", "Standard shipping rate", "number_decimal"),
      f("shop_all", "Shop all collection", "collection_reference"),
      f("home_page", "Home page", "page_reference"),
      f("often_added", "Often added (bag page)", "list.product_reference"),
      f("announcement", "Announcement bar", S),
    ],
  },
];

/** Metafield definitions on Shopify resources. `sections` accept every section type. */
export const METAFIELDS = [
  { ownerType: "PAGE", namespace: "plainwell", key: "sections", name: "Sections", type: "list.mixed_reference", sections: true },
  { ownerType: "COLLECTION", namespace: "plainwell", key: "eyebrow", name: "Eyebrow", type: S },
  { ownerType: "COLLECTION", namespace: "plainwell", key: "sections", name: "Sections below the products", type: "list.mixed_reference", sections: true },
  { ownerType: "PRODUCT", namespace: "plainwell", key: "scent", name: "Scent family", type: "metaobject_reference", refType: "pw_scent" },
  { ownerType: "PRODUCT", namespace: "plainwell", key: "family", name: "Product family (scent switch)", type: S },
  { ownerType: "PRODUCT", namespace: "plainwell", key: "coming_soon", name: "Coming soon", type: "boolean" },
  { ownerType: "PRODUCT", namespace: "plainwell", key: "details", name: "Details", type: RICH },
  { ownerType: "PRODUCT", namespace: "plainwell", key: "ingredients", name: "Ingredients", type: RICH },
  { ownerType: "PRODUCT", namespace: "plainwell", key: "ritual_image", name: "Ritual photograph", type: IMAGE },
];

const DEFINITION_BY_TYPE = `
  query PlainwellDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      fieldDefinitions { key }
    }
  }
`;

const DEFINITION_CREATE = `
  mutation PlainwellDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id }
      userErrors { field message code }
    }
  }
`;

const DEFINITION_UPDATE = `
  mutation PlainwellDefinitionUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id }
      userErrors { field message code }
    }
  }
`;

const METAFIELD_DEFINITIONS = `
  query PlainwellMetafieldDefinitions($ownerType: MetafieldOwnerType!, $namespace: String!) {
    metafieldDefinitions(first: 50, ownerType: $ownerType, namespace: $namespace) {
      nodes { id key }
    }
  }
`;

const METAFIELD_DEFINITION_CREATE = `
  mutation PlainwellMetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id }
      userErrors { field message code }
    }
  }
`;

const STANDARD_DEFINITION_ENABLE = `
  mutation PlainwellStandardDefinitionEnable($ownerType: MetafieldOwnerType!, $namespace: String!, $key: String!) {
    standardMetafieldDefinitionEnable(ownerType: $ownerType, namespace: $namespace, key: $key, access: { storefront: PUBLIC_READ }) {
      createdDefinition { id }
      userErrors { field message code }
    }
  }
`;

function fieldInput(field, ids) {
  const validations = [];
  if (field.refType) validations.push({ name: "metaobject_definition_id", value: ids[field.refType] });
  if (field.type === IMAGE) validations.push({ name: "file_type_options", value: JSON.stringify(["Image"]) });
  const { key, name, type, required } = field;
  return { key, name, type, required: Boolean(required), ...(validations.length ? { validations } : {}) };
}

async function ensureDefinition(def, ids) {
  const fields = [...(def.refs ?? []), ...def.fields];
  const existing = (await admin(DEFINITION_BY_TYPE, { type: def.type })).metaobjectDefinitionByType;
  if (!existing) {
    const created = check(
      `create ${def.type}`,
      (
        await admin(DEFINITION_CREATE, {
          definition: {
            type: def.type,
            name: def.name,
            description: def.description,
            displayNameKey: def.displayNameKey,
            access: { storefront: "PUBLIC_READ" },
            fieldDefinitions: fields.map((field) => fieldInput(field, ids)),
          },
        })
      ).metaobjectDefinitionCreate,
    );
    ids[def.type] = created.metaobjectDefinition.id;
    console.log(`  + ${def.type}`);
    return;
  }
  ids[def.type] = existing.id;
  const have = new Set(existing.fieldDefinitions.map((d) => d.key));
  const missing = fields.filter((field) => !have.has(field.key));
  if (missing.length) {
    check(
      `update ${def.type}`,
      (
        await admin(DEFINITION_UPDATE, {
          id: existing.id,
          definition: { access: { storefront: "PUBLIC_READ" }, fieldDefinitions: missing.map((field) => ({ create: fieldInput(field, ids) })) },
        })
      ).metaobjectDefinitionUpdate,
    );
    console.log(`  ~ ${def.type} (+${missing.map((m) => m.key).join(", ")})`);
  } else {
    console.log(`  = ${def.type}`);
  }
}

/** Creates or extends every definition. Returns { type: definitionId }. */
export async function ensureModel() {
  const ids = {};
  // pw_routine is referenced by the finder section, so it must exist first; it has no
  // section references itself, so create it with the base types.
  const routine = LATE_TYPES.find((t) => t.type === "pw_routine");
  for (const def of [...BASE_TYPES, routine]) await ensureDefinition(def, ids);
  for (const def of SECTION_TYPES) await ensureDefinition(def, ids);
  for (const def of LATE_TYPES.filter((t) => t !== routine)) await ensureDefinition(def, ids);

  const sectionIds = SECTION_TYPES.map((t) => ids[t.type]);
  for (const mf of METAFIELDS) {
    const existing = (await admin(METAFIELD_DEFINITIONS, { ownerType: mf.ownerType, namespace: mf.namespace })).metafieldDefinitions.nodes;
    if (existing.some((d) => d.key === mf.key)) {
      console.log(`  = ${mf.ownerType} ${mf.namespace}.${mf.key}`);
      continue;
    }
    const validations = [];
    if (mf.sections) validations.push({ name: "metaobject_definition_ids", value: JSON.stringify(sectionIds) });
    if (mf.refType) validations.push({ name: "metaobject_definition_id", value: ids[mf.refType] });
    if (mf.type === IMAGE) validations.push({ name: "file_type_options", value: JSON.stringify(["Image"]) });
    check(
      `metafield ${mf.ownerType} ${mf.key}`,
      (
        await admin(METAFIELD_DEFINITION_CREATE, {
          definition: {
            ownerType: mf.ownerType,
            namespace: mf.namespace,
            key: mf.key,
            name: mf.name,
            type: mf.type,
            pin: true,
            access: { storefront: "PUBLIC_READ" },
            ...(validations.length ? { validations } : {}),
          },
        })
      ).metafieldDefinitionCreate,
    );
    console.log(`  + ${mf.ownerType} ${mf.namespace}.${mf.key}`);
  }

  // Shopify's standard review metafields, filled by review apps.
  for (const key of ["rating", "rating_count"]) {
    const res = (await admin(STANDARD_DEFINITION_ENABLE, { ownerType: "PRODUCT", namespace: "reviews", key })).standardMetafieldDefinitionEnable;
    const taken = res.userErrors?.some((e) => /taken|already/i.test(e.message));
    if (!taken) check(`reviews.${key}`, res);
    console.log(`  ${taken ? "=" : "+"} PRODUCT reviews.${key}`);
  }
  return ids;
}

export const OPERATIONS = { DEFINITION_BY_TYPE, DEFINITION_CREATE, DEFINITION_UPDATE, METAFIELD_DEFINITIONS, METAFIELD_DEFINITION_CREATE, STANDARD_DEFINITION_ENABLE };
