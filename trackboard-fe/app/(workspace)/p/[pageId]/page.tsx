"use client";

import { use } from "react";
import { PageView } from "@/modules/page";

export default function Page({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  return <PageView pageId={pageId} />;
}
