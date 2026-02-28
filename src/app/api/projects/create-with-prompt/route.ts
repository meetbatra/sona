import {z} from "zod";
import {auth} from "@clerk/nextjs/server";
import {NextResponse} from "next/server";
import {adjectives, animals, colors, uniqueNamesGenerator} from "unique-names-generator";

import {convex} from "@/lib/convex-client";
import {DEFAULT_CONVERSATION_TITLE} from "@/features/conversations/constants";
import {inngest} from "@/inngest/client";
import {api} from "../../../../../convex/_generated/api";

const requestSchema = z.object({
    prompt: z.string().min(1),
});

export async function POST(request: Request){
    const { userId } = await auth();

    if(!userId){
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

    if(!internalKey){
        return NextResponse.json(
            { error: "Internal Key not configured" },
            { status: 500 }
        );
    }

    const body = await request.json();
    const { prompt } = requestSchema.parse(body);

    const projectName = uniqueNamesGenerator({
        dictionaries: [adjectives, animals, colors],
        separator: "-",
        length: 3,
    });

    const { projectId, conversationId } = await convex.mutation(api.system.createProjectWithConversation, {
        internalKey,
        projectName,
        conversationTitle: DEFAULT_CONVERSATION_TITLE,
        ownerId: userId
    });

    await convex.mutation(api.system.createMessage, {
        internalKey,
        conversationId,
        projectId,
        role: "user",
        content: prompt
    });

    const assistantMessageId = await convex.mutation(api.system.createMessage, {
        internalKey,
        conversationId,
        projectId,
        role: "assistant",
        content: "",
        status: "processing"
    });

    await inngest.send({
        name: "message/sent",
        data: {
            messageId: assistantMessageId,
            conversationId,
            projectId,
            message: prompt
        },
    });

    return NextResponse.json({ projectId });
}