import { describe, expect, test } from "bun:test";
import { atLeast, computeAccess, docName, pageDocName, parseDocName, type Permission, type Visibility, type WorkspaceRole } from "../src/index.ts";

describe("parseDocName", () => {
  test("accepts page documents", () => {
    expect(parseDocName(docName("ws1234567", pageDocName("abc123xyz")))).toEqual({ workspaceId: "ws1234567", local: "page:abc123xyz", pageId: "abc123xyz" });
  });
  test("rejects anything else", () => {
    expect(parseDocName("page:abc123xyz")).toBeNull();
    expect(parseDocName("ws1234567/page:")).toBeNull();
    expect(parseDocName("ws1234567/page:../etc")).toBeNull();
    expect(parseDocName("ws1234567/workspace:default")).toBeNull();
    expect(parseDocName("../x/page:abc123xyz")).toBeNull();
    expect(parseDocName("")).toBeNull();
  });
});

type In = { createdBy?: string; visibility?: Visibility; workspacePermission?: Permission; share?: Permission | null; role?: WorkspaceRole | null; userId?: string };
const access = (i: In) => computeAccess({ userId: "me", createdBy: "other", visibility: "private", workspacePermission: "edit", share: null, role: null, ...i });

describe("computeAccess", () => {
  test("the creator manages their page, private or not", () => {
    expect(access({ createdBy: "me" })).toBe("manage");
    expect(access({ createdBy: "me", visibility: "workspace" })).toBe("manage");
  });

  test("a private page is invisible to workspace members, owners and admins included", () => {
    for (const role of ["member", "admin", "owner"] as const) expect(access({ role })).toBe("none");
  });

  test("a workspace page gives members the workspace permission and owners/admins manage", () => {
    expect(access({ visibility: "workspace", role: "member", workspacePermission: "view" })).toBe("view");
    expect(access({ visibility: "workspace", role: "member", workspacePermission: "edit" })).toBe("edit");
    expect(access({ visibility: "workspace", role: "admin", workspacePermission: "view" })).toBe("manage");
    expect(access({ visibility: "workspace", role: "owner" })).toBe("manage");
  });

  test("a workspace page is not open to people outside the workspace", () => {
    expect(access({ visibility: "workspace", role: null })).toBe("none");
  });

  test("a direct share works for guests and on private pages, and the best grant wins", () => {
    expect(access({ share: "view" })).toBe("view");
    expect(access({ share: "edit", role: null })).toBe("edit");
    expect(access({ visibility: "workspace", role: "member", workspacePermission: "view", share: "edit" })).toBe("edit");
    expect(access({ visibility: "workspace", role: "member", workspacePermission: "edit", share: "view" })).toBe("edit");
  });

  test("atLeast orders none < view < edit < manage", () => {
    expect(atLeast("view", "view")).toBe(true);
    expect(atLeast("view", "edit")).toBe(false);
    expect(atLeast("manage", "edit")).toBe(true);
    expect(atLeast("none", "view")).toBe(false);
  });
});
