"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteStoredDoc, readStoredDoc, writeStoredDoc } from "@/modules/collab";
import { useStore } from "@/lib/store";
import { useWorkspace } from "./components/workspace-provider";
import * as ops from "./lib/pages";
import { pageDocName, type PageMeta, type Person } from "./lib/types";

export function usePages(): ReadonlyMap<string, PageMeta> {
  return useStore(useWorkspace().pages);
}

export function usePage(id: string): PageMeta | undefined {
  return usePages().get(id);
}

export const pageHref = (id: string) => `/p/${id}`;

/** Page actions bound to the current workspace and profile. Components call these, never the Y.Doc directly. */
export function usePageActions() {
  const { doc, profile } = useWorkspace();
  const router = useRouter();

  const create = useCallback(
    (opts: { parentId?: string | null; template?: string | null; title?: string; open?: boolean } = {}) => {
      const id = ops.createPage(doc, { parentId: opts.parentId ?? null, by: profile.id, template: opts.template ?? null, title: opts.title });
      if (opts.open !== false) router.push(pageHref(id));
      return id;
    },
    [doc, profile.id, router],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const source = ops.readAll(doc).get(id);
      if (!source) return;
      const siblings = ops.childrenOf(ops.readAll(doc), source.parentId);
      const copyId = ops.createPage(doc, {
        parentId: source.parentId,
        by: profile.id,
        title: `${ops.displayTitle(source)} (copy)`,
        icon: source.icon,
        index: siblings.findIndex((p) => p.id === id) + 1,
      });
      ops.updatePage(doc, copyId, { cover: source.cover, coverY: source.coverY, fullWidth: source.fullWidth, pageWidth: source.pageWidth, text: source.text }, profile.id);
      try {
        await writeStoredDoc(pageDocName(copyId), await readStoredDoc(pageDocName(id)));
        router.push(pageHref(copyId));
      } catch {
        toast.error("Couldn't copy the page content, so the copy starts empty.");
      }
    },
    [doc, profile.id, router],
  );

  const trash = useCallback(
    (id: string) => {
      const title = ops.displayTitle(ops.readAll(doc).get(id));
      ops.trashPage(doc, id);
      toast(`"${title}" moved to trash`, { action: { label: "Undo", onClick: () => ops.restorePage(doc, id) } });
    },
    [doc],
  );

  const deleteForever = useCallback(
    async (id: string) => {
      const ids = ops.deletePageForever(doc, id);
      await Promise.allSettled(ids.map((pid) => deleteStoredDoc(pageDocName(pid))));
    },
    [doc],
  );

  return useMemo(
    () => ({
      create,
      duplicate,
      trash,
      deleteForever,
      /** Metadata that is not authorship: layout, favorite, template flag. */
      update: (id: string, patch: Partial<Omit<PageMeta, "id" | "editors">>) => ops.updatePage(doc, id, patch),
      /** A content edit: bumps "last updated" and adds this person to the contributors. */
      edit: (id: string, patch: Partial<Omit<PageMeta, "id" | "editors">>) => ops.updatePage(doc, id, patch, profile.id),
      move: (id: string, parentId: string | null, index: number) => ops.movePage(doc, id, parentId, index),
      nudge: (id: string, delta: -1 | 1) => ops.nudgePage(doc, id, delta),
      indent: (id: string, direction: "in" | "out") => ops.indentPage(doc, id, direction),
      restore: (id: string) => ops.restorePage(doc, id),
      toggleFavorite: (id: string) => {
        const p = ops.readAll(doc).get(id);
        if (p) ops.updatePage(doc, id, { favorite: !p.favorite });
      },
    }),
    [doc, profile.id, create, duplicate, trash, deleteForever],
  );
}

/** Name and colour of everyone who has opened this workspace, keyed by profile id. */
export function usePeople(): ReadonlyMap<string, Person> {
  const { doc } = useWorkspace();
  const [people, setPeople] = useState<ReadonlyMap<string, Person>>(() => new Map(ops.peopleOf(doc).entries()));
  useEffect(() => {
    const map = ops.peopleOf(doc);
    const refresh = () => setPeople(new Map(map.entries()));
    refresh();
    map.observe(refresh);
    return () => map.unobserve(refresh);
  }, [doc]);
  return people;
}
