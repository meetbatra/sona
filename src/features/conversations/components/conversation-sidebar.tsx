import {useEffect, useState} from "react";
import {toast} from "sonner";
import ky, { HTTPError } from "ky";
import {CopyIcon, HistoryIcon, LoaderIcon, PlusIcon} from "lucide-react";
import { BillingButton } from "@/components/billing-button";

import {Id} from "../../../../convex/_generated/dataModel";
import {DEFAULT_CONVERSATION_TITLE} from "../constants";
import {Button} from "@/components/ui/button";
import {Conversation, ConversationContent, ConversationScrollButton} from "@/components/ai-elements/conversation";
import {
    PromptInput,
    PromptInputBody,
    PromptInputFooter, PromptInputMessage, PromptInputSubmit,
    PromptInputTextarea, PromptInputTools
} from "@/components/ai-elements/prompt-input";
import {
    useConversation,
    useConversations,
    useCreateConversation, useMessages
} from "@/features/conversations/hooks/use-conversations";
import {
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
    MessageResponse
} from "@/components/ai-elements/message";
import PastConversationsDialog from "@/features/conversations/components/past-conversations-dialog";

interface ConversationSidebarProps {
    projectId: Id<"projects">;
}

const ConversationSidebar = ({ projectId }: ConversationSidebarProps) => {
    const [input, setInput] = useState("");
    const [usage, setUsage] = useState<{ plan: string; used: number; limit: number } | null>(null);
    const [loadingUsage, setLoadingUsage] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
    const [pastConversationsOpen, setPastConversationsOpen] = useState(false);

    const createConversation = useCreateConversation();

    const fetchUsage = async () => {
        try {
            setLoadingUsage(true);
            const data = await ky
                .get("/api/agent/usage")
                .json<{ plan: string; used: number; limit: number }>();
            setUsage(data);
        } catch {
            // ignore usage errors in UI, sidebar should still work
        } finally {
            setLoadingUsage(false);
        }
    };

    // initial load
    useEffect(() => {
        void fetchUsage();
    }, []);
    const conversations = useConversations(projectId);

    const activeConversationId =
        selectedConversationId ?? conversations?.[0]?._id ?? null;

    const activeConversation = useConversation(activeConversationId);
    const conversationMessages = useMessages(activeConversationId);

    const isProcessing = conversationMessages?.some(
        (msg) => msg.status === "processing"
    );

    const handleCreateConversation = async () => {
        try {
            const newConversationId = await createConversation({
                projectId,
                title: DEFAULT_CONVERSATION_TITLE,
            });
            setSelectedConversationId(newConversationId);
            return newConversationId;
        } catch {
            toast.error("Failed to create new conversation");
            return null;
        }
    }

    const handleCancel = async () => {
        try {
            await ky.post("/api/messages/cancel", {
                json: { projectId }
            });
        } catch {
            toast.error("Unable to cancel request");
        }
    }

    const handleSubmit = async (message: PromptInputMessage) => {
        if(isProcessing){
            await handleCancel();
            return;
        }

        let conversationId = activeConversationId;

        if(!conversationId){
            conversationId = await handleCreateConversation();
            console.log(conversationId);
            if(!conversationId){
                return;
            }
        }

        try {
            await ky.post("/api/messages", {
                json: {
                    conversationId,
                    message: message.text
                },
            });
            // On successful run, refresh usage so the counter updates immediately
            void fetchUsage();
        } catch (error) {
            if (error instanceof HTTPError) {
                try {
                    const body = await error.response.json<{
                        error?: string;
                        code?: string;
                        plan?: string;
                        limit?: number;
                    }>();

                    if (body?.code === "usage_limit_exceeded") {
                        toast.error(body.error ?? "You have reached your monthly sidebar agent limit.");
                        // Refresh usage so the meter reflects the latest count
                        void fetchUsage();
                        return;
                    }

                    toast.error(body?.error ?? "Message failed to send");
                    return;
                } catch {
                    // fall through to generic error
                }
            }

            toast.error("Message failed to send");
        }

        setInput("");
    }

    return (
        <>
            <div className="flex flex-col h-full bg-sidebar">
                <div className="h-8.75 flex items-center justify-between border-b">
                    <div className="text-sm truncate pl-3">
                        {activeConversation?.title ?? DEFAULT_CONVERSATION_TITLE}
                    </div>
                    <div className="flex items-center px-1 gap-1">
                        <Button
                            size="icon-xs"
                            variant="highlight"
                            onClick={() => setPastConversationsOpen(true)}
                        >
                            <HistoryIcon className="size-3.5" />
                        </Button>
                        <Button
                            size="icon-xs"
                            variant="highlight"
                            onClick={handleCreateConversation}
                        >
                            <PlusIcon className="size-3.5" />
                        </Button>
                    </div>
                </div>
                <Conversation className="flex-1">
                    <ConversationContent>
                        {conversationMessages?.map((message, messageIndex) => (
                            <Message
                                key={message._id}
                                from={message.role}
                            >
                                <MessageContent>
                                    {message.status === "processing" ? (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <LoaderIcon className="size-4 animate-spin" />
                                            <span>Thinking...</span>
                                        </div>
                                    ) : message.status === "cancelled" ? (
                                        <span className="text-muted-foreground italic">
                                            Request Cancelled
                                        </span>
                                    ) : (
                                        <MessageResponse>{message.content}</MessageResponse>
                                    )}
                                </MessageContent>
                                {
                                    message.role === "assistant" &&
                                    message.status === "completed" &&
                                    messageIndex === (conversationMessages?.length ?? 0) - 1 &&
                                    (
                                        <MessageActions>
                                            <MessageAction
                                                onClick={() => {
                                                    navigator.clipboard.writeText(message.content)
                                                }}
                                                label="Copy"
                                            >
                                                <CopyIcon className="size-3" />
                                            </MessageAction>
                                        </MessageActions>
                                    )
                                }
                            </Message>
                        ))}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>
                <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span
                            title="Usage resets on the 1st of each month"
                        >
                            {loadingUsage && "Checking usage..."}
                            {!loadingUsage && usage && (
                                <>
                                    {usage.plan === "pro" ? "Pro" : "Free"}  b7 {usage.used}/{usage.limit} runs
                                </>
                            )}
                        </span>
                        {!loadingUsage && usage?.plan !== "pro" && <BillingButton />}
                    </div>
                    <PromptInput
                        onSubmit={handleSubmit}
                        className="mt-1.5"
                    >
                        <PromptInputBody>
                            <PromptInputTextarea
                                placeholder="Ask Sona anything..."
                                onChange={(e) => setInput(e.target.value)}
                                value={input}
                                disabled={isProcessing}
                            />
                        </PromptInputBody>
                        <PromptInputFooter>
                            <PromptInputTools />
                            <PromptInputSubmit
                                disabled={isProcessing ? false : !input}
                                status={isProcessing ? "streaming" : undefined}
                            />
                        </PromptInputFooter>
                    </PromptInput>
                </div>
            </div>
            <PastConversationsDialog
                projectId={projectId}
                open={pastConversationsOpen}
                onOpenChange={setPastConversationsOpen}
                onSelect={setSelectedConversationId}
            />
        </>
    )
}

export default ConversationSidebar;