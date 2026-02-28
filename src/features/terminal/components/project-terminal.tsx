"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface ProjectTerminalProps {
  projectId: string;
}

export function ProjectTerminal({ projectId }: ProjectTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "var(--font-plex-mono, monospace)",
      theme: {
        background: "#050509",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/api/terminal?projectId=${projectId}`;
    const socket = new WebSocket(url);

    socket.onopen = () => {
      term.focus();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "data" && typeof msg.data === "string") {
          term.write(msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      term.write("\r\n\x1b[31mConnection closed\x1b[0m\r\n");
    };

    term.onData((data) => {
      socket.send(JSON.stringify({ type: "data", data }));
    });

    const handleResize = () => {
      fitAddon.fit();
      const cols = term.cols;
      const rows = term.rows;
      socket.send(
        JSON.stringify({ type: "resize", cols, rows }),
      );
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.close();
      term.dispose();
    };
  }, [projectId]);

  return <div className="h-full w-full bg-black" ref={containerRef} />;
}
