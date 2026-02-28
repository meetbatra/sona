import {useEffect, useRef, useState} from "react";
import Image from "next/image";
import {AlertTriangleIcon} from "lucide-react";

import {Id} from "../../../../convex/_generated/dataModel";
import TopNavigation from "@/features/editor/components/top-navigation";
import {useEditor} from "@/features/editor/hooks/use-editor";
import FileBreadcrumbs from "@/features/editor/components/file-breadcrumbs";
import {useFile, useUpdateFile} from "@/features/projects/hooks/use-files";
import CodeEditor from "@/features/editor/components/code-editor";
import { ProjectTerminal } from "@/features/terminal/components/project-terminal";
import { useAuth } from "@clerk/nextjs";

const DEBOUNCE_MS = 1500;

const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {
    const { isSignedIn } = useAuth();
    const { activeTabId } = useEditor(projectId);
    const activeFile = useFile(activeTabId);
    const updateFile = useUpdateFile();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);

    const isActiveFileBinary = activeFile && activeFile.storageId;
    const isActiveFileText = activeFile && !activeFile.storageId;

    useEffect(() => {
        return () => {
            if(timeoutRef.current){
                clearTimeout(timeoutRef.current);
            }
        }
    }, [activeTabId]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between">
                <TopNavigation projectId={projectId} />
                {isSignedIn && (
                    <button
                        type="button"
                        onClick={() => setIsTerminalOpen((prev) => !prev)}
                        className="text-xs px-2 py-1 rounded border bg-background/60 hover:bg-background"
                    >
                        {isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
                    </button>
                )}
            </div>
            {activeTabId && <FileBreadcrumbs projectId={projectId} />}
            <div className="flex-1 min-h-0 bg-background flex flex-col">
                <div className={"flex-1 min-h-0"}>
                    {!activeFile && (
                        <div className="size-full flex items-center justify-center">
                            <Image
                                src="/logo-alt.svg"
                                alt="Sona"
                                width={50}
                                height={50}
                                className="opacity-25"
                            />
                        </div>
                    )}
                    {isActiveFileText && (
                        <CodeEditor
                            key={activeFile._id}
                            initialValue={activeFile.content ?? ""}
                            filename={activeFile.name}
                            onChange={(content: string) => {
                                if(timeoutRef.current){
                                    clearTimeout(timeoutRef.current);
                                }

                                timeoutRef.current = setTimeout(() => {
                                    updateFile({id: activeFile._id, content});
                                }, DEBOUNCE_MS);
                            }}
                        />
                    )}
                    {isActiveFileBinary && (
                        <div className="size-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2.5 max-w-md text-center">
                                <AlertTriangleIcon className="size-6 text-yellow-500" />
                                <p className="text-sm">
                                    The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                {isSignedIn && isTerminalOpen && (
                    <div className="h-64 min-h-[8rem] max-h-[60vh] border-t bg-black/90">
                        <ProjectTerminal projectId={projectId as unknown as string} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default EditorView;