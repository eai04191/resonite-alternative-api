import signalR from "@microsoft/signalr";
import { createClient, SchemaFieldTypes } from "redis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
// データをredisに保存する際の有効期限
const REDIS_TTL = 60 * 5;
const API_BASE_URL = "https://api.resonite.com";

async function initialFetch() {
    return await fetch(`${API_BASE_URL}/sessions`, {
        method: "GET",
    }).then((res) => res.json());
}

async function initialInsert({
    redis,
    initialData,
}: {
    redis: ReturnType<typeof createClient>;
    initialData: any[];
}) {
    const promises = initialData.map(async (session) => {
        const key = `session:${session.sessionId}`;
        console.log(`${key} insert`);
        await redis.json.set(key, "$", session);
        console.log(`${key} set expire`);
        await redis.expire(key, REDIS_TTL);
    });

    await Promise.all(promises);
}

async function main() {
    const redis = createClient({
        url: `redis://${REDIS_HOST}:6379`,
    });
    redis.on("error", (err) => console.log("Redis Client Error", err));
    await redis.connect();

    try {
        await redis.ft.create(
            "idx:sessions",
            {
                "$.compatibilityHash": {
                    type: SchemaFieldTypes.TAG,
                    AS: "compatibilityHash",
                },
                "$.name": {
                    type: SchemaFieldTypes.TEXT,
                    AS: "name",
                },
                "$.universeId": {
                    type: SchemaFieldTypes.TAG,
                    AS: "universeId",
                },
                "$.hostUsername": {
                    type: SchemaFieldTypes.TEXT,
                    AS: "hostName",
                },
                "$.hostUserId": {
                    type: SchemaFieldTypes.TAG,
                    AS: "hostId",
                },
                "$.activeUsers": {
                    type: SchemaFieldTypes.NUMERIC,
                    AS: "activeUsers",
                },
            },
            {
                ON: "JSON",
                PREFIX: "session:",
            },
        );
        console.log("Index created.");
    } catch (e) {
        if ((e as Error).message === "Index already exists") {
            console.log("Index exists already, skipped creation.");
        } else {
            // Something went wrong, perhaps RediSearch isn't installed...
            console.error(e);
            process.exit(1);
        }
    }

    const initialData = await initialFetch();
    console.log("initial data fetched");
    await initialInsert({ redis, initialData });
    console.log("initial data inserted");

    const connection = new signalR.HubConnectionBuilder()
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds() {
                // Retry every 0~10 seconds
                return Math.random() * 10 * 1000;
            },
        })
        .withUrl(`${API_BASE_URL}/hub`)
        .configureLogging(signalR.LogLevel.Information)
        .build();
    connection.on("ReceiveSessionUpdate", async (message) => {
        console.time(`updated session:${message.sessionId}`);
        await redis.json.set(`session:${message.sessionId}`, "$", message);
        await redis.expire(`session:${message.sessionId}`, REDIS_TTL);
        console.timeEnd(`updated session:${message.sessionId}`);
    });
    connection.on("debug", () => {});
    connection.on("RemoveSession", async (message) => {
        await redis.json.del(`session:${message}`);
        console.log(`removed session:${message}`);
    });
    connection.on("SendStatusToUser", () => {});
    connection.on("ReceiveStatusUpdate", () => {});

    process.on("beforeExit", () => {
        console.log("beforeExit: disconnecting");
        connection.stop();
        redis.quit();
        console.log("beforeExit: disconnected");
    });

    await connection.start();
    console.log("signalr client started");
}

main();
