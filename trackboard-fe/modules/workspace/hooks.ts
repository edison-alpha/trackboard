"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { PageMeta, PagePatch, PagesIndex, Person, Visibility } from "@/lib/api/types";
import { createId } from "@/lib/id";
import { dropLocalDocs } from "@/modules/collab";
import { useWorkspace } from "./components/workspace-provider";
import { childrenOf, descendantIds, displayTitle, positionAt } from "./lib/pages";
import { pageDocName, scopedDocName, type PageMap } from "./lib/types";
import { pagesQuery } from "./queries";

const EMPTY_PAGES: PageMap = new Map();
const EMPTY_PEOPLE: ReadonlyMap<string, Person> = new Map();

const toPageMap = (index: PagesIndex): PageMap => new Map(index.pages.map((p) => [p.id, p]));
const toPeopleMap = (index: PagesIndex): ReadonlyMap<string, Person> => new Map(index.people.map((p) => [p.id, p]));

/** Every page this person may see in the open workspace, by id. */
export function usePages(): PageMap {
  const { workspaceId } = useWorkspace();
  return useQuery({ ...pagesQuery(workspaceId), select: toPageMap }).data ?? EMPTY_PAGES;
}

export function usePage(id: string): PageMeta | undefined {
  return usePages().get(id);
}

/** Name and colour of everyone who appears on these pages: members, creators, contributors. */
export function usePeople(): ReadonlyMap<string, Person> {
  const { workspaceId } = useWorkspace();
  return useQuery({ ...pagesQuery(workspaceId), select: toPeopleMap }).data ?? EMPTY_PEOPLE;
}

export const pageHref = (id: string) => `/p/${id}`;

type Context = { previous: PagesIndex | undefined };

/**
 * Everything a person does to pages. Each action updates the list on screen at once, sends the change to the server,
 * puts the screen back if the server refuses, and refetches the real list either way.
 */
