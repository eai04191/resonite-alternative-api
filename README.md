# resonite-alternative-api

The API is compatible with api.resonite.com, but it can be called as many times as you like and is fast. Made for third party websites to call api.resonite.com/sessions fast.

All requests in this API should work in less than 50ms, whereas the official API takes 1-2 seconds.

## How it Works

This project mainly consists of two apps. API and SignalR-Client.
SignalR-Client behaves as if a Resonite client started by a non-login user connects to the Resonite server. It receives public session information in real time like a Resonite client. SignalR-Client writes to redis every time it receives information.

The API is built by [Elysia](https://elysiajs.com/) and provides a simple REST API (but only GET). It works very fast because it reads data from redis every time there is a request.

## Compatibility

Some behavior may differ from the official one. These are mainly due to undocumented server-side behavior. If you know or find any server-side behavior, please let us know and we may be able to provide better compatibility.

The model may be slightly different. For example, In `/sessions/:id`, if the description is not set for the session, the key itself will not exist in the official API, but in the alternative API the key will exist and the value will be null.

## Endpoints

### `/sessions`

- Search Query:
  - `compatibilityHash`
  - `name`
  - `universeId`
    - This query has not been specifically tested so I don't know if it will work properly.
  - `hostName`
  - `hostId`
  - `minActiveUsers`
  - `includeEmptyHeadless`

### `/sessions/:id`

- Search Query:
  - None

## Development

Running with turborepo and docker-compose.

```sh
docker compose -f docker-compose.dev.yml up
```

```sh
yarn dev
```

## Production

Running all with docker-compose.

```sh
docker compose up -d
```

## License

MIT
