# Sona - AI-Powered Code Workspace

Sona is an AI-powered, browser-based code workspace designed for working on real repositories without a heavy backend. Import a GitHub repo or describe what you want to build, let Sona scaffold and edit code with an AI agent, then export changes back to GitHub.

This project is built with **Next.js 16**, **Convex**, **Clerk**, and **Inngest**, with CodeMirror 6 as the editor.

---

## Key Features

### Project Home

When you open Sona (the `/` route):

- You see a clean hero:
  - **Sona** logo
  - Tagline: *"Spin up an AI-powered workspace from GitHub or a prompt."*
- Two primary entry points:
  - **New** &mdash; create a new AI-driven project from a natural language prompt
  - **Import** &mdash; import an existing GitHub repository into Sona
- Behavior for anonymous users:
  - Home route is **public** (no hard redirect to auth)
  - Clicking **New** or **Import** opens the **Clerk sign-in popover** (not a full-page redirect)
  - Projects list is hidden until the user is signed in
- Behavior for signed-in users:
  - **New** and **Import** open their respective dialogs directly
  - A **projects list** appears below the hero so users can quickly resume work
  - Keyboard shortcuts:
    - `⌘J` / `Ctrl+J` &mdash; open *New Project* dialog
    - `⌘I` / `Ctrl+I` &mdash; open *Import from GitHub* dialog
    - `⌘K` / `Ctrl+K` &mdash; open project command dialog

All actions that actually talk to Convex/GitHub are mounted **only** when the user is signed in, so logged-out visitors never trigger backend calls.

---

### Create Projects from a Prompt

Sona lets you spin up projects from a natural language description using the **New Project** dialog.

- Component: `NewProjectDialog`
- API route: `POST /api/projects/create-with-prompt`

Flow:

1. User opens the **New** dialog (via button or `⌘J`).
2. They type a prompt like:
   > "Create a full-stack Next.js app with a REST API for tasks and a Tailwind UI."
3. The dialog calls:

   ```ts
   POST /api/projects/create-with-prompt
   { prompt: string }
   ```

4. On the server:
   - Clerk `auth()` ensures the user is signed in.
   - A random project name is generated via `unique-names-generator`.
   - A new project + initial conversation is created via Convex:
     - `system.createProjectWithConversation`
   - The user's prompt is inserted as the first `user` message.
   - An empty `assistant` message with status `processing` is created.
   - An Inngest event `message/sent` is emitted to let an AI agent process the prompt.
5. The client redirects to `/projects/:projectId`, where the editor + sidebar agent pick up the conversation.

Result: from prompt to live AI-driven project context in one action.

---

### Import from GitHub

Sona can import existing GitHub repositories as projects.

- Component: `ImportGithubDialog`
- API route: `POST /api/github/import`

Flow:

1. User opens **Import** (button or `⌘I`).
2. They paste a GitHub URL (e.g., `https://github.com/owner/repo`).
3. The dialog validates the URL with `zod` + `@tanstack/react-form`.
4. On submit, it calls `/api/github/import` with `{ url }`.
5. On success:
   - A new Sona project is created with the repo contents.
   - User is redirected to `/projects/:projectId`.
6. Error handling:
   - If GitHub isnt connected, it surfaces a toast and offers a **Connect** action that opens the Clerk user profile.
   - Generic errors show a friendly notification.

This makes Sona a thin AI overlay on top of any existing repo.

---

### Code Editing Experience

Sona uses **CodeMirror 6** with a custom setup and extensions built for AI-assisted editing.

- Editor component: `CodeEditor`
- Language selection: `getLanguageExtension(filename)`

Supported languages include:

- **JavaScript / TypeScript** (`.js`, `.jsx`, `.ts`, `.tsx`)
- **HTML** (`.html`)
- **CSS** (`.css`)
- **JSON** (`.json`)
- **Markdown** (`.md`, `.mdx`)
- **Python** (`.py`)
- **YAML** (`.yml`, `.yaml`)
- **SQL** (`.sql`)

Behavior:

- Debounced autosave to Convex (1.5s after the user stops typing)
- Custom theme and minimap via Replit's Codemirror addons
- Binary/unsupported files:
  - If a file has a `storageId` (binary), the editor shows a friendly warning rather than raw bytes.

The editor is embedded in `EditorView`, which:

- Shows a top navigation bar and file breadcrumbs for the active project
- Displays a logo placeholder when no file is selected

---

### AI Sidebar Agent (with Usage-Based Billing)

Each project has a **sidebar AI agent** that can discuss and modify the codebase.

- Component: `ConversationSidebar`
- API routes:
  - `POST /api/messages` &mdash; send a new message to the agent
  - `POST /api/messages/cancel` &mdash; cancel an in-flight response
  - `GET /api/agent/usage` &mdash; fetch current usage for the signed-in user
- Convex functions:
  - `system.getConversationById`
  - `system.createMessage`
  - `system.getProcessingMessages`
  - `system.getRecentMessages`
  - `system.recordAgentRun`
  - `system.getAgentRunCountForMonth`

Key behaviors:

- Messages are persisted in Convex with roles (`user`, `assistant`) and status (`processing`, `completed`, `cancelled`).
- When a new message is sent:
  - Any other `processing` messages for the same project are cancelled (including an Inngest `message/cancel` event).
  - A new `assistant` message with status `processing` is created.
  - An Inngest `message/sent` event is emitted to drive the AI agent.
