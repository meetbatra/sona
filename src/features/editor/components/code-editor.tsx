import {useEffect, useMemo, useRef} from "react";
import {EditorView, keymap} from "@codemirror/view";
import {oneDark} from "@codemirror/theme-one-dark";
import {indentationMarkers} from "@replit/codemirror-indentation-markers";
import {indentWithTab} from "@codemirror/commands";

import {customTheme} from "@/features/editor/extensions/theme";
import {getLanguageExtension} from "@/features/editor/extensions/language-extension";
import {minimap} from "@/features/editor/extensions/minimap";
import {customSetup} from "@/features/editor/extensions/custom-setup";

interface Props {
    filename: string;
    initialValue: string;
    onChange: (value: string) => void;
}

const CodeEditor = ({
    filename,
    initialValue = "",
    onChange
}: Props) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    const languageExtension = useMemo(() => {
        return getLanguageExtension(filename);
    }, [filename]);

    useEffect(() => {
        if(!editorRef.current) return;

        const view = new EditorView({
            doc: initialValue,
            parent: editorRef.current,
            extensions: [
                oneDark,
                customTheme,
                customSetup,
                languageExtension,
                keymap.of([indentWithTab]),
                minimap(),
                indentationMarkers(),
                EditorView.updateListener.of((update) => {
                    if(update.docChanged){
                        onChange(update.state.doc.toString());
                    }
                })
            ]
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };

        //eslint-disable-next-line react-hooks/exhaustive-deps -- initialValue is only used for initial document
    }, [languageExtension]);

    return (
        <div ref={editorRef} className="size-full pl-4 bg-background" />
    );
}

export default CodeEditor;