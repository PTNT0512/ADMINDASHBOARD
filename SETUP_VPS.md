# SETUP VPS (TaiXiu Backend + Web Route + Reverse Proxy)

Tai lieu nay dung cho deploy tren VPS Linux (khuyen nghi Ubuntu 22.04).

## 1) Kien truc khuyen nghi

- 1 process `taixiu-backend` (Node.js) chay qua PM2.
- MongoDB local hoac managed service.
- Nginx reverse proxy cho HTTP + WebSocket.
- SSL qua Certbot.

## 2) Cai moi truong tren VPS

```bash
sudo apt update
sudo apt install -y curl git nginx ufw
```

### Cai Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### Cai PM2

```bash
sudo npm i -g pm2
pm2 -v
```

### Cai MongoDB (neu dung local)

Cai theo huong dan chinh thuc MongoDB cho Ubuntu ban dang dung.
Sau do bat service:

```bash
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod
```

## 3) Dua code len VPS

```bash
cd /opt
sudo git clone <YOUR_REPO_URL> admin-app
sudo chown -R $USER:$USER /opt/admin-app
cd /opt/admin-app
```

## 4) Cai dependency

```bash
npm install
npm --prefix server/taixiu-backend install
```

Neu can web module phu tro:

```bash
npm --prefix webgame install
npm --prefix landing install
npm --prefix cskh-app install
```

## 5) Cau hinh env cho backend

```bash
cd /opt/admin-app/server/taixiu-backend
cp .env.example .env
```

Mau `.env` VPS:

```env
PORT=18082
HOST=127.0.0.1
WS_PATH=/websocket
ENABLE_WEB_CLIENT=true
WEB_BUILD_DIR=../../client/build/web-mobile
MONGODB_URI=mongodb://127.0.0.1:27017/lasvegas
```

Ghi chu:
- Nen de `HOST=127.0.0.1` va publish qua Nginx.
- Neu web build dat o noi khac, sua `WEB_BUILD_DIR` cho dung.

## 6) Build client Cocos (neu phuc vu web game tren cung VPS)

Ban co 2 cach:

### Cach A: Build tren may local roi upload

- Build Cocos ra `client/build/web-mobile`.
- Upload folder build len VPS dung dung duong dan backend dang tro toi.

### Cach B: Build ngay tren may co Cocos (thuong la local CI)

- Build artifact
- Copy len VPS trong deploy pipeline.

## 7) Chay backend bang PM2

```bash
cd /opt/admin-app/server/taixiu-backend
pm2 start src/index.js --name taixiu-backend
pm2 save
pm2 startup
```

Kiem tra:

```bash
pm2 status
pm2 logs taixiu-backend --lines 100
curl http://127.0.0.1:18082/health
```

## 8) Nginx reverse proxy (HTTP + WS)

Tao file `/etc/nginx/sites-available/taixiu.conf`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:18082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /websocket {
        proxy_pass http://127.0.0.1:18082/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }
}
```

Enable config:

```bash
sudo ln -s /etc/nginx/sites-available/taixiu.conf /etc/nginx/sites-enabled/taixiu.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 9) Bat SSL (khuyen nghi)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Sau khi co SSL:
- Client dung `wss://` (set `wsSecure=1`)
- URL game theo domain HTTPS.

## 10) Mo firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 11) Bien moi truong lien quan dashboard (neu dashboard o may khac)

Neu dashboard khong chay cung may backend, can set:

```env
TAIXIU_BACKEND_HOST=YOUR_DOMAIN_OR_IP
TAIXIU_BACKEND_PORT=80   # hoac 443 neu qua https + xu ly tuong ung
```

Khuyen nghi goi qua domain/reverse proxy thay vi expose truc tiep port Node.

## 12) Deploy/update quy trinh

Moi lan update code:

```bash
cd /opt/admin-app
git pull
npm install
npm --prefix server/taixiu-backend install
pm2 restart taixiu-backend
pm2 logs taixiu-backend --lines 100
```

Neu update client build:
1. Copy build moi vao `client/build/web-mobile` (hoac path da cau hinh).
2. `pm2 restart taixiu-backend`.

## 13) Checklist production

1. `pm2 status` la online.
2. `curl /health` tra `ok: true`.
3. Route game truy cap duoc:
   - `/taixiudouble`
   - `/taixiumd5`
   - `/minipoker`
   - `/baucua`
   - `/xocdia`
4. WS ket noi duoc tai `/websocket`.
5. SSL hop le neu dung domain.
