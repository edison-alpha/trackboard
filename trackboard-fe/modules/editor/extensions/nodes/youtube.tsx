"use client";

import { getEmbedUrlFromYoutubeUrl, Youtube as YoutubeExtension } from "@tiptap/extension-youtube";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ResizableMedia } from "../../components/resizable-media";

function YoutubeView({ node, selected, updateAttributes, extension }: ReactNodeViewProps) {
  const { src, start, width } = node.attrs as { src: string; start: number; width?: number };
  const o = extension.options as Record<string, unknown>;
  const embedUrl = getEmbedUrlFromYoutubeUrl({
    url: src,
    allowFullscreen: o.allowFullscreen as boolean,
    autoplay: o.autoplay as boolean,
    ccLanguage: o.ccLanguage as string | undefined,
    ccLoadPolicy: o.ccLoadPolicy as boolean | undefined,
    controls: o.controls as boolean,
    disableKBcontrols: o.disableKBcontrols as boolean,
    enableIFrameApi: o.enableIFrameApi as boolean,
    endTime: o.endTime as number,
    interfaceLanguage: o.interfaceLanguage as string | undefined,
    ivLoadPolicy: o.ivLoadPolicy as number,
    loop: o.loop as boolean,
    modestBranding: o.modestBranding as boolean,
    nocookie: o.nocookie as boolean,
    origin: o.origin as string,
    playlist: o.playlist as string,
    progressBarColor: o.progressBarColor as string | undefined,
    startAt: start || 0,
    rel: o.rel as number,
  });

  return (
    <NodeViewWrapper className="tb-media-node" data-youtube-video="" data-drag-handle>
      <ResizableMedia widthPct={typeof width === "number" ? width : 100} onResize={(pct) => updateAttributes({ width: pct })} selected={selected}>
        <iframe src={embedUrl ?? undefined} className="tb-video" allowFullScreen={o.allowFullscreen as boolean} title="YouTube video" />
      </ResizableMedia>
    </NodeViewWrapper>
  );
}

/** Adds a resizable width (percent of the column, dragged from either edge) on top of the stock Youtube node. */
export const Youtube = YoutubeExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (el) => {
          const value = el.getAttribute("data-width");
          return value ? Number(value) : 100;
        },
        renderHTML: (attrs) => (attrs.width && attrs.width !== 100 ? { "data-width": attrs.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView);
  },
});
