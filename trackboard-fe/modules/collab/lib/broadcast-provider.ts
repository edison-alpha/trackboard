import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";

type Message =
  | { t: "update"; update: Uint8Array }
  | { t: "awareness"; update: Uint8Array }
  | { t: "hello"; sv: Uint8Array; reply: boolean };

/**
 * Syncs a Y.Doc and its awareness between tabs of the same browser over BroadcastChannel.
 * Local-mode stand-in for the Hocuspocus server: same Yjs semantics, no network.
 *
 * Handshake: a joining tab sends its state vector ("hello"); each peer answers with the updates
 * the newcomer lacks plus its own state vector, so the newcomer sends back what the peer lacks.
 */
export class BroadcastProvider {
  private readonly channel: BroadcastChannel;
  private destroyed = false;

  constructor(
    name: string,
    readonly doc: Y.Doc,
    readonly awareness: Awareness,
  ) {
    this.channel = new BroadcastChannel(`tb:${name}`);
    this.channel.onmessage = (e: MessageEvent<Message>) => this.receive(e.data);
    doc.on("update", this.onDocUpdate);
    awareness.on("update", this.onAwarenessUpdate);
    window.addEventListener("pagehide", this.onPageHide);
    this.send({ t: "hello", sv: Y.encodeStateVector(doc), reply: false });
    this.broadcastAwareness([doc.clientID]);
  }

  private send(msg: Message) {
    if (!this.destroyed) this.channel.postMessage(msg);
  }

  private receive(msg: Message) {
    switch (msg.t) {
      case "update":
        Y.applyUpdate(this.doc, msg.update, this);
        break;
      case "awareness":
        applyAwarenessUpdate(this.awareness, msg.update, this);
        break;
      case "hello":
        this.send({ t: "update", update: Y.encodeStateAsUpdate(this.doc, msg.sv) });
        if (!msg.reply) this.send({ t: "hello", sv: Y.encodeStateVector(this.doc), reply: true });
        this.broadcastAwareness([...this.awareness.getStates().keys()]);
        break;
    }
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) this.send({ t: "update", update });
  };

  private onAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin !== this) this.broadcastAwareness([...added, ...updated, ...removed]);
  };

  private broadcastAwareness(clients: number[]) {
    if (clients.length) this.send({ t: "awareness", update: encodeAwarenessUpdate(this.awareness, clients) });
  }

  private onPageHide = () => removeAwarenessStates(this.awareness, [this.doc.clientID], "pagehide");

  destroy() {
    this.onPageHide();
    this.destroyed = true;
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    window.removeEventListener("pagehide", this.onPageHide);
    this.channel.close();
  }
}
