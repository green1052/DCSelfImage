import type { PlasmoMessaging } from "@plasmohq/messaging";
import { Storage } from "@plasmohq/storage";

const storage = new Storage();
let images = storage.get<Record<number, Image[]>>("images");

storage.watch({
    images: (change) => {
        images = change.newValue;
    }
});

const handler: PlasmoMessaging.MessageHandler = async (_, response) => {
    response.send(await images);
};

export default handler;
