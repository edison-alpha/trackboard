"use client";

import { FileText } from "@/components/icons";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import Link from "next/link";
import { displayTitle, pageHref, usePages } from "@/modules/workspace";

/** Page mentions always show the page's current title and icon, so renaming a page updates every link to it. */
export function MentionView({ node }: ReactNodeViewProps) {
  const pages = usePages();
  const id = String(node.attrs.id ?? "");

  if (id.startsWith("page:")) {
    const page = pages.get(id.slice(5));
    const missing = !page || page.deletedAt !== null;
    return (
      <NodeViewWrapper as="span" className="tb-mention tb-mention-page" data-missing={missing || undefined}>
        {missing ? (
          <span title="This page was deleted" className="line-through">
            {String(node.attrs.label ?? "Deleted page")}
          </span>
        ) : (
          <Link href={pageHref(page.id)} contentEditable={false} draggable={false}>
            <span className="tb-mention-icon" aria-hidden="true">
              {page.icon ?? <FileText size={15} />}
            </span>
            {displayTitle(page)}
          </Link>
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="tb-mention tb-mention-person">
      @{String(node.attrs.label ?? "")}
    </NodeViewWrapper>
  );
}
