# SETUP LOCAL (Admin + TaiXiu Backend + Client Cocos)

Tai lieu nay dung cho may dev/local.

## 1) Yeu cau

- Node.js 20.x
- npm 10.x
- MongoDB 6.x/7.x
- Cocos Creator 2.4.4 (neu build client)

Kiem tra nhanh:

```bash
node -v
npm -v
mongod --version
```

## 2) Cai dependency

```bash
cd C:\Users\Admin\Downloads\admin-app
npm install
npm --prefix server/taixiu-backend install
npm --prefix webgame install
npm --prefix landing install
npm --prefix cskh-app install
```

Toi thieu de chay dashboard + backend:

```bash
npm install
npm --prefix server/taixiu-backend install
```

## 3) Cau hinh env

### 3.1 Root (`admin-app`)

Tao file `.env` (hoac `.env.dashboard`) va dat:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lasvegas
TAIXIU_BACKEND_HOST=127.0.0.1
TAIXIU_BACKEND_PORT=18082
```

### 3.2 TaiXiu backend (`server/taixiu-backend`)

```bash
cd server/taixiu-backend
copy .env.example .env
```

Gia tri khuyen nghi:

```env
PORT=18082
HOST=0.0.0.0
WS_PATH=/websocket
ENABLE_WEB_CLIENT=true
WEB_BUILD_DIR=../../client/build/web-mobile
MONGODB_URI=mongodb://127.0.0.1:27017/taixiu_dev
```

Neu muon dung chung DB voi he thong account:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lasvegas
```

## 4) Chay local

Mo 2 terminal:

Terminal 1 - TaiXiu backend:

```bash
cd C:\Users\Admin\Downloads\admin-app\server\taixiu-backend
npm run start
```

Terminal 2 - Dashboard Electron:

```bash
cd C:\Users\Admin\Downloads\admin-app
npm run electron:dev:dashboard
```

Hoac chay nhanh:

```bash
cd C:\Users\Admin\Downloads\admin-app
npm start
```

## 5) Check service

- Health:

```text
http://127.0.0.1:18082/health
```

- Route game:
  - `http://127.0.0.1:18082/taixiudouble`
  - `http://127.0.0.1:18082/taixiumd5`
  - `http://127.0.0.1:18082/minipoker`
  - `http://127.0.0.1:18082/baucua`
  - `http://127.0.0.1:18082/xocdia`

- Route dev:
  - `http://127.0.0.1:18082/dev`

## 6) Build client Cocos de backend phuc vu truc tiep

1. Mo project `client` bang Cocos Creator.
2. Build Web Mobile vao:

```text
client/build/web-mobile
```

3. Dam bao `.env` backend co:

```env
ENABLE_WEB_CLIENT=true
WEB_BUILD_DIR=../../client/build/web-mobile
```

4. Restart backend sau moi lan build.

## 7) Link game + token

- Route rieng:

```text
http://127.0.0.1:18082/taixiudouble?token=YOUR_TOKEN
http://127.0.0.1:18082/taixiumd5?token=YOUR_TOKEN
http://127.0.0.1:18082/minipoker?token=YOUR_TOKEN
http://127.0.0.1:18082/baucua?token=YOUR_TOKEN
http://127.0.0.1:18082/xocdia?token=YOUR_TOKEN
```

- Dang query chung:

```text
http://127.0.0.1:18082/?game=double&token=YOUR_TOKEN
```

- Override endpoint khi can:

```text
&wsHost=127.0.0.1&wsPort=18082&wsSecure=0&apiHost=127.0.0.1&apiPort=18082&apiSecure=0
```

## 8) Loi thuong gap local

### `ECONNREFUSED 127.0.0.1:18082`

- Backend chua chay hoac sai port.
- Chay lai `npm run start` trong `server/taixiu-backend`.
- Check `http://127.0.0.1:18082/health`.

### `Invalid url` (code `1-11`)

- Dang goi sai route cu.
- Dung cac route o muc 5/7.

### Loi ky tu tieng Viet

- Project da co `.editorconfig` (UTF-8).
- VSCode nen de:
  - `files.encoding = utf8`
  - `files.autoGuessEncoding = false`

## 9) Checklist moi ngay

1. Bat MongoDB.
2. Chay TaiXiu backend.
3. Chay Dashboard.
4. Test health + route game.
5. Neu sua Cocos: build lai `client/build/web-mobile` + restart backend.
