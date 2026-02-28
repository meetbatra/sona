import {auth} from "@clerk/nextjs/server";
import { getUserPlan, PLAN_LIMITS } from "@/lib/billing";
import {NextResponse} from "next/dist/server/web/spec-extension/response";
import {z} from "zod";

import {convex} from "@/lib/convex-client";
import {inngest} from "@/inngest/client";
import {api} from "../../../../convex/_generated/api";
import {Id} from "../../../../convex/_generated/dataModel";

const requestSchema = z.object({
    conversationId: z.string(),
    message: z.string(),
});

export async function POST (request: Request){
    const { userId } = await auth();

    if(!userId){
        return NextResponse.json(
            {error: "Unauthorized"},
            {status: 401},
        );
    }

    // Resolve the user's Billing plan using Clerk and apply
    // a simple calendar-month quota for the sidebar agent.
    const plan = await getUserPlan(userId);
    const limit = PLAN_LIMITS[plan];

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth(); // 0-11

    const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

    if(!internalKey){
        return NextResponse.json(
            {error: "Internal key not configured"},
            {status: 500},
        );
    }

    const usage = await convex.query(api.system.getAgentRunCountForMonth, {
        internalKey,
        userId,
        year,
        month,
    });

    if (usage.count >= limit) {
        return NextResponse.json(
            {
                error: "You have reached your monthly sidebar agent limit.",
                code: "usage_limit_exceeded",
                plan,
                limit,
            },
            { status: 402 },
        );
    }

    const body = await request.json();
    const { conversationId, message } = requestSchema.parse(body);

    const conversation = await convex.query(api.system.getConversationById, {
        internalKey,
        conversationId: conversationId as Id<"conversations">,
    });

    if(!conversation){
        return NextResponse.json(
            {error: "Conversation not found"},
            {status: 404},
        );
    }

    const projectId = conversation.projectId;

    const processingMessages = await convex.query(
        api.system.getProcessingMessages,
        {
            internalKey,
            projectId,
        }
    );

    if(processingMessages.length > 0){
        await Promise.all(
            processingMessages.map( async (msg) => {
                await inngest.send({
                    name: "message/cancel",
                    data: {
                        messageId: msg._id,
                        conversationId,
                        projectId,
                        message
                    }
                });

                await convex.mutation(
                    api.system.updateMessageStatus,
                    {
                        internalKey,
                        messageId: msg._id,
                        status: "cancelled"
                    }
                );
            })
        );
    }

    await convex.mutation(
        api.system.createMessage,
        {
            internalKey,
            conversationId: conversationId as Id<"conversations">,
            projectId,
            role: "user",
            content: message,
        }
    );

    const assistantMessageId = await convex.mutation(
        api.system.createMessage,
        {
            internalKey,
            conversationId: conversationId as Id<"conversations">,
            projectId,
            role: "assistant",
            content: "",
            status: "processing",
        }
    );

    // Record this sidebar agent run for monthly usage tracking.
    await convex.mutation(api.system.recordAgentRun, {
        internalKey,
        userId,
    });

    //TODO: Inngest AI agent job
    const event = await inngest.send({
        name: "message/sent",
        data: {
            messageId: assistantMessageId,
            conversationId,
            projectId,
            message
        }
    });

    return NextResponse.json({
        success: true,
        eventId: event.ids[0],
        messageId: assistantMessageId,
    })
}