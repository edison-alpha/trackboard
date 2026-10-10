/** File-type recognition for attachment cards and the preview dialog: an extension/MIME pair maps to an
 * Iconify glyph (vscode-icons, loaded at runtime from the Iconify API — not bundled, unlike the chrome icon set
 * in components/icons.tsx) and a preview strategy. */

export type PreviewKind = "pdf" | "image" | "audio" | "video" | "text" | "office" | "archive" | "other";

type FileTypeInfo = { icon: string; label: string; preview: PreviewKind };

const BY_EXT: Record<string, FileTypeInfo> = {
  pdf: { icon: "vscode-icons:file-type-pdf2", label: "PDF document", preview: "pdf" },

  doc: { icon: "vscode-icons:file-type-word", label: "Word document", preview: "office" },
  docx: { icon: "vscode-icons:file-type-word", label: "Word document", preview: "office" },
  odt: { icon: "vscode-icons:file-type-word", label: "Word document", preview: "office" },
  rtf: { icon: "vscode-icons:file-type-word", label: "Rich text document", preview: "office" },

  xls: { icon: "vscode-icons:file-type-excel", label: "Excel spreadsheet", preview: "office" },
  xlsx: { icon: "vscode-icons:file-type-excel", label: "Excel spreadsheet", preview: "office" },
  ods: { icon: "vscode-icons:file-type-excel", label: "Spreadsheet", preview: "office" },
  csv: { icon: "vscode-icons:file-type-excel", label: "CSV spreadsheet", preview: "text" },

  ppt: { icon: "vscode-icons:file-type-powerpoint", label: "PowerPoint presentation", preview: "office" },
  pptx: { icon: "vscode-icons:file-type-powerpoint", label: "PowerPoint presentation", preview: "office" },
  odp: { icon: "vscode-icons:file-type-powerpoint", label: "Presentation", preview: "office" },

  md: { icon: "vscode-icons:file-type-markdown", label: "Markdown file", preview: "text" },
  markdown: { icon: "vscode-icons:file-type-markdown", label: "Markdown file", preview: "text" },
  mdx: { icon: "vscode-icons:file-type-markdown", label: "Markdown file", preview: "text" },

  txt: { icon: "vscode-icons:file-type-text", label: "Text file", preview: "text" },
  json: { icon: "vscode-icons:file-type-json", label: "JSON file", preview: "text" },
  yml: { icon: "vscode-icons:file-type-yaml", label: "YAML file", preview: "text" },
  yaml: { icon: "vscode-icons:file-type-yaml", label: "YAML file", preview: "text" },
  xml: { icon: "vscode-icons:file-type-xml", label: "XML file", preview: "text" },
  html: { icon: "vscode-icons:file-type-html", label: "HTML file", preview: "text" },
  css: { icon: "vscode-icons:file-type-css", label: "CSS file", preview: "text" },
  scss: { icon: "vscode-icons:file-type-scss", label: "SCSS file", preview: "text" },
  js: { icon: "vscode-icons:file-type-js", label: "JavaScript file", preview: "text" },
  mjs: { icon: "vscode-icons:file-type-js", label: "JavaScript file", preview: "text" },
  jsx: { icon: "vscode-icons:file-type-reactjs", label: "JavaScript file", preview: "text" },
  ts: { icon: "vscode-icons:file-type-typescript", label: "TypeScript file", preview: "text" },
  tsx: { icon: "vscode-icons:file-type-reactts", label: "TypeScript file", preview: "text" },
  py: { icon: "vscode-icons:file-type-python", label: "Python file", preview: "text" },
  rb: { icon: "vscode-icons:file-type-ruby", label: "Ruby file", preview: "text" },
  go: { icon: "vscode-icons:file-type-go", label: "Go file", preview: "text" },
  rs: { icon: "vscode-icons:file-type-rust", label: "Rust file", preview: "text" },
  java: { icon: "vscode-icons:file-type-java", label: "Java file", preview: "text" },
  c: { icon: "vscode-icons:file-type-c", label: "C file", preview: "text" },
  cpp: { icon: "vscode-icons:file-type-cpp", label: "C++ file", preview: "text" },
  sh: { icon: "vscode-icons:file-type-shell", label: "Shell script", preview: "text" },

  png: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  jpg: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  jpeg: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  gif: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  webp: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  bmp: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  avif: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" },
  svg: { icon: "vscode-icons:file-type-svg", label: "SVG image", preview: "image" },

  mp3: { icon: "vscode-icons:file-type-audio", label: "Audio", preview: "audio" },
  wav: { icon: "vscode-icons:file-type-audio", label: "Audio", preview: "audio" },
  ogg: { icon: "vscode-icons:file-type-audio", label: "Audio", preview: "audio" },
  m4a: { icon: "vscode-icons:file-type-audio", label: "Audio", preview: "audio" },
  flac: { icon: "vscode-icons:file-type-audio", label: "Audio", preview: "audio" },

  mp4: { icon: "vscode-icons:file-type-video", label: "Video", preview: "video" },
  mov: { icon: "vscode-icons:file-type-video", label: "Video", preview: "video" },
  webm: { icon: "vscode-icons:file-type-video", label: "Video", preview: "video" },
  mkv: { icon: "vscode-icons:file-type-video", label: "Video", preview: "video" },
  avi: { icon: "vscode-icons:file-type-video", label: "Video", preview: "video" },

  zip: { icon: "vscode-icons:file-type-zip", label: "Archive", preview: "archive" },
  rar: { icon: "vscode-icons:file-type-zip", label: "Archive", preview: "archive" },
  "7z": { icon: "vscode-icons:file-type-zip", label: "Archive", preview: "archive" },
  tar: { icon: "vscode-icons:file-type-zip", label: "Archive", preview: "archive" },
  gz: { icon: "vscode-icons:file-type-zip", label: "Archive", preview: "archive" },
};

