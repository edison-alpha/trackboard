"use client";

import { useQuery } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import { Logo } from "@/components/brand/logo";
import { InlineLoader } from "@/components/brand/loading-screen";
import { ErrorState } from "@/components/ui/states";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { PublicPage } from "@/lib/api/types";
import { cx } from "@/lib/cx";
import { buildExtensions } from "@/modules/editor/extensions";
import { COVERS } from "@/modules/page/lib/covers";

function Body({ page }: { page: PublicPage }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: buildExtensions({}),
    content: page.content as Record<string, unknown>,
    editorProps: { attributes: { class: "tb-prose" } },
  });
  return <EditorContent editor={editor} />;
}

/** A page shared with a public link: read-only, no account, no sidebar. */
export function PublicPageView({ token }: { token: string }) {
  const page = useQuery({
    queryKey: keys.publicPage(token),
    queryFn: () => api<PublicPage>(`/api/public/${encodeURIComponent(token)}`),
    retry: false,
    // Read once per visit; the owner can switch the link off at any time, and a reload then says so.
    staleTime: 60_000,
  });

  if (page.isPending) return <InlineLoader label="Opening page" />;
  if (page.isError) return <ErrorState title="This page isn't available" body="The link may have been turned off, or the page was deleted." />;

  const p = page.data;
  const preset = COVERS.find((c) => c.id === p.cover);
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Logo />
        <a href="/" className="text-sm text-ink-3 hover:text-ink">
          Open Trackdocs
        </a>
      </header>
      {p.cover && (
        <div
          role="img"
          aria-label="Page cover"
          className="h-40 w-full sm:h-56"
          style={{ background: preset ? preset.css : `center ${p.coverY}% / cover no-repeat url("${p.cover.replace(/"/g, "%22")}")` }}
        />
      )}
      <main className={cx("mx-auto w-full px-5 pt-8 pb-24 sm:px-12", p.pageWidth === "full" ? "max-w-none" : "max-w-[760px]")}>
        {p.icon && <div className="mb-2 text-[58px] leading-none">{p.icon}</div>}
        <h1 className="mb-6 text-[30px] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-[40px]">{p.title.trim() || "Untitled"}</h1>
        <Body page={p} />
      </main>
    </div>
  );
}
