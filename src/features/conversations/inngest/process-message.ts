import {inngest} from "@/inngest/client";
import {createAgent, createNetwork, openai} from "@inngest/agent-kit";
import {NonRetriableError} from "inngest";

import {Id} from "../../../../convex/_generated/dataModel";
import {convex} from "@/lib/convex-client";
import {api} from "../../../../convex/_generated/api";
import {CODING_AGENT_SYSTEM_PROMPT, TITLE_GENERATOR_SYSTEM_PROMPT} from "@/features/conversations/inngest/constants";
import {DEFAULT_CONVERSATION_TITLE} from "@/features/conversations/constants";
import {createReadFilesTool} from "@/features/conversations/inngest/tools/read-files";
import {createListFilesTool} from "@/features/conversations/inngest/tools/list-files";
import {createUpdateFileTool} from "@/features/conversations/inngest/tools/update-file";
import {createCreateFilesTool} from "@/features/conversations/inngest/tools/create-files";
import {createCreateFolderTool} from "@/features/conversations/inngest/tools/create-folder";
import {createRenameFileTool} from "@/features/conversations/inngest/tools/rename-file";
import {createDeleteFilesTool} from "@/features/conversations/inngest/tools/delete-files";
import {createScrapeUrlsTool} from "@/features/conversations/inngest/tools/scrape-urls";

interface MessageEvent {
    messageId: Id<"messages">;
    conversationId: Id<"conversations">;
    projectId: Id<"projects">;
    message: string;
}

export const processMessage = inngest.createFunction(
    {
        id: "process-message",
        cancelOn: [
            {
                event: "message/cancel",
                if: "event.data.messageId == async.data.messageId"
            }
        ],
        onFailure: async ({event, step}) => {
            const { messageId } = event.data.event.data;
            const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

            if(internalKey){
                await step.run("update-message-on-failure", async () => {
                    await convex.mutation(api.system.updateMessageContent, {
                        internalKey,
                        messageId,
                        content: "My apologies, I encountered an error while processing your request. Let me know if you need anything else!"
                    });
                });
            }
        },
    },
    {
        event: "message/sent",
    },
    async ({event, step}) => {
        const {
            messageId,
            conversationId,
            projectId,
            message
        } = event.data as MessageEvent;

        const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

        if(!internalKey){
            throw new NonRetriableError("SONA_CONVEX_INTERNAL_KEY is not configured");
        }

        //TODO: check if this is needed
        await step.sleep("db-sync", "5s");

        const conversation = await step.run("get-conversation", async () => {
            return (
                await convex.query(
                    api.system.getConversationById,
                    {
                        conversationId,
                        internalKey,
                    }
                )
            );
        });

        if(!conversation){
            throw new NonRetriableError("Conversation not found");
        }

        const recentMessages = await step.run("get-recent-messages", async () => {
            return (
                await convex.query(
                    api.system.getRecentMessages,
                    {
                        internalKey,
                        conversationId,
                        limit: 10
                    }
                )
            )
        });

        let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

        const contextMessages = recentMessages.filter(
            (msg) => msg._id !== messageId && msg.content.trim() !== ""
        );

        if(contextMessages.length > 0){
            const historyText = contextMessages
                .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
                .join("\n\n");

            systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`;
        }

        const shouldGenerateTitle = conversation.title === DEFAULT_CONVERSATION_TITLE;

        if(shouldGenerateTitle){
            const titleAgent = createAgent({
                name: "title-generator",
                system: TITLE_GENERATOR_SYSTEM_PROMPT,
                model: openai({
                    model: "gpt-4o-mini",
                    baseUrl: process.env.AI_PIPE_URL,
                    apiKey: process.env.AI_PIPE_KEY,
                    defaultParameters: {
                        temperature: 0.1,
                        max_completion_tokens: 50
                    },
                })
            });

            const { output } = await titleAgent.run(message, { step });

            const textMessage = output.find(
                (m) => m.type === "text" && m.role === "assistant"
            );

            if(textMessage?.type === "text"){
                const title = typeof textMessage.content === "string"
                    ? textMessage.content.trim()
                    : textMessage.content
                        .map((c) => c.text)
                        .join("")
                        .trim();

                if(title){
                    await step.run("update-conversation-title", async () => {
                        await convex.mutation(
                            api.system.updateConversationTitle,
                            {
                                internalKey,
                                conversationId,
                                title
                            }
                        );
                    });
                }
            }
        }

        const codingAgent = createAgent({
            name: "sona",
            description: "An expert AI coding assistant",
            system: systemPrompt,
            model: openai({
                model: "gpt-4.1-mini",
                baseUrl: process.env.AI_PIPE_URL,
                apiKey: process.env.AI_PIPE_KEY,
                defaultParameters: {
                    temperature: 0.3,
                    max_completion_tokens: 16000,
                },
            }),
            tools: [
                createListFilesTool({ internalKey, projectId }),
                createReadFilesTool({ internalKey }),
                createUpdateFileTool({ internalKey }),
                createCreateFilesTool({ internalKey, projectId }),
                createCreateFolderTool({ internalKey, projectId }),
                createRenameFileTool({ internalKey }),
                createDeleteFilesTool({ internalKey }),
                createScrapeUrlsTool(),
            ],
        });

        const network = createNetwork({
            name: "sona-network",
            agents: [codingAgent],
            maxIter: 20,
            router: ({ network }) => {
                const lastResult = network.state.results.at(-1);
                const hasTextResponse = lastResult?.output.some(
                    (m) => m.type === "text" && m.role === "assistant"
                );

                const hasToolCall = lastResult?.output.some(
                    (m) => m.type === "tool_call"
                );

                if(hasTextResponse && !hasToolCall){
                    return undefined;
                }

                return codingAgent;
            }
        });

        const result = await network.run(message);

        const lastResult = result.state.results.at(-1);
        const textMessage = lastResult?.output.find(
            (m) => m.type === "text" && m.role === "assistant"
        );

        let assistantMessage = "I processed your request. Let me know if you need anything else!";

        if(textMessage?.type === "text"){
            assistantMessage = typeof textMessage?.content === "string"
                ? textMessage.content
                : textMessage.content.map((c) => c.text).join("");
        }

        await step.run("update-assistant-message", async () => {
            await convex.mutation(api.system.updateMessageContent, {
                internalKey,
                messageId,
                content: assistantMessage
            });
        });
    }
);