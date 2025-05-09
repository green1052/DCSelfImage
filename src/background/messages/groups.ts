import type { PlasmoMessaging } from "@plasmohq/messaging";
import { Storage } from "@plasmohq/storage";

const storage = new Storage();
let groups = storage.get<Group[]>("groups");

storage.watch({
    groups: (change) => {
        groups = change.newValue;
    }
});

const handler: PlasmoMessaging.MessageHandler = async (_, response) => {
    response.send(await groups);
};

export default handler;
