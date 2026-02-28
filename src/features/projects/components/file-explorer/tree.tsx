import {useState} from "react";
import {ChevronRightIcon} from "lucide-react";
import {FileIcon, FolderIcon} from "@react-symbols/icons/utils";

import {Doc, Id} from "../../../../../convex/_generated/dataModel";
import {
    useCreateFile,
    useCreateFolder,
    useDeleteFile,
    useFolderContents,
    useRenameFile
} from "@/features/projects/hooks/use-files";
import TreeItemWrapper from "@/features/projects/components/file-explorer/tree-item-wrapper";
import {cn} from "@/lib/utils";
import LoadingRow from "@/features/projects/components/file-explorer/loading-row";
import {getItemPadding} from "@/features/projects/components/file-explorer/constants";
import CreateInput from "@/features/projects/components/file-explorer/create-input";
import RenameInput from "@/features/projects/components/file-explorer/rename-input";
import {useEditor} from "@/features/editor/hooks/use-editor";

interface TreeProps{
    item: Doc<"files">;
    level?: number;
    projectId: Id<"projects">;
}

const Tree = ({
    item,
    level = 0,
    projectId
}: TreeProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [creating, setCreating] = useState<"file" | "folder" | null>(null);

    const renameFile = useRenameFile({ projectId, parentId: item._id });
    const deleteFile = useDeleteFile({ projectId, parentId: item._id });
    const createFile = useCreateFile();
    const createFolder = useCreateFolder();

    const { openFile, closeTab, activeTabId } = useEditor(projectId);

    const folderContents = useFolderContents({
        projectId,
        parentId: item._id,
        enabled: item.type === "folder" && isOpen,
    });

    const handleRename = (newName: string) => {
        setIsRenaming(false);

        if(newName === item.name) return;

        renameFile({ id: item._id, newName });
    }

    const handleCreate = (name: string) => {
        setCreating(null);

        if(creating === "file"){
            createFile({
                projectId,
                name,
                content: "",
                parentId: item._id,
            });
        } else {
            createFolder({
                projectId,
                name,
                parentId: item._id,
            });
        }
    }

    const startCreating = (type: "file" | "folder") => {
        setIsOpen(true);
        setCreating(type);
    }

    if(item.type === "file"){
        const filename = item.name;
        const isActive = activeTabId === item._id;

        if(isRenaming){
            return (
                <RenameInput
                    type="file"
                    defaultValue={filename}
                    level={level}
                    onSubmit={handleRename}
                    onCancel={() => setIsRenaming(false)}
                />
            )
        }

        return (
            <TreeItemWrapper
                item={item}
                level={level}
                isActive={isActive}
                onClick={() => openFile(item._id, { pinned: false })}
                onDoubleClick={() => openFile(item._id, { pinned: true })}
                onRename={() => setIsRenaming(true)}
                onDelete={() => {
                    closeTab(item._id);
                    deleteFile({ id: item._id });
                }}
            >
                <FileIcon fileName={filename} autoAssign className="size-4" />
                <span className="truncate text-sm">{filename}</span>
            </TreeItemWrapper>
        )
    }

    const folderName = item.name;

    const folderRender = (
        <>
            <div className="flex items-center gap-0.5">
                <ChevronRightIcon
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground",
                        isOpen && "rotate-90"
                    )}
                />
                <FolderIcon folderName={folderName} className="size-4" />
            </div>
            <span className="truncate text-sm">{folderName}</span>
        </>
    )

    if(creating){
        return(
            <>
                <button
                    onClick={() => setIsOpen((value) => !value)}
                    className="group flex items-center gap-1 h-5.5 hover:bg-accent/30 w-full"
                    style={{ paddingLeft: getItemPadding(level, false)}}
                >
                    {folderRender}
                </button>
                {isOpen && (
                    <>
                        {folderContents === undefined && <LoadingRow level={level + 1} />}
                        <CreateInput
                            type={creating}
                             level={level + 1}
                             onSubmit={handleCreate}
                             onCancel={() => setCreating(null)}
                        />
                        {folderContents?.map((subItem) => (
                            <Tree
                                key={subItem._id}
                                item={subItem}
                                level={level + 1}
                                projectId={projectId}
                            />
                        ))}
                    </>
                )}
            </>
        )
    }

    if(isRenaming){
        return(
            <>
                <RenameInput
                    type="folder"
                    defaultValue={folderName}
                    isOpen={isOpen}
                    level={level}
                    onSubmit={handleRename}
                    onCancel={() => setIsRenaming(false)}
                />
                {isOpen && (
                    <>
                        {folderContents === undefined && <LoadingRow level={level + 1} />}
                        {folderContents?.map((subItem) => (
                            <Tree
                                key={subItem._id}
                                item={subItem}
                                level={level + 1}
                                projectId={projectId}
                            />
                        ))}
                    </>
                )}
            </>
        )
    }

    return (
        <>
            <TreeItemWrapper
                item={item}
                level={level}
                onClick={() => setIsOpen((value) => !value)}
                onRename={() => setIsRenaming(true)}
                onDelete={() => {
                    deleteFile({ id: item._id })
                }}
                onCreateFile={() => startCreating("file")}
                onCreateFolder={() => startCreating("folder")}
            >
                {folderRender}
            </TreeItemWrapper>
            {isOpen && (
                <>
                    {folderContents === undefined && <LoadingRow level={level + 1} />}
                    {folderContents?.map((subItem) => (
                        <Tree
                            key={subItem._id}
                            item={subItem}
                            level={level + 1}
                            projectId={projectId}
                        />
                    ))}
                </>
            )}
        </>
    );
}

export default Tree;