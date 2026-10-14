import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { jsonToText, ydocToJson, ydocToText } from "../src/index.ts";

function sample(): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("default");
  const h = new Y.XmlElement("heading");
  h.setAttribute("level", 1 as never);
  const ht = new Y.XmlText();
  ht.insert(0, "Meeting notes");
  h.insert(0, [ht]);
  const p = new Y.XmlElement("paragraph");
  const pt = new Y.XmlText();
  pt.insert(0, "Hello ");
  pt.insert(6, "world", { bold: {} });
  p.insert(0, [pt]);
  frag.insert(0, [h, p]);
  return doc;
}

describe("ydocToJson", () => {
  test("matches the getJSON() shape", () => {
    expect(ydocToJson(sample())).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Meeting notes" }] },
        { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world", marks: [{ type: "bold" }] }] },
      ],
    });
  });
  test("empty document", () => {
    expect(ydocToJson(new Y.Doc())).toEqual({ type: "doc" });
  });
});

describe("text", () => {
  test("one line per block", () => {
    expect(ydocToText(sample())).toBe("Meeting notes\nHello world");
  });
  test("nested blocks", () => {
    expect(
      jsonToText({
        type: "doc",
        content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }] }],
      }),
    ).toBe("a");
  });
});
