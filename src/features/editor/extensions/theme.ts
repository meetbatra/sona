import {EditorView} from "codemirror";

export const customTheme = EditorView.theme({
    "&": {
        outline: "none !important",
    },
    ".cm-content": {
        fontFamily: "var(--font-plex-mono), monospace",
        fontSize: "14px"
    },
    ".cm-scroller": {
        scrollbarWidth: "thin",
        scrollbarColor: "#3f3f46 transparent",
    },
});