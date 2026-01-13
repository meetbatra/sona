import {generateText} from "ai";
import { openai } from '@ai-sdk/openai';

import { inngest } from "./client";
import {firecrawl} from "@/lib/firecrawl";

const URL_REGEX = /https?:\/\/[^\s]+/g;

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event, step }) => {
        const { prompt } = event.data as { prompt: string };

        const urls = await step.run("extract-urls", async () => {
            return prompt.match(URL_REGEX) ?? [];
        }) as string[];

        const scrapedContent = await step.run("scrape-urls", async () => {
            const results = await Promise.all(
                urls.map(async (url) => {
                    const result = await firecrawl.scrape(
                        url,
                        { formats: ["markdown"] }
                    );
                    return result.markdown ?? null;
                })
            );
            return results.filter(Boolean).join("\n\n");
        });

        const finalPrompt = scrapedContent
            ? `Context:\n${scrapedContent}\n\nQuestion: ${prompt}`
            : prompt;

        await step.run("generate-text", async () => {
            return await generateText({
                model: openai('gpt-4.1-nano'),
                prompt: finalPrompt,
            });
        });
    },
);