# MiniGame Backend (Node.js + MongoDB)

Server nay dung de chay test thuc cho:

- **TaiXiuDouble**
- **TaiXiuMD5**
- **BauCua**
- **MiniPoker**
- **XocDia**

- WebSocket binary protocol tuong thich client Cocos (cmd/login/bet/update/result/chat).
- Vong phien realtime (betting -> result -> new game).
- Luu du lieu MongoDB (users, sessions, bets, chats).
- API HTTP nho de monitor va seed test.

## 1) Cai dat

```bash
cd server/taixiu-backend
npm install
copy .env.example .env
```

## 2) Chay server

```bash
npm run start
```

Mac dinh:

- HTTP + WS: `http://localhost:18082`
- WS path: `/websocket`
- Mongo: `mongodb://127.0.0.1:27017/taixiu_dev`

## 3) Seed user test

```bash
npm run seed
```

User mau:

- `dev_player` / token `dev_token`
- `test1` / token `token_test1`
- `test2` / token `token_test2`

## 4) API test nhanh

- `GET /health`
- `GET /api/dev/users`
- `GET /api/dev/sessions?game=double&limit=20`
- `GET /api/dev/sessions?game=md5&limit=20`
- `GET /api/dev/sessions?game=baucua&limit=20`
- `GET /api/dev/sessions?game=minipoker&limit=20`
- `GET /api/dev/sessions?game=xocdia&limit=20`
- `GET /api?c=100&p=1&un=dev_player&mt=1&game=double` (lich su tai xiu)
- `GET /api?c=100&p=1&un=dev_player&mt=1&game=md5` (lich su md5)
- `GET /api?c=102&rid=180001&mt=1&game=double` (chi tiet phien)
- `GET /api?c=121&mt=1&p=1&un=dev_player` (lich su BauCua)
- `GET /api?c=120&mt=1` (top BauCua)
- `GET /api?c=105&mt=1&p=1&un=dev_player` (lich su MiniPoker)
- `GET /api?c=106&mt=1&p=1` (top MiniPoker)
- `GET /api?c=140&p=1&un=dev_player` (lich su XocDia)
- `POST /api/dev/users/credit` body:

```json
{
  "nickname": "dev_player",
  "amount": 500000
}
```

## 5) Ket noi tu Cocos build web

Ban truyen query khi mo web:

- `?game=double&wsHost=localhost&wsPort=18082&wsSecure=0`
- `?game=md5&wsHost=localhost&wsPort=18082&wsSecure=0`
- `?game=minipoker&wsHost=localhost&wsPort=18082&wsSecure=0`
- `?game=baucua&wsHost=localhost&wsPort=18082&wsSecure=0`
- `?game=xocdia&wsHost=localhost&wsPort=18082&wsSecure=0`

Hoac route:

- `/taixiudouble?wsHost=localhost&wsPort=18082&wsSecure=0`
- `/taixiumd5?wsHost=localhost&wsPort=18082&wsSecure=0`
- `/minipoker?wsHost=localhost&wsPort=18082&wsSecure=0`
- `/baucua?wsHost=localhost&wsPort=18082&wsSecure=0`
- `/xocdia?wsHost=localhost&wsPort=18082&wsSecure=0`

Client se tu set HTTP API local theo wsPort (hoac override bang `apiHost`, `apiPort`, `apiSecure`, `apiPath`).

`wsSecure=0` de su dung `ws://` local.

## 6) Ghi chu protocol

- Client gui packet co frame header (0x90 + size + controller + cmd + payload).
- Server tra packet dang body:
  - `controllerId (1 byte)`
  - `cmdId (2 bytes)`
  - `error (1 byte)`
  - `payload`

Dung format nay thi `Network.InPacket` ben Cocos parse dung truc tiep.