- The sidebar shows the full conversation with:
  - Streaming/"Thinking..." state for processing messages
  - Copy action on the latest completed assistant response
- A **Past Conversations** dialog lets users switch between conversations inside a project.

---

### Usage-Based Billing (Clerk Billing Integration)

Sona enforces monthly usage limits on the sidebar agent using **Clerk Billing features** and Convex.

#### Plans & Limits

Plans are inferred from Clerk via a Billing feature:

- `free` plan (no `{ plan: "pro" }` feature): **5 runs / calendar month**
- `pro` plan (feature `{ plan: "pro" }` present): **15 runs / calendar month**

Implementation:

- `src/lib/billing.ts`
  - Uses `auth()` from `@clerk/nextjs/server` and `has({ plan: "pro" })` to decide:

    ```ts
    export type Plan = "free" | "pro";

    export const PLAN_LIMITS: Record<Plan, number> = {
      free: 5,
      pro: 15,
    };
    ```

- Usage tracking is stored in Convex:
  - Table: `agentRuns` (one record per sidebar agent run)
  - Query: `getAgentRunCountForMonth` (counts runs by `userId` and calendar month in UTC)
  - Mutation: `recordAgentRun` (inserts a new run when a sidebar agent request is accepted)

- Enforcement happens in `POST /api/messages`:

  - The API checks **before** creating messages:
    - Resolve plan via Clerk (`getUserPlan`) and map to a limit.
    - Query Convex for `usage.count` for the current month.
    - If `usage.count >= limit`, return `402` with `code: "usage_limit_exceeded"`.
  - On success, after creating the assistant placeholder message, the API calls `recordAgentRun` so usage is updated.

#### Usage Meter UI

In `ConversationSidebar`, above the input area:

- Usage meter shows:

  ```text
  Free · 3/5 runs
  ```

  or

  ```text
  Pro · 7/15 runs
  ```

- Tooltip on hover: `Usage resets on the 1st of each month`
- **Upgrade** button:
  - Only shown for non-Pro users.
  - Uses Clerk's official `openUserProfile({ path: "#billing" })` to navigate to the Billing section within the Clerk User Profile.

The meter updates in real-time:

- On initial mount via `GET /api/agent/usage`
- After every successful run
- Immediately if the API returns `usage_limit_exceeded`

---

### Projects, Files, and Binary Assets (Convex)

Convex schema and functions in `convex/system.ts` and `convex/schema.ts` manage projects and files:

- `projects` table: project metadata (name, ownerId, import/export status, settings)
- `files` table:
  - Text files vs folders (`type: "file" | "folder"`)
  - Binary files with `storageId` for Convex storage
  - Indexed by project and optional parent folder

Key operations:

- `createFile`, `createFiles`, `createFolder`, `renameFile`, `deleteFile`
- `getProjectFiles`, `getProjectFilesWithUrls`, `getFileById`
- Binary files: `createBinaryFile`, `generateUploadUrl`
- Cleanup: `cleanup` removes all files (and storage) for a project

The frontend uses hooks like `useFiles`, `useCreateFile`, `useRenameFile`, etc., to drive a React-based file explorer.

---

### Auth & Access Control

Sona uses **Clerk** for authentication and session management:

- `src/proxy.ts` (Clerk middleware) ensures most routes are protected, while explicitly allowing:
  - `/` (home) as public
  - `/api/inngest(.*)`

- `ConvexProviderWithClerk` wraps the app and passes `useAuth` into Convex so queries and mutations are scoped to the logged-in user.
- UI behaviors:
  - Signed-out users see the home screen but not projects or agent interactions.
  - Attempting to create/import projects or use the agent prompts Clerk's sign-in modal.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Editor**: CodeMirror 6 with custom extensions (minimap, indentation markers, custom theme)
- **Backend**:
  - **Convex** for realtime database + storage + functions
  - **Inngest** for background agent processing (jobs triggered from `/api/messages`)
- **Auth & Billing**: Clerk (auth + Billing features for `free`/`pro` plans)
- **AI**: `ai` SDK + providers (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **GitHub**: Import/Export via custom API routes and `octokit` (GitHub REST API)

---

## Getting Started (Local Development)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   Create a `.env.local` with at least:

   ```bash
   NEXT_PUBLIC_CONVEX_URL=...        # Convex deployment URL
   SONA_CONVEX_INTERNAL_KEY=...      # Internal key shared between Next and Convex

   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   ```

   And any GitHub / AI provider keys you use in the app.

3. Run Convex dev server:

   ```bash
   npx convex dev
   ```

4. Run Next dev server:

   ```bash
   npm run dev
   ```

5. Open the app:

   - Visit `http://localhost:3000`
   - Log in with Clerk
   - Create a project from a prompt or import a GitHub repo

---

## Deployment Notes

Sona is designed to deploy cleanly on **Vercel**:

- Next.js app can be deployed directly via Vercel.
- Convex should be deployed via Convex's own deployment workflow and pointed to from `NEXT_PUBLIC_CONVEX_URL`.
- Clerk keys and Convex internal key must be configured in Vercel environment variables.

The only stateful/billing-sensitive part is the sidebar agent usage, which relies on:

- Clerk Billing features (`has({ plan: "pro" })`)
- Convex `agentRuns` table and the `getAgentRunCountForMonth` / `recordAgentRun` functions

Ensure your Clerk Billing configuration matches the assumptions in `src/lib/billing.ts` before going to production.
