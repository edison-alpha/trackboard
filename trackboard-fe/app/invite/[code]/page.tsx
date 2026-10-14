"use client";

import { use } from "react";
import { InvitePage } from "@/modules/sharing/components/invite-page";

export default function InviteRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <InvitePage code={code} />;
}
