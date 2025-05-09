import type { PlasmoMessaging } from "@plasmohq/messaging";
import { Storage } from "@plasmohq/storage";

const storage = new Storage();
let galleries = storage.get<Gallery[]>("galleries");

storage.watch({
    galleries: (change) => {
        galleries = change.newValue;
    }
});

const handler: PlasmoMessaging.MessageHandler = async (_, response) => {
    response.send(await galleries);
};

export default handler;
