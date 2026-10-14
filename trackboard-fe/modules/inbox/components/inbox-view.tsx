"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { cx } from "@/lib/cx";
import { formatDateTime, timeAgo } from "@/lib/time";
import { requestThread } from "@/modules/comments";
import { Topbar } from "@/modules/shell";
import { pageHref } from "@/modules/workspace";
import { useInbox, type InboxEntry } from "../hooks";

const ACTION: Record<InboxEntry["kind"], string> = {
  comment: "commented on",
  reply: "replied in a thread on",
  mention: "mentioned you in",
  share: "shared with you",
};

/** Everything addressed to you: comments on your pages, replies to your threads, and mentions. */
export function InboxView() {
  const { items, unread, markRead, markAllRead } = useInbox();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const visible = filter === "unread" ? items.filter((i) => i.unread) : items;

  const open = (item: InboxEntry) => {
    markRead([item.id]);
    if (item.threadId) requestThread(item.pageId, item.threadId);
  };

  return (
    <>
      <Topbar />
      <main className="mx-auto w-full max-w-[720px] px-4 pt-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 px-1">
          <h1 className="mr-auto text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">Inbox</h1>
          <div role="tablist" aria-label="Filter notifications" className="flex rounded-full bg-surface-2 p-0.5 text-sm font-medium">
            {(
              [
                ["all", "All"],
                ["unread", `Unread${unread ? ` ${unread}` : ""}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cx("h-8 rounded-full px-3.5 transition-colors pointer-coarse:h-10", filter === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="glass" onClick={markAllRead} disabled={unread === 0}>
            Mark all as read
          </Button>
        </div>

        {visible.length === 0 ? (
          filter === "unread" && items.length > 0 ? (
            <EmptyState title="You're all caught up" body="Nothing new since you last looked. Earlier notifications are under All." />
          ) : (
            <EmptyState
              title="No notifications yet"
              body="When someone comments on a page you created, replies in a thread you started, or mentions you with @, it shows up here."
            />
          )
        ) : (
          <ul className="mt-4">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={pageHref(item.pageId)}
                  onClick={() => open(item)}
                  className="flex gap-3 rounded-(--radius-card) px-3 py-3.5 transition-colors hover:bg-surface-2/70 sm:px-4"
                >
                  <Avatar name={item.by.name} color={item.by.color} size={36} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug text-ink-2">
                      <span className="font-semibold text-ink">{item.by.name}</span> {ACTION[item.kind]}{" "}
                      <span className="font-semibold text-ink">
                        {item.pageIcon ? `${item.pageIcon} ` : ""}
                        {item.pageTitle}
                      </span>
                    </span>
                    {item.quote && <span className="mt-1 line-clamp-1 block border-l-2 border-line-strong pl-2.5 text-[13px] text-ink-3">{item.quote}</span>}
                    {item.preview && <span className="mt-1 line-clamp-2 block text-[15px] leading-relaxed text-ink">{item.preview}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <time dateTime={new Date(item.at).toISOString()} title={formatDateTime(item.at)} className="text-xs text-ink-3">
                      {timeAgo(item.at)}
                    </time>
                    {item.unread && <span aria-label="Unread" className="size-2.5 rounded-full bg-accent" />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