export function usePageActions() {
  const { workspaceId, profile } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = keys.pages(workspaceId);

  /** Edits the cached list immediately and remembers it as it was, so a refusal can undo exactly this. */
  const optimistic = async (edit: (pages: PageMeta[]) => PageMeta[]): Promise<Context> => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<PagesIndex>(key);
    if (previous) queryClient.setQueryData<PagesIndex>(key, { ...previous, pages: edit(previous.pages) });
    return { previous };
  };
  const rollback = (_error: unknown, _vars: unknown, context: Context | undefined) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous);
  };
  const refetch = () => queryClient.invalidateQueries({ queryKey: key });
  const adopt = (meta: PageMeta) => queryClient.setQueryData<PagesIndex>(key, (d) => d && { ...d, pages: d.pages.some((p) => p.id === meta.id) ? d.pages.map((p) => (p.id === meta.id ? meta : p)) : [...d.pages, meta] });
  const patchLocal = (id: string, patch: Partial<PageMeta>) => (pages: PageMeta[]) => pages.map((p) => (p.id === id ? { ...p, ...patch } : p));

  const createM = useMutation<PageMeta, Error, { id: string; parentId: string | null; title?: string; icon?: string | null; template?: string | null; position: number; visibility?: Visibility }, Context>({
    mutationFn: (v) => api<PageMeta>("/api/pages", { body: { ...v, workspaceId } }),
    onMutate: (v) =>
      optimistic((pages) => {
        const parent = pages.find((p) => p.id === v.parentId);
        const now = Date.now();
        const draft: PageMeta = {
          id: v.id, workspaceId, parentId: v.parentId, title: v.title ?? "", icon: v.icon ?? null, cover: null, coverY: 50, position: v.position, pageWidth: "center", fullWidth: false,
          template: v.template ?? null, visibility: parent?.visibility ?? v.visibility ?? "private", workspacePermission: parent?.workspacePermission ?? "edit", publicToken: null, createdAt: now,
          createdBy: profile.id, updatedAt: now, deletedAt: null, preview: "", favorite: false, access: "manage", editors: { [profile.id]: now }, linkedTickets: [],
        };
        return [...pages, draft];
      }),
    onSuccess: adopt,
    onError: rollback,
    onSettled: refetch,
  });

  const updateM = useMutation<PageMeta, Error, { id: string; patch: PagePatch }, Context>({
    mutationFn: ({ id, patch }) => api<PageMeta>(`/api/pages/${id}`, { method: "PATCH", body: patch }),
    onMutate: ({ id, patch }) => optimistic(patchLocal(id, patch as Partial<PageMeta>)),
    onSuccess: adopt,
    onError: rollback,
    onSettled: refetch,
  });

  const moveM = useMutation<PageMeta, Error, { id: string; parentId: string | null; position: number }, Context>({
    mutationFn: ({ id, ...to }) => api<PageMeta>(`/api/pages/${id}/move`, { body: to }),
    onMutate: ({ id, parentId, position }) => optimistic(patchLocal(id, { parentId, position })),
    onSuccess: adopt,
    onError: rollback,
    onSettled: refetch,
  });

  const trashM = useMutation<PageMeta, Error, string, Context>({
    mutationFn: (id) => api<PageMeta>(`/api/pages/${id}/trash`, { method: "POST" }),
    onMutate: (id) => optimistic(patchLocal(id, { deletedAt: Date.now() })),
    onSuccess: adopt,
    onError: rollback,
    onSettled: refetch,
  });

  const restoreM = useMutation<PageMeta, Error, string, Context>({
    mutationFn: (id) => api<PageMeta>(`/api/pages/${id}/restore`, { method: "POST" }),
    onMutate: (id) => optimistic(patchLocal(id, { deletedAt: null })),
    onSuccess: adopt,
    onError: rollback,
    onSettled: refetch,
  });

  const purgeM = useMutation<unknown, Error, string, Context>({
    mutationFn: (id) => api("/api/pages/purge", { body: { ids: [id] } }),
    onMutate: (id) =>
      optimistic((pages) => {
        const gone = new Set([id, ...descendantIds(new Map(pages.map((p) => [p.id, p])), id)]);
        // The offline copies of the deleted documents go too, so nothing of them stays on this device.
        void dropLocalDocs([...gone].map((pid) => scopedDocName(workspaceId, pageDocName(pid))));
        return pages.filter((p) => !gone.has(p.id));
      }),
    onError: rollback,
    onSettled: refetch,
  });

  const favoriteM = useMutation<unknown, Error, { id: string; on: boolean }, Context>({
    mutationFn: ({ id, on }) => api(`/api/pages/${id}/favorite`, { method: on ? "PUT" : "DELETE" }),
    onMutate: ({ id, on }) => optimistic(patchLocal(id, { favorite: on })),
    onError: rollback,
    onSettled: refetch,
  });

  const duplicateM = useMutation<PageMeta, Error, { id: string; to: string }>({
    mutationFn: ({ id, to }) => api<PageMeta>(`/api/pages/${id}/duplicate`, { body: { to } }),
    onSuccess: (meta) => {
      adopt(meta);
      router.push(pageHref(meta.id));
    },
    onError: () => toast.error("Couldn't copy the page."),
    onSettled: refetch,
  });

  const pagesNow = (): PageMap => new Map((queryClient.getQueryData<PagesIndex>(key)?.pages ?? []).map((p) => [p.id, p]));

  const { mutate: create } = createM;
  const { mutate: update } = updateM;
  const { mutate: move } = moveM;
  const { mutate: trashPage } = trashM;
  const { mutate: restore } = restoreM;
  const { mutate: purge } = purgeM;
  const { mutate: setFavorite } = favoriteM;
  const { mutate: duplicate } = duplicateM;

  return useMemo(() => {
    const moveTo = (id: string, parentId: string | null, index: number) => {
      const pages = pagesNow();
      if (parentId === id || (parentId && descendantIds(pages, id).includes(parentId))) return false;
      const siblings = childrenOf(pages, parentId).filter((p) => p.id !== id);
      move({ id, parentId, position: positionAt(siblings, Math.max(0, Math.min(index, siblings.length))) });
      return true;
    };
    return {
      create: (opts: { parentId?: string | null; template?: string | null; title?: string; icon?: string | null; open?: boolean; index?: number; visibility?: Visibility } = {}) => {
        const id = createId();
        const siblings = childrenOf(pagesNow(), opts.parentId ?? null);
        create({ id, parentId: opts.parentId ?? null, title: opts.title ?? "", icon: opts.icon ?? null, template: opts.template ?? null, position: positionAt(siblings, opts.index ?? siblings.length), ...(opts.visibility && { visibility: opts.visibility }) });
        if (opts.open !== false) router.push(pageHref(id));
        return id;
      },
      duplicate: (id: string) => duplicate({ id, to: createId() }),
      trash: (id: string) => {
        const title = displayTitle(pagesNow().get(id));
        trashPage(id, { onSuccess: () => toast(`"${title}" moved to trash`, { action: { label: "Undo", onClick: () => restore(id) } }) });
      },
      deleteForever: (id: string) => purge(id),
      /** Metadata and writing alike: the server decides which one counts as an edit. */
      update: (id: string, patch: PagePatch) => update({ id, patch }),
      edit: (id: string, patch: PagePatch) => update({ id, patch }),
      move: moveTo,
      nudge: (id: string, delta: -1 | 1) => {
        const pages = pagesNow();
        const page = pages.get(id);
        if (!page) return;
        const siblings = childrenOf(pages, page.parentId);
        const target = siblings.findIndex((p) => p.id === id) + delta;
        if (target < 0 || target >= siblings.length) return;
        moveTo(id, page.parentId, delta === 1 ? target + 1 : target);
      },
      indent: (id: string, direction: "in" | "out") => {
        const pages = pagesNow();
        const page = pages.get(id);
        if (!page) return;
        if (direction === "in") {
          const siblings = childrenOf(pages, page.parentId);
          const prev = siblings[siblings.findIndex((p) => p.id === id) - 1];
          if (prev) moveTo(id, prev.id, childrenOf(pages, prev.id).length);
        } else if (page.parentId) {
          const parent = pages.get(page.parentId);
          const uncles = childrenOf(pages, parent?.parentId ?? null);
          moveTo(id, parent?.parentId ?? null, uncles.findIndex((p) => p.id === page.parentId) + 1);
        }
      },
      restore: (id: string) => restore(id),
      toggleFavorite: (id: string) => {
        const page = pagesNow().get(id);
        if (page) setFavorite({ id, on: !page.favorite });
      },
    };
    // The mutate functions are stable; reading the latest list happens through the query cache at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, update, move, trashPage, restore, purge, setFavorite, duplicate, router, queryClient, key]);
}
