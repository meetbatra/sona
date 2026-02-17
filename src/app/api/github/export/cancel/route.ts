import {z} from "zod";
import {auth} from "@clerk/nextjs/server";
import {NextResponse} from "next/server";

import {inngest} from "@/inngest/client";
import {convex} from "@/lib/convex-client";
import {api} from "../../../../../../convex/_generated/api";
import {Id} from "../../../../../../convex/_generated/dataModel";

const requestSchema = z.object({
    projectId: z.string(),
});

export async function POST(request: Request){
    const { userId } = await auth();

    if(!userId){
        return NextResponse.json(
            {error: "Unauthorized"},
            {status: 401}
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            {error: "Invalid JSON body"},
            {status: 400}
        );
    }

    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
        return NextResponse.json(
            {error: "Invalid request", details: parseResult.error.flatten()},
            {status: 400}
        );
    }
    const { projectId } = parseResult.data;

    const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

    if(!internalKey){
        return NextResponse.json(
            {error: "Server configuration error"},
            {status: 500}
        );
    }

    const event = await inngest.send({
        name: "github/export.cancel",
        data: {
            projectId,
        }
    });

    await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId: projectId as Id<"projects">,
        status: "cancelled"
    });

    return NextResponse.json({
        success: true,
        projectId,
        eventId: event.ids[0],
    });
}