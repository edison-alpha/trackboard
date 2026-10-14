"use client";

import { use } from "react";
import { PublicPageView } from "@/modules/public/components/public-page-view";

export default function PublicPageRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <PublicPageView token={token} />;
}
