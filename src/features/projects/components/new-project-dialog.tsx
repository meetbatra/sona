import ky from "ky";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {toast} from "sonner";

import {
    PromptInput,
    PromptInputBody, PromptInputFooter,
    PromptInputMessage, PromptInputSubmit,
    PromptInputTextarea, PromptInputTools
} from "@/components/ai-elements/prompt-input";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Id} from "../../../../convex/_generated/dataModel";

interface NewProjectDialogProps{
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const NewProjectDialog = ({
    open,
    onOpenChange
}: NewProjectDialogProps) => {
    const router = useRouter();
    const [input, setInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (message: PromptInputMessage) => {
        if(!message.text) return;

        setIsSubmitting(true);

        try {
            const { projectId } = await ky
                .post("/api/projects/create-with-prompt", {
                    json: { prompt: message.text.trim() }
                })
                .json<{ projectId: Id<"projects"> }>();

            toast.success("Project created");
            onOpenChange(false);
            setInput("");
            router.push(`/projects/${projectId}`);
        } catch {
            toast.error("Unable to create project");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="sm:max-w-lg p-0"
            >
                <DialogHeader className="hidden">
                    <DialogTitle>What do you want to build?</DialogTitle>
                    <DialogDescription>
                        Describe your project and AI will help you create it.
                    </DialogDescription>
                </DialogHeader>
                <PromptInput onSubmit={handleSubmit} className="border-none!">
                    <PromptInputBody>
                        <PromptInputTextarea
                            placeholder="Ask Sona to build..."
                            onChange={(e) => setInput(e.target.value)}
                            value={input}
                            disabled={isSubmitting}
                        />
                    </PromptInputBody>
                    <PromptInputFooter>
                        <PromptInputTools />
                        <PromptInputSubmit disabled={!input || isSubmitting} />
                    </PromptInputFooter>
                </PromptInput>
            </DialogContent>
        </Dialog>
    );
};

export default NewProjectDialog;