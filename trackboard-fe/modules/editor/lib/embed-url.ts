/* Turns a share link into the provider's embeddable URL. Unknown sites are embedded as given;
   sites that refuse framing show the fallback link in the embed block. */

export type EmbedInfo = { src: string; provider: string };

export function toEmbed(raw: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;

  if (host === "vimeo.com" && /^\/\d+/.test(path)) return { src: `https://player.vimeo.com/video${path.match(/^\/\d+/)![0]}`, provider: "Vimeo" };
  if (host === "loom.com" && path.startsWith("/share/")) return { src: `https://www.loom.com/embed/${path.slice(7)}`, provider: "Loom" };
  if (host === "figma.com" && /^\/(file|design|proto|board)\//.test(path)) return { src: `https://www.figma.com/embed?embed_host=trackboard&url=${encodeURIComponent(url.href)}`, provider: "Figma" };
  if (host === "docs.google.com") {
    const kind = path.split("/")[1];
    const name = kind === "spreadsheets" ? "Google Sheets" : kind === "presentation" ? "Google Slides" : kind === "forms" ? "Google Forms" : "Google Docs";
    return { src: url.href.replace(/\/(edit|view)[^/]*$/, "/preview"), provider: name };
  }
  if (host === "open.spotify.com" && !path.startsWith("/embed")) return { src: `https://open.spotify.com/embed${path}`, provider: "Spotify" };
  if (host === "codepen.io" && path.includes("/pen/")) return { src: url.href.replace("/pen/", "/embed/"), provider: "CodePen" };
  if (host === "miro.com" && path.startsWith("/app/board/")) return { src: url.href.replace("/app/board/", "/app/live-embed/"), provider: "Miro" };
  if (host === "airtable.com" && !path.startsWith("/embed")) return { src: `https://airtable.com/embed${path}`, provider: "Airtable" };
  if (host === "calendar.google.com") return { src: url.href, provider: "Google Calendar" };
  return { src: url.href, provider: host };
}
