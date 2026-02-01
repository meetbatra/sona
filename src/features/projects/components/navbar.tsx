import Link from "next/link";
import Image from "next/image";
import {Poppins} from "next/font/google";
import {UserButton} from "@clerk/nextjs";
import {useState} from "react";
import {CloudCheckIcon, Loader2Icon} from "lucide-react";
import {formatDistanceToNow} from "date-fns";

import {Id} from "../../../../convex/_generated/dataModel";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {useProject, useRenameProject} from "@/features/projects/hooks/use-projects";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";

const font = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const Navbar = ({
    projectId
}: { projectId: Id<"projects">}) => {
    const project = useProject(projectId);
    const renameProject = useRenameProject();

    const [isRenaming, setIsRenaming] = useState(false);
    const [name, setName] = useState("");

    const handleStartRename = () => {
        if(!project) return;
        setName(project.name);
        setIsRenaming(true);
    }

    const handleSubmit = () => {
        if(!project) return;
        setIsRenaming(false);

        const trimmedName = name.trim();
        if(!trimmedName || trimmedName === project.name) return;

        renameProject({id: projectId, name: trimmedName});
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if(e.key === "Enter"){
            handleSubmit();
        } else if(e.key === "Escape"){
            setIsRenaming(false);
        }
    }

    return (
        <nav className="flex justify-between items-center gap-x-2 p-2 bg-sidebar border-b">
            <div className="flex items-center gap-x-2">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink
                                className="flex items-center gap-1.5 group/logo"
                                asChild
                            >
                                <Button
                                    variant="ghost"
                                    className="w-fit! p-1.5! h-7!"
                                    asChild
                                >
                                    <Link href="/">
                                        <Image
                                            src="/logo.svg"
                                            alt="Logo"
                                            height={20}
                                            width={20}
                                        />
                                        <span
                                            className={cn(
                                                "text-sm font-medium",
                                                font.className,
                                            )}
                                        >
                                            Sona
                                        </span>
                                    </Link>
                                </Button>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="ml-0! mr-1" />
                        <BreadcrumbItem>
                            {isRenaming ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onBlur={handleSubmit}
                                    onKeyDown={handleKeyDown}
                                    className="text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-inset focus:ring-ring font-medium max-w-40 truncate"
                                />
                            ) : (
                                <BreadcrumbPage
                                    onClick={handleStartRename}
                                    className="text-sm cursor-pointer hover:text-primary font-medium max-w-40 truncate"
                                >
                                    {project?.name ?? "Loading..."}
                                </BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                {project?.importStatus === "importing" ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Loader2Icon className="size-4 text-muted-foreground animate-spin" />
                        </TooltipTrigger>
                        <TooltipContent>Importing...</TooltipContent>
                    </Tooltip>
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <CloudCheckIcon className="size-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                            Saved{" "}
                            {project?.updatedAt
                                ? formatDistanceToNow(project.updatedAt, { addSuffix: true })
                                : "unknown"
                            }
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="flex items-center gap-2">
                <UserButton />
            </div>
        </nav>
    )
}

export default Navbar;