const MIME_FALLBACK: { test: (mime: string) => boolean; info: FileTypeInfo }[] = [
  { test: (m) => m === "application/pdf", info: BY_EXT.pdf! },
  { test: (m) => m.startsWith("image/"), info: { icon: "vscode-icons:file-type-image", label: "Image", preview: "image" } },
  { test: (m) => m.startsWith("audio/"), info: { icon: "vscode-icons:file-type-audio", label: "Audio", preview: "audio" } },
  { test: (m) => m.startsWith("video/"), info: { icon: "vscode-icons:file-type-video", label: "Video", preview: "video" } },
  { test: (m) => m.startsWith("text/"), info: { icon: "vscode-icons:file-type-text", label: "Text file", preview: "text" } },
  { test: (m) => m.includes("word"), info: BY_EXT.docx! },
  { test: (m) => m.includes("sheet") || m.includes("excel"), info: BY_EXT.xlsx! },
  { test: (m) => m.includes("presentation") || m.includes("powerpoint"), info: BY_EXT.pptx! },
  { test: (m) => m.includes("zip") || m.includes("compressed"), info: BY_EXT.zip! },
];

const DEFAULT_INFO: FileTypeInfo = { icon: "vscode-icons:default-file", label: "File", preview: "other" };

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

function fileTypeInfo(name: string, mime: string): FileTypeInfo {
  const byExt = BY_EXT[fileExt(name)];
  if (byExt) return byExt;
  const byMime = mime && MIME_FALLBACK.find((m) => m.test(mime));
  if (byMime) return byMime.info;
  return DEFAULT_INFO;
}

export function fileIcon(name: string, mime: string): string {
  return fileTypeInfo(name, mime).icon;
}

export function fileLabel(name: string, mime: string): string {
  return fileTypeInfo(name, mime).label;
}

export function filePreviewKind(name: string, mime: string): PreviewKind {
  return fileTypeInfo(name, mime).preview;
}

/** Decodes a data: URL produced by readFile() back into text, for the text/code/markdown preview. */
export function decodeDataUrlText(dataUrl: string): string {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
