import type { ReactNode } from "react";
import { Link } from "react-router";

import type { RichNode } from "~/lib/content";

/**
 * Plain interface text with optional [label](/url) links, as a rich text tree. Lets short
 * texts such as "See our [privacy policy](/policies/privacy-policy)." carry a link.
 */
export function parseRich(text: string): RichNode | null {
  if (!text) return null;
  const paragraphs = text.split(/\n{2,}/).map((para) => {
    const children: RichNode[] = [];
    const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let last = 0;
    for (let m = re.exec(para); m; m = re.exec(para)) {
      if (m.index > last) children.push({ type: "text", value: para.slice(last, m.index) });
      children.push({ type: "link", url: m[2], children: [{ type: "text", value: m[1] }] });
      last = m.index + m[0].length;
    }
    if (last < para.length) children.push({ type: "text", value: para.slice(last) });
    return { type: "paragraph", children };
  });
  return { type: "root", children: paragraphs };
}

type Props = {
  node: RichNode | null | undefined;
  /** Render paragraphs as inline spans (for one-line contexts). */
  inline?: boolean;
  className?: string;
  paragraphClassName?: string;
  linkClassName?: string;
};

/** Renders Shopify rich text (metafield rich_text_field JSON) with the site's typography. */
export function RichText({ node, inline, className, paragraphClassName, linkClassName = "pw-link" }: Props) {
  if (!node) return null;
  const render = (n: RichNode, key: number): ReactNode => {
    const children = n.children?.map(render);
    switch (n.type) {
      case "root":
        return inline ? <>{children}</> : <div className={className}>{children}</div>;
      case "paragraph":
        return inline ? <span key={key}>{children}</span> : <p key={key} className={paragraphClassName}>{children}</p>;
      case "heading": {
        const Tag = `h${Math.min(6, Math.max(2, n.level ?? 3))}` as "h2";
        return <Tag key={key}>{children}</Tag>;
      }
      case "list":
        return n.listType === "ordered" ? <ol key={key} className="list-decimal ps-5">{children}</ol> : <ul key={key} className="list-disc ps-5">{children}</ul>;
      case "list-item":
        return <li key={key}>{children}</li>;
      case "link": {
        const url = n.url ?? "";
        return url.startsWith("/") ? (
          <Link key={key} to={url} className={linkClassName} title={n.title}>
            {children}
          </Link>
        ) : (
          <a key={key} href={url} className={linkClassName} title={n.title} rel="noopener">
            {children}
          </a>
        );
      }
      case "text": {
        let out: ReactNode = n.value;
        if (n.bold) out = <strong>{out}</strong>;
        if (n.italic) out = <em>{out}</em>;
        return <span key={key}>{out}</span>;
      }
      default:
        return <span key={key}>{children}</span>;
    }
  };
  return <>{render(node, 0)}</>;
}
