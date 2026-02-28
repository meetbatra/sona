import { randomUUID } from "crypto";
import type { IPty } from "node-pty";
import pty from "node-pty";

interface TerminalSession {
  id: string;
  pty: IPty;
  userId: string;
  projectId: string;
}

const sessions = new Map<string, TerminalSession>();

export function createTerminalSession(options: {
  userId: string;
  projectId: string;
  cwd: string;
}) {
  const id = randomUUID();
  const shell = process.env.SHELL || "bash";

  const term = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: options.cwd,
    env: process.env,
  });

  const session: TerminalSession = {
    id,
    pty: term,
    userId: options.userId,
    projectId: options.projectId,
  };

  sessions.set(id, session);

  term.onExit(() => {
    sessions.delete(id);
  });

  return session;
}

export function getTerminalSession(id: string) {
  return sessions.get(id) ?? null;
}

export function killTerminalSession(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  session.pty.kill();
  sessions.delete(id);
}
