import {createTool} from "@inngest/agent-kit";
import {z} from "zod";

import {convex} from "@/lib/convex-client";
import {Id} from "../../../../../convex/_generated/dataModel";
import {api} from "../../../../../convex/_generated/api";

interface ListFilesToolOptions{
    internalKey: string;
    projectId: Id<"projects">;
}

export const createListFilesTool = ({
    internalKey,
    projectId,
}: ListFilesToolOptions) => {
    return createTool({
        name: "list-files",
        description: "List all files and folders in the project. Returns names, IDs, types, and parentId for each item. Items with parentId: null are at root level. Use the parentId to understand the folder structure - items with the same parentId are in the same folder.",
        parameters: z.object({}),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        handler: async (_, { step: toolStep }) => {
            try {
                return (
                    await toolStep?.run("list-files", async () => {
                        const files = await convex.query(
                            api.system.getProjectFiles,
                            {
                                internalKey,
                                projectId
                            }
                        );

                        const sorted = files.sort((a,b) => {
                            if(a.type !== b.type){
                                return a.type === "folder" ? -1 : 1;
                            }
                            return a.name.localeCompare(b.name);
                        });

                        const fileList = sorted.map((f) => ({
                            id: f._id,
                            name: f.name,
                            type: f.type,
                            parentId: f.parentId ?? null,
                        }));

                        return fileList;
                    })
                )
            } catch (error) {
                return `Error listing files: ${error instanceof Error ? error.message : "Unknown error"}`;
            }
        }
    });
}