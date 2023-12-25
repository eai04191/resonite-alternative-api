import "@bogeychan/elysia-polyfills/node/index.js";

import { Elysia } from "elysia";
import { Redis } from "ioredis";

import { isJSON } from "./utils";

const redis = new Redis();
const app = new Elysia()
    .onAfterHandle(({ response, set }) => {
        if (isJSON(response)) {
            set.headers["Content-Type"] = "application/json; charset=utf-8";
        }
    })
    .get("/", () => ({ hello: "Node.js👋" }))
    .get(
        "/sessions",

        async () => {
            const keys = await redis.keys("*");
            const rawData = (await redis.mget(keys)).filter(
                (v) => v,
            ) as string[];
            return rawData.map((v) => JSON.parse(v));
        },
    )
    .get("/sessions/:id", async ({ params: { id } }) => {
        const data = await redis.get(id);
        return data;
    })
    .listen(3000);

console.log(`Listening on http://localhost:${app.server!.port}`);
