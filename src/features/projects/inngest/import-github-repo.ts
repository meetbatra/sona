import ky from "ky";
import {NonRetriableError} from "inngest";
import {Octokit} from "octokit";
import {isBinaryFile} from "isbinaryfile";

import {inngest} from "@/inngest/client";
import {convex} from "@/lib/convex-client";
import {Id} from "../../../../convex/_generated/dataModel";
import {api} from "../../../../convex/_generated/api";

interface ImportGithubRepoEvent {
    owner: string;
    repo: string;
    projectId: Id<"projects">;
    githubToken: string;
}

export const importGithubRepo = inngest.createFunction(
    {
        id: "import-github-repo",
        onFailure: async ({ event, step }) => {
            const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;
            if(!internalKey) return;

            const { projectId } = event.data.event.data as ImportGithubRepoEvent;

            await step.run("set-failed-status", async () => {
                await convex.mutation(api.system.updateImportStatus, {
                    internalKey,
                    projectId,
                    status: "failed",
                });
            });
        },
    },
    { event: "github/import.repo"},
    async ({ event, step }) => {
        const { projectId, repo, owner, githubToken } = event.data as ImportGithubRepoEvent;

        const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;
        if(!internalKey){
            throw new NonRetriableError("SONA_CONVEX_INTERNAL_KEY is not configured");
        }

        const octokit = new Octokit({ auth: githubToken });

        await step.run("cleanup-project", async () => {
            await convex.mutation(api.system.cleanup, {
                internalKey,
                projectId
            })
        });

        const tree = await step.run("fetch-repo-tree", async () => {
            try {
                const { data } = await octokit.rest.git.getTree({
                    owner,
                    repo,
                    tree_sha: "main",
                    recursive: "1"
                });

                return data;
            } catch {
                const { data } = await octokit.rest.git.getTree({
                    owner,
                    repo,
                    tree_sha: "master",
                    recursive: "1"
                });

                return data;
            }
        });

        const folders = tree.tree
            .filter((item) => item.type === "tree" && item.path)
            .sort((a,b) => {
                const aDepth = a.path ? a.path.split("/").length : 0;
                const bDepth = b.path ? b.path.split("/").length : 0;

                return aDepth - bDepth;
            });

        const folderIdMap = await step.run("create-folders", async () => {
            const map: Record< string, Id<"files">> = {};

            for(const folder of folders){
                if(!folder.path){
                    continue;
                }

                const pathParts = folder.path.split("/");
                const name = pathParts.pop()!;
                const parentPath = pathParts.join("/");
                const parentId = parentPath ? map[parentPath] : undefined;

                const folderId = await convex.mutation(api.system.createFolder, {
                    internalKey,
                    projectId,
                    name,
                    parentId,
                });

                map[folder.path] = folderId;
            }

            return map;
        });

        const allFiles = tree.tree.filter(
            (item) => item.type === "blob" && item.path && item.sha
        );

        await step.run("create-files", async () => {
            for(const file of allFiles){
                if(!file.path || !file.sha){
                    continue;
                }

                try {
                    const {data:blob} = await octokit.rest.git.getBlob({
                        owner,
                        repo,
                        file_sha: file.sha,
                    });

                    const buffer = Buffer.from(blob.content, "base64");
                    const isBinary = await isBinaryFile(buffer);

                    const pathParts = file.path.split("/");
                    const name = pathParts.pop()!;
                    const parentPath = pathParts.join("/");
                    const parentId = parentPath ? folderIdMap[parentPath] : undefined;

                    if(isBinary){
                        const uploadUrl = await convex.mutation(api.system.generateUploadUrl, {
                            internalKey,
                        });

                        const { storageId } = await ky
                            .post(uploadUrl, {
                                headers: { "Content-Type": "application/octet-stream" },
                                body: buffer
                            }).json<{ storageId: Id<"_storage"> }>();

                        await convex.mutation(api.system.createBinaryFile, {
                            internalKey,
                            projectId,
                            name,
                            storageId,
                            parentId,
                        });
                    } else {
                        const content = buffer.toString("utf-8");

                        await convex.mutation(api.system.createFile, {
                            internalKey,
                            projectId,
                            name,
                            content,
                            parentId,
                        })
                    }
                } catch {
                    console.error(`Failed to import file: ${file.path}`);
                }
            }
        });

        await step.run("set-completed-status", async () => {
            await convex.mutation(api.system.updateImportStatus, {
                internalKey,
                projectId,
                status: "completed",
            });
        });

        return { success: true, projectId }
    }
);