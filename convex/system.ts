import {v} from "convex/values";

import {mutation, query} from "./_generated/server";

const validateInternalKey = (key: string) => {
    const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

    if(!internalKey){
        throw new Error("SONA_CONVEX_INTERNAL_KEY is not configured");
    }

    if(key !== internalKey){
        throw new Error("Invalid internal key");
    }
}

export const getConversationById = query({
    args: {
        conversationId: v.id("conversations"),
        internalKey: v.string(),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        return (await ctx.db.get("conversations", args.conversationId));
    }
});

export const createMessage = mutation({
    args: {
        internalKey: v.string(),
        conversationId: v.id("conversations"),
        projectId: v.id("projects"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        status: v.optional(
            v.union(
                v.literal("processing"),
                v.literal("completed"),
                v.literal("cancelled")
            )
        ),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const messageId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            projectId: args.projectId,
            role: args.role,
            content: args.content,
            status: args.status,
        });

        await ctx.db.patch("conversations", args.conversationId, {
            updatedAt: Date.now()
        });

        return messageId;
    }
});

export const updateMessageContent = mutation({
    args: {
        internalKey: v.string(),
        messageId: v.id("messages"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        await ctx.db.patch("messages", args.messageId, {
            content: args.content,
            status: "completed" as const,
        });
    }
});

export const updateMessageStatus = mutation({
    args: {
        internalKey: v.string(),
        messageId: v.id("messages"),
        status: v.optional(
            v.union(
                v.literal("processing"),
                v.literal("completed"),
                v.literal("cancelled")
            )
        ),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        await ctx.db.patch("messages", args.messageId, {
            status: args.status,
        });
    }
});

export const getProcessingMessages = query({
    args: {
        internalKey: v.string(),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        return (
            await ctx.db
                .query("messages")
                .withIndex("by_project_status", (q) =>
                    q
                        .eq("projectId", args.projectId)
                        .eq("status", "processing")
                )
                .collect()
        );
    }
});

export const getRecentMessages = query({
    args: {
        internalKey: v.string(),
        conversationId: v.id("conversations"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation",(q) =>
                q
                    .eq("conversationId", args.conversationId)
            )
            .order("asc")
            .collect();

        const limit = args.limit ?? 10;
        return messages.slice(-limit);
    }
});

export const updateConversationTitle = mutation({
    args: {
        internalKey: v.string(),
        conversationId: v.id("conversations"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        await ctx.db.patch("conversations", args.conversationId, {
            title: args.title,
            updatedAt: Date.now(),
        });
    }
});

export const getProjectFiles = query({
    args: {
        internalKey: v.string(),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        return (
            await ctx.db
                .query("files")
                .withIndex("by_project", (q) =>
                    q
                        .eq("projectId", args.projectId)
                )
                .collect()
        );
    }
});

export const getFileById = query({
    args: {
        internalKey: v.string(),
        fileId: v.id("files"),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        return (await ctx.db.get("files", args.fileId));
    }
});

export const updateFile = mutation({
    args: {
        internalKey: v.string(),
        fileId: v.id("files"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const file = await ctx.db.get("files", args.fileId);

        if(!file){
            throw new Error("File not found");
        }

        await ctx.db.patch("files", args.fileId, {
            content: args.content,
            updatedAt: Date.now(),
        });

        return args.fileId;
    }
});

export const createFile = mutation({
    args: {
        internalKey: v.string(),
        projectId: v.id("projects"),
        name: v.string(),
        content: v.string(),
        parentId: v.id("files"),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const files = await ctx.db
            .query("files")
            .withIndex("by_project_parent", (q) =>
                q
                    .eq("projectId", args.projectId)
                    .eq("parentId", args.parentId)
            )
            .collect();

        const existing = files.find(
            (file) => file.name === args.name && file.type === "file"
        );

        if(existing){
            throw new Error("File already exists");
        }

        const fileId = await ctx.db.insert("files", {
            projectId: args.projectId,
            name: args.name,
            content: args.content,
            type: "file",
            parentId: args.parentId,
            updatedAt: Date.now()
        });

        return fileId;
    }
});

export const createFiles = mutation({
    args: {
        internalKey: v.string(),
        projectId: v.id("projects"),
        parentId: v.optional(v.id("files")),
        files: v.array(
            v.object({
                name: v.string(),
                content: v.string(),
            })
        )
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const existingFiles = await ctx.db
            .query("files")
            .withIndex("by_project_parent", (q) =>
                q
                    .eq("projectId", args.projectId)
                    .eq("parentId", args.parentId)
            )
            .collect();

        const results: {name: string; fileId: string; error?: string}[] = [];

        for(const file of args.files){
            const existing = existingFiles.find(
                (f) => f.name === file.name && f.type === "file"
            );

            if(existing){
                results.push({
                    name: file.name,
                    fileId: existing._id,
                    error: "File already exists",
                });
                continue;
            }

            const fileId = await ctx.db.insert("files", {
                projectId: args.projectId,
                name: file.name,
                content: file.content,
                type: "file",
                parentId: args.parentId,
                updatedAt: Date.now(),
            });

            results.push({ name: file.name, fileId });
        }

        return results;
    }
});

export const createFolder = mutation({
    args: {
        internalKey: v.string(),
        projectId: v.id("projects"),
        name: v.string(),
        parentId: v.optional(v.id("files")),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const files = await ctx.db
            .query("files")
            .withIndex("by_project_parent", (q) =>
                q
                    .eq("projectId", args.projectId)
                    .eq("parentId", args.parentId)
            )
            .collect();

        const existing = files.find(
            (file) => file.name === args.name && file.type === "folder"
        );

        if(existing){
            throw new Error("Folder already exists");
        }

        const fileId = await ctx.db.insert("files", {
            projectId: args.projectId,
            name: args.name,
            type: "folder",
            parentId: args.parentId,
            updatedAt: Date.now()
        });

        return fileId;
    }
});

export const renameFile = mutation({
    args: {
        internalKey: v.string(),
        fileId: v.id("files"),
        newName: v.string(),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const file = await ctx.db.get("files", args.fileId);
        if(!file){
            throw new Error("File not found");
        }

        const siblings = await ctx.db
            .query("files")
            .withIndex("by_project_parent", (q) =>
                q
                    .eq("projectId", file.projectId)
                    .eq("parentId", file.parentId)
            )
            .collect();

        const existing = siblings.find(
            (sibling) =>
                sibling.name === args.newName &&
                sibling.type === file.type &&
                sibling._id !== args.fileId
        );

        if(existing){
            throw new Error(`A ${file.type} names ${args.newName} already exists`);
        }

        await ctx.db.patch("files", args.fileId, {
            name: args.newName,
            updatedAt: Date.now(),
        });

        return args.fileId;
    }
});

export const deleteFile = mutation({
    args: {
        internalKey: v.string(),
        fileId: v.id("files"),
    },
    handler: async (ctx, args) => {
        validateInternalKey(args.internalKey);

        const file = await ctx.db.get("files", args.fileId);

        if(!file){
            throw new Error("File not found");
        }

        const deleteRecursive = async (fileId: typeof args.fileId) => {
            const item = await ctx.db.get("files", fileId);

            if(!item) return;

            if(item.type === "folder"){
                const children = await ctx.db
                    .query("files")
                    .withIndex("by_project_parent", (q) =>
                        q
                            .eq("projectId", item.projectId)
                            .eq("parentId", item.parentId)
                    )
                    .collect();

                for(const child of children){
                    await deleteRecursive(child._id);
                }
            }

            if(item.storageId){
                await ctx.storage.delete(item.storageId);
            }

            await ctx.db.delete(item._id);
        }

        await deleteRecursive(args.fileId);
    }
});