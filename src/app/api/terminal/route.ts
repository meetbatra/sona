import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { createTerminalSession } from "@/lib/terminal-manager";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  // TODO: Optionally verify that this project belongs to the user via Convex.
  const cwd = process.env.SONA_PROJECTS_ROOT ?? process.cwd();

  const { pty } = createTerminalSession({
    userId,
    projectId,
    cwd,
  });

  // WebSocket upgrade (Node runtime). Next.js 16 supports the standard
  // WebSocket upgrade using the `upgrade` method on the underlying request.
  const { socket, response } = Deno.upgradeWebSocket(req); // This is a placeholder; adjust to your runtime if needed.

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "data" && typeof msg.data === "string") {
        pty.write(msg.data);
      }
      if (msg.type === "resize" && msg.cols && msg.rows) {
        pty.resize(msg.cols, msg.rows);
      }
    } catch {
      // ignore malformed messages
    }
  };

  pty.onData((data) => {
    socket.send(JSON.stringify({ type: "data", data }));
  });

  socket.onclose = () => {
    try {
      pty.kill();
    } catch {
      // ignore
    }
  };

  return response;
}
