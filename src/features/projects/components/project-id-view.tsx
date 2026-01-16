"use client";

import {useState} from "react";

import {cn} from "@/lib/utils";
import {Id} from "../../../../convex/_generated/dataModel";
import {FaGithub} from "react-icons/fa";

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
                    <div className="flex items-center gap-1.5 h-full px-3 cursor-pointer text-muted-foreground border-l hover:bg-accent/30">
                        <FaGithub className="size-3.5" />
                        <span className="text-sm">Export</span>
                    </div>
                </div>
            </nav>
            <div className="flex-1 relative">
                <div className={cn(
                    "absolute inset-0",
                    activeView === "editor" ? "visible" : "invisible"
                )}>
                    <div>Editor</div>
                </div>
                <div className={cn(
                    "absolute inset-0",
                    activeView === "preview" ? "visible" : "invisible"
                )}>
                    <div>Preview</div>
                </div>
            </div>
        </div>
    )
};

export default ProjectIdView;