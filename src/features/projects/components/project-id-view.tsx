"use client";

import {useState} from "react";

import {cn} from "@/lib/utils";
import {Id} from "../../../../convex/_generated/dataModel";
import {Allotment} from "allotment";
import FileExplorer from "@/features/projects/components/file-explorer";
import EditorView from "@/features/editor/components/editor-view";
import PreviewView from "@/features/projects/components/preview-view";
import ExportPopover from "@/features/projects/components/export-popover";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 350;
const DEFAULT_MAIN_SIZE = 1000;

const Tab = ({
    label,
    isActive,
    onClick,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) => {
    return (
        <div
            onClick={onClick}
            className={cn(
        "flex items-center gap-2 h-full px-3 cursor-pointer text-muted-foreground border-r hover:bg-accent/30",
                isActive && "bg-background text-foreground",
            )}
        >
            <span className="text-sm">{label}</span>
        </div>
    );
};

const ProjectIdView = ({ projectId }: { projectId: Id<"projects"> }) => {
    const [activeView, setActiveView] = useState<"editor" | "preview">("editor");
    
    return (
        <div className="h-full flex flex-col">
            <nav className="h-8.75 flex items-center bg-sidebar border-b">
                <Tab
                    label="Code"
                    isActive={false}
                    onClick={() => setActiveView("editor")}
                />
                <Tab
                    label="Preview"
                    isActive={false}
                    onClick={() => setActiveView("preview")}
                />
                <div className="flex-1 flex justify-end h-full">
                    <ExportPopover projectId={projectId} />
                </div>
            </nav>
            <div className="flex-1 relative">
                <div className={cn(
                    "absolute inset-0",
                    activeView === "editor" ? "visible" : "invisible"
                )}>
                    <Allotment
                        defaultSizes={[DEFAULT_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}
                    >
                        <Allotment.Pane
                            snap
                            minSize={MIN_SIDEBAR_WIDTH}
                            maxSize={MAX_SIDEBAR_WIDTH}
                            preferredSize={DEFAULT_SIDEBAR_WIDTH}
                        >
                            <FileExplorer projectId={projectId} />
                        </Allotment.Pane>
                        <Allotment.Pane>
                            <EditorView projectId={projectId} />
                        </Allotment.Pane>
                    </Allotment>
                </div>
                <div className={cn(
                    "absolute inset-0",
                    activeView === "preview" ? "visible" : "invisible"
                )}>
                    <PreviewView projectId={projectId} />
                </div>
            </div>
        </div>
    )
};

export default ProjectIdView;