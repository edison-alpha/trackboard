import type { ChainedCommands, Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { CaretCircleRight, CheckSquare, Code, Info, ListBullets, ListNumbers, Quotes, TextHFour, TextHOne, TextHThree, TextHTwo, TextT } from "@/components/icons";

export type BlockType = {
  label: string;
  icon: ReactNode;
  active: (e: Editor) => boolean;
  /** Appends the conversion to a chain; the caller decides what is selected first. */
  apply: (c: ChainedCommands) => ChainedCommands;
};

/** One list of "turn into" targets, shared by the selection toolbar and the block handle menu. */
export const BLOCK_TYPES: BlockType[] = [
  { label: "Text", icon: <TextT size={16} />, active: (e) => e.isActive("paragraph"), apply: (c) => c.setParagraph() },
  { label: "Heading 1", icon: <TextHOne size={16} />, active: (e) => e.isActive("heading", { level: 1 }), apply: (c) => c.setHeading({ level: 1 }) },
  { label: "Heading 2", icon: <TextHTwo size={16} />, active: (e) => e.isActive("heading", { level: 2 }), apply: (c) => c.setHeading({ level: 2 }) },
  { label: "Heading 3", icon: <TextHThree size={16} />, active: (e) => e.isActive("heading", { level: 3 }), apply: (c) => c.setHeading({ level: 3 }) },
  { label: "Heading 4", icon: <TextHFour size={16} />, active: (e) => e.isActive("heading", { level: 4 }), apply: (c) => c.setHeading({ level: 4 }) },
  { label: "Bulleted list", icon: <ListBullets size={16} />, active: (e) => e.isActive("bulletList"), apply: (c) => c.toggleBulletList() },
  { label: "Numbered list", icon: <ListNumbers size={16} />, active: (e) => e.isActive("orderedList"), apply: (c) => c.toggleOrderedList() },
  { label: "To-do list", icon: <CheckSquare size={16} />, active: (e) => e.isActive("taskList"), apply: (c) => c.toggleTaskList() },
  { label: "Quote", icon: <Quotes size={16} />, active: (e) => e.isActive("blockquote"), apply: (c) => c.toggleBlockquote() },
  { label: "Code block", icon: <Code size={16} />, active: (e) => e.isActive("codeBlock"), apply: (c) => c.toggleCodeBlock() },
  { label: "Callout", icon: <Info size={16} />, active: (e) => e.isActive("callout"), apply: (c) => c.setCallout("info") },
  { label: "Toggle", icon: <CaretCircleRight size={16} />, active: (e) => e.isActive("details"), apply: (c) => c.setDetails() },
];
