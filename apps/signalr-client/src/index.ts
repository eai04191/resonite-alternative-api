import signalR from "@microsoft/signalr";
import { Redis } from "ioredis";

console.log("Hello World");

const API_BASE_URL = "https://api.resonite.com";

async function main() {
    const redis = new Redis();

    const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/hub`)
        .configureLogging(signalR.LogLevel.Information)
        .build();
    connection.on("receivesessionupdate", (message) => {
        const json = JSON.stringify(message);
        redis.set(
            message.sessionId,
            json,
            "EX",
            60 * 10, // 10 minutes
        );
        console.log(
            "added session to redis: ",
            message.sessionId,
            message.hasEnded,
        );
    });
    connection.on("debug", () => {});
    connection.on("removesession", () => {});
    connection.on("sendstatustouser", () => {});
    connection.on("receivestatusupdate", () => {});

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
