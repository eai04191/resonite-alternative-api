import "@bogeychan/elysia-polyfills/node/index.js";

import { Elysia, Static, t } from "elysia";
import { createClient } from "redis";

import { isJSON } from "./utils.js";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const redis = createClient({ url: `redis://${REDIS_HOST}:6379` });
await redis.connect();

const Query = t.Object({
    compatibilityHash: t.Optional(t.String()),
    name: t.Optional(t.String()),
    universeId: t.Optional(t.String()),
    hostName: t.Optional(t.String()),
    hostId: t.Optional(t.String()),
    minActiveUsers: t.Optional(t.Numeric()),
    includeEmptyHeadless: t.Optional(t.Boolean()),
});

async function getSession({ sessionId }: { sessionId: string }) {
    const session = await redis.json.get(`session:${sessionId}`);
    return session;
}

async function getSessions({
    compatibilityHash,
    name,
    universeId,
    hostName,
    hostId,
    minActiveUsers,
    includeEmptyHeadless = false,
}: Static<typeof Query>) {
    const searchQuery =
        [
            compatibilityHash && `@compatibilityHash:{${compatibilityHash}}`,
            name && `@name:${name}`,
            universeId && `@universeId:{${universeId}}`,
            // 前方一致
            hostName && `@hostName:${hostName}*`,
            // -をエスケープ
            hostId && `@hostId:{${hostId.replaceAll(/-/g, "\\-")}}`,
            // includeEmptyHeadlessがtrueの場合はactiveUsersの条件を無視する
            // trueの場合でもわざわざqueryは追加しない（指定しなければ全てを返すため）
            // 1. includeEmptyHeadlessがfalseかつ
            !includeEmptyHeadless &&
                // 2. minActiveUsersが存在する場合
                minActiveUsers &&
                // 3. activeUsersの条件を追加
                `@activeUsers:[${minActiveUsers} inf]`,
        ]
            .join(" ")
            .trim() || "*";
    console.debug(JSON.stringify(searchQuery));
    const sessions = await redis.ft.search("idx:sessions", searchQuery, {
        // seriously?
        LIMIT: { from: 0, size: 10000 },
    });
    return sessions.documents.map((doc) => doc.value);
}

const app = new Elysia()
    .onAfterHandle(({ response, set }) => {
        if (isJSON(response)) {
            set.headers["Content-Type"] = "application/json; charset=utf-8";
        }
    })
    .get("/", () => ({ hello: "Node.js👋" }))
    .get(
        "/sessions",
        async ({ query }) => {
            const sessions = await getSessions(query);
            return sessions;
        },
        {
            query: Query,
            transform: ({ query }) => {
                query.minActiveUsers =
                    Number(query.minActiveUsers) || undefined;
                query.includeEmptyHeadless =
                    String(query.includeEmptyHeadless) === "true";
            },
        },
    )
    .get("/sessions/:sessionId", async ({ params: { sessionId } }) => {
        try {
            const session = await getSession({ sessionId });

            return session;
        } catch (error) {
            console.error(error);
        }
    })
    .listen(3000);

console.log(`Listening on http://localhost:${app.server!.port}`);
