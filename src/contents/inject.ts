import type { PlasmoCSConfig } from "plasmo";

window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.data.type !== "UPLOAD") return;

    const images: Image[] = ev.data.images;

    for (const image of images) {
        window.attach(image);
    }
});

export const config: PlasmoCSConfig = {
    matches: [
        "https://gall.dcinside.com/board/write*",
        "https://gall.dcinside.com/*/board/write*",
        "https://gall.dcinside.com/board/modify*",
        "https://gall.dcinside.com/*/board/modify*"
    ],
    world: "MAIN",
    run_at: "document_start"
};
