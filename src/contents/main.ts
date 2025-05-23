import { sendToBackground } from "@plasmohq/messaging";
import type { PlasmoCSConfig } from "plasmo";

const id = new URL(location.href).searchParams.get("id");
const pickRandom = (array: any[]) => array[Math.floor(Math.random() * array.length)];

(async () => {
    const [images, groups, galleries] = await Promise.all([
        sendToBackground({ name: "images" }) as Promise<Record<number, Image[]>>,
        sendToBackground({ name: "groups" }) as Promise<Group[]>,
        sendToBackground({ name: "galleries" }) as Promise<Gallery[]>
    ]);

    const galleryGroups = galleries.find((v) => v.id === id)?.groups;

    if (galleryGroups) {
        const result = [];

        for (const group of galleryGroups) {
            const img = images[group];
            const settings = groups.filter((v) => v.value === group)[0];

            if (!img) continue;

            if (settings?.randomEnabled === true) {
                result.push(pickRandom(img));
                continue;
            }

            result.push(...img);
        }

        window.postMessage(
            {
                type: "UPLOAD",
                images: result
            },
            "*"
        );

        return;
    }

    window.postMessage(
        {
            type: "UPLOAD",
            images: groups[0].randomEnabled === true ? [pickRandom(images[0])] : images[0]
        },
        "*"
    );
})();

export const config: PlasmoCSConfig = {
    matches: [
        "https://gall.dcinside.com/board/write*",
        "https://gall.dcinside.com/*/board/write*",
        "https://gall.dcinside.com/board/modify*",
        "https://gall.dcinside.com/*/board/modify*"
    ],
    run_at: "document_end"
};
