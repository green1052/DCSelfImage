import type { PlasmoCSConfig } from "plasmo";

function waitAttach() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (window.attach) {
                clearInterval(interval);
                resolve(true);
            }
        }, 100);
    });
}

window.addEventListener("message", async (ev) => {
    if (ev.source !== window || ev.data.type !== "UPLOAD") return;

    const images: Image[] = ev.data.images;

    if (!images.length) return;

    await waitAttach();

    for (const image of images) {
        window.attach(image);
    }

    document.querySelector<HTMLInputElement>("#upload_status").value = "Y";
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
