"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiRequest } from "../lib/actions";
import { AiError, streamAi } from "../lib/stream";

export type AiRunState =
  | { status: "idle" }
  | { status: "streaming"; text: string }
  | { status: "done"; text: string; cut: boolean }
  | { status: "error"; text: string; message: string };

/** One AI run at a time: start, stream text in, stop, retry. Unmounting cancels the run. */
export function useAiRun() {
  const [state, setState] = useState<AiRunState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const last = useRef<AiRequest | null>(null);

  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState((s) => (s.status === "streaming" ? { status: "done", text: s.text, cut: true } : s));
  }, []);

  const run = useCallback(async (req: AiRequest) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    last.current = req;
    let text = "";
    setState({ status: "streaming", text });
    try {
      for await (const e of streamAi(req, ac.signal)) {
        if (ac.signal.aborted) return;
        if (e.t === "delta") {
          text += e.v;
          setState({ status: "streaming", text });
        } else if (e.t === "done") {
          setState({ status: "done", text: text.trim(), cut: e.cut });
        } else {
          setState({ status: "error", text, message: e.message });
        }
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      setState({ status: "error", text, message: err instanceof AiError ? err.message : "Something went wrong. Try again." });
    } finally {
      if (controller.current === ac) controller.current = null;
    }
  }, []);

  const retry = useCallback(() => last.current && run(last.current), [run]);
  const reset = useCallback(() => {
    controller.current?.abort();
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, run, stop, retry, reset };
}
