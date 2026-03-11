# Docker Setup (MongoDB + TaiXiu Backend)

Tai lieu nay dung de chay he thong bang Docker Compose.

## 1) Thanh phan duoc dong goi

- `mongo` (MongoDB 7)
- `taixiu-backend` (Node.js)
- `taixiu-seed` (service 1 lan de seed user test, chay theo profile)

Luu y: Dashboard Electron khong chay tot trong container thong thuong (can GUI/X11), nen phan nay khuyen nghi chay tren host may local/Windows.

## 2) Dieu kien

- Da cai Docker Desktop (Windows) hoac Docker Engine + Docker Compose (Linux)
- Da build client Cocos web neu muon backend phuc vu route game:
  - Thu muc can co: `client/build/web-mobile`

## 3) Chay stack

Tai root project (`admin-app`):

```bash
docker compose up -d --build
```

Kiem tra status:

```bash
docker compose ps
```

Xem log backend:

```bash
docker compose logs -f taixiu-backend
```

## 4) Seed user test (tu chon)

```bash
docker compose --profile seed run --rm taixiu-seed
```

User mau sau seed:

- `dev_player` / token `dev_token`
- `test1` / token `token_test1`
- `test2` / token `token_test2`

## 5) Endpoint sau khi chay

- Health: `http://localhost:18082/health`
- Dev page: `http://localhost:18082/dev`
- Game routes:
  - `http://localhost:18082/taixiudouble`
  - `http://localhost:18082/taixiumd5`
  - `http://localhost:18082/minipoker`
  - `http://localhost:18082/baucua`
  - `http://localhost:18082/xocdia`

## 6) Dung stack

```bash
docker compose down
```

Xoa ca data Mongo volume:

```bash
docker compose down -v
```

## 7) Ghi chu quan trong

- `WEB_BUILD_DIR` trong container duoc map den `/app/client-build`.
- Compose map host folder:
  - `./client/build/web-mobile -> /app/client-build (read-only)`
- Neu chua co build Cocos web, backend van chay API/WS, nhung route web game co the khong day du asset.

## 8) Dashboard ket noi den backend docker

Neu chay Dashboard tren host, de mac dinh la duoc:

- `TAIXIU_BACKEND_HOST=127.0.0.1`
- `TAIXIU_BACKEND_PORT=18082`

Dashboard se goi den backend dang expose qua port host `18082`.

## 9) Troubleshooting nhanh

### Loi `ECONNREFUSED 127.0.0.1:18082`

- Kiem tra container co chay khong:
  - `docker compose ps`
- Kiem tra log:
  - `docker compose logs taixiu-backend`

### Health fail vi Mongo chua san sang

- Cho them 10-30 giay roi check lai.
- Kiem tra:
  - `docker compose logs mongo`

### Game route vao duoc nhung trang trang

- Chua build Cocos web vao `client/build/web-mobile`.
- Build lai Cocos, sau do restart backend:

```bash
docker compose restart taixiu-backend
```
