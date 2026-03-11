# Note Setup Toan Bo He Thong (Admin + TaiXiu Backend + Client Cocos)

Tai lieu nay dung de setup nhanh toan bo he thong tren may dev hoac VPS.

## 1. Tong quan thanh phan

- `admin-app` (root): Dashboard React + Electron, quan ly he thong.
- `server/taixiu-backend`: Backend game (TaiXiuDouble, TaiXiuMD5, BauCua, MiniPoker, XocDia).
- `client`: Du an Cocos Creator de build web game.
- `webgame`, `landing`, `cskh-app`: Cac module web phu tro.

## 2. Yeu cau moi truong

- Node.js: `20.x` (khuyen nghi >= `20.10.0`)
- npm: `10.x`
- MongoDB: `6.x` hoac `7.x`
- Git
- (Neu build client Cocos) Cocos Creator `2.4.4`

Kiem tra nhanh:

```bash
node -v
npm -v
mongod --version
```

## 3. Cai dat dependency

Chay tai thu muc goc du an:

```bash
cd C:\Users\Admin\Downloads\admin-app
npm install
npm --prefix server/taixiu-backend install
npm --prefix webgame install
npm --prefix landing install
npm --prefix cskh-app install
```

Neu chi can dashboard + taixiu-backend, bat buoc toi thieu:

```bash
npm install
npm --prefix server/taixiu-backend install
```

## 4. Cau hinh env

### 4.1 Root env (dashboard)

- Tao file `.env` (hoac `.env.dashboard`) tu `.env.example`.
- Bien quan trong:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lasvegas
TAIXIU_BACKEND_HOST=127.0.0.1
TAIXIU_BACKEND_PORT=18082
```

### 4.2 TaiXiu backend env

```bash
cd server/taixiu-backend
copy .env.example .env
```

Cac bien quan trong trong `server/taixiu-backend/.env`:

```env
PORT=18082
HOST=0.0.0.0
WS_PATH=/websocket
ENABLE_WEB_CLIENT=true
WEB_BUILD_DIR=../../client/build/web-mobile
MONGODB_URI=mongodb://127.0.0.1:27017/taixiu_dev
```

Neu muon dung chung du lieu account voi dashboard, co the dat cung 1 DB:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lasvegas
```

## 5. Chay local (khuyen nghi)

### Cach A (de debug ro rang)

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

### Cach B (nhanh)

```bash
cd C:\Users\Admin\Downloads\admin-app
npm start
```

Ghi chu: Dashboard da co co che tu thu start/retry TaiXiu backend khi gap `ECONNREFUSED`.

## 6. Kiem tra service da len

- TaiXiu backend health:

```text
http://127.0.0.1:18082/health
```

Ky vong:

```json
{ "ok": true, "time": "..." }
```

- Cac route game:
  - `http://127.0.0.1:18082/taixiudouble`
  - `http://127.0.0.1:18082/taixiumd5`
  - `http://127.0.0.1:18082/minipoker`
  - `http://127.0.0.1:18082/baucua`
  - `http://127.0.0.1:18082/xocdia`

- Route dev:
  - `http://127.0.0.1:18082/dev`

## 7. Build client Cocos de backend phuc vu truc tiep

1. Mo project Cocos trong thu muc `client`.
2. Build `Web Mobile` vao:

```text
client/build/web-mobile
```

3. Dam bao `server/taixiu-backend/.env` co:

```env
ENABLE_WEB_CLIENT=true
WEB_BUILD_DIR=../../client/build/web-mobile
```

4. Restart `taixiu-backend` sau moi lan build client.

## 8. Link truy cap game + token

Kieu route rieng:

```text
http://127.0.0.1:18082/taixiudouble?token=YOUR_TOKEN
http://127.0.0.1:18082/taixiumd5?token=YOUR_TOKEN
http://127.0.0.1:18082/minipoker?token=YOUR_TOKEN
http://127.0.0.1:18082/baucua?token=YOUR_TOKEN
http://127.0.0.1:18082/xocdia?token=YOUR_TOKEN
```

Kieu query chung:

```text
http://127.0.0.1:18082/?game=double&token=YOUR_TOKEN
```

Co the override endpoint khi can:

```text
&wsHost=127.0.0.1&wsPort=18082&wsSecure=0&apiHost=127.0.0.1&apiPort=18082&apiSecure=0
```

## 9. Build phat hanh Dashboard

```bash
cd C:\Users\Admin\Downloads\admin-app
npm run build:dashboard
```

Output nam trong `dist_electron/dashboard`.

## 10. Deploy VPS (goi y)

- Chay `taixiu-backend` bang PM2:

```bash
cd /path/to/admin-app/server/taixiu-backend
npm install
pm2 start src/index.js --name taixiu-backend
pm2 save
```

- Mo port backend (hoac reverse proxy qua Nginx).
- Neu dung domain + SSL:
  - Web game truy cap qua `https://...`
  - WS dung `wss://...`

## 11. Loi thuong gap va cach xu ly

### Loi: `ECONNREFUSED 127.0.0.1:18082`

Nguyen nhan: TaiXiu backend chua chay / sai port.

Khac phuc:

1. Chay `npm run start` trong `server/taixiu-backend`.
2. Kiem tra `http://127.0.0.1:18082/health`.
3. Dong mo lai dashboard.

### Loi: `Invalid url` (code `1-11`)

Nguyen nhan: Dang goi API cu khong dung route backend moi.

Khac phuc: Dung cac route duoc liet ke o muc 6/8.

### Loi ky tu tieng Viet bi vo

Khac phuc triệt để:

- Project da co `.editorconfig` ep `charset = utf-8`.
- VSCode nen set:
  - `files.encoding = utf8`
  - `files.autoGuessEncoding = false`

## 12. Checklist khoi dong nhanh moi ngay

1. Bat MongoDB.
2. Start `taixiu-backend`.
3. Start dashboard Electron.
4. Test `health` + mo game route.
5. Neu sua client Cocos: build lai `client/build/web-mobile` va restart backend.

---

Neu can, co the tach note nay thanh 2 file rieng:

- `SETUP_LOCAL.md`
- `SETUP_VPS.md`

