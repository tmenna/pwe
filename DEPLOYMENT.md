# Deploying PWE Portal on a Linux Server (e.g. Linode)

This guide covers deploying the PWE Child Sponsorship Portal on a fresh Ubuntu 22.04 LTS server.

---

## 1. Server Setup

Recommended Linode plan: **Shared CPU — 2 GB RAM** (Nanode is fine for small teams)

```bash
# Log in as root, then create a non-root user
adduser pwe
usermod -aG sudo pwe
su - pwe
```

---

## 2. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # should print v20.x.x
```

---

## 3. Install PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER pwe WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE pwe OWNER pwe;
\c pwe
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOF
```

---

## 4. Upload the Application

Option A — Git:
```bash
sudo apt-get install -y git
git clone https://your-repo-url.git /home/pwe/app
cd /home/pwe/app
```

Option B — rsync from your local machine:
```bash
rsync -av --exclude node_modules --exclude dist . pwe@<server-ip>:/home/pwe/app
```

---

## 5. Environment Variables

Create `/home/pwe/app/.env`:

```env
NODE_ENV=production
PORT=5000

# PostgreSQL — format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://pwe:choose_a_strong_password@localhost:5432/pwe

# Session — generate with: openssl rand -hex 32
SESSION_SECRET=replace_with_64_hex_chars_from_openssl_rand

# File uploads — absolute path on disk
UPLOADS_DIR=/home/pwe/uploads

# Max upload size in MB (default: 20)
MAX_UPLOAD_SIZE_MB=20

# Optional: Google reCAPTCHA v3 (leave blank to disable)
# RECAPTCHA_SITE_KEY=
# RECAPTCHA_SECRET_KEY=
```

```bash
mkdir -p /home/pwe/uploads
chmod 750 /home/pwe/uploads
```

---

## 6. Install Dependencies and Build

```bash
cd /home/pwe/app
npm ci --omit=dev     # install production deps only
npm install           # needed for build tools (devDependencies)
npm run build         # builds frontend (dist/public/) + backend (dist/index.cjs)
```

> The build produces:
> - `dist/public/` — compiled React frontend (served as static files)
> - `dist/index.cjs` — compiled Express server

---

## 7. Push Database Schema

Run once after the first install (and again after any schema update):

```bash
cd /home/pwe/app
DATABASE_URL=postgresql://pwe:choose_a_strong_password@localhost:5432/pwe npm run db:push
```

The app auto-seeds on first startup: creates the `admin` user (password: `admin123`) and the three default organizations. **Change the admin password immediately after first login.**

---

## 8. Run as a systemd Service

Create `/etc/systemd/system/pwe.service`:

```ini
[Unit]
Description=PWE Child Sponsorship Portal
After=network.target postgresql.service

[Service]
Type=simple
User=pwe
WorkingDirectory=/home/pwe/app
EnvironmentFile=/home/pwe/app/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable pwe
sudo systemctl start pwe
sudo systemctl status pwe

# View logs
sudo journalctl -u pwe -f
```

---

## 9. Nginx Reverse Proxy

```bash
sudo apt-get install -y nginx
```

Create `/etc/nginx/sites-available/pwe`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Increase upload limit to match MAX_UPLOAD_SIZE_MB
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pwe /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. SSL with Let's Encrypt (HTTPS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# certbot will auto-modify the nginx config and set up renewal
sudo systemctl reload nginx
```

Renewal is automatic via a systemd timer. Verify with:
```bash
sudo certbot renew --dry-run
```

---

## 11. Uploaded Files — Backup Strategy

All uploaded files (child photos, sponsor photos, documents) are stored in `UPLOADS_DIR` on disk (`/home/pwe/uploads` by default). Include this directory in your backups:

```bash
# Example: daily rsync to a backup location
rsync -av /home/pwe/uploads/ backup-host:/backups/pwe-uploads/
```

Also back up the database:
```bash
pg_dump -U pwe pwe | gzip > /backups/pwe-$(date +%Y%m%d).sql.gz
```

---

## 12. Deploying Updates

```bash
cd /home/pwe/app
git pull                      # or rsync new files
npm install                   # install any new dependencies
npm run build                 # rebuild frontend + backend
npm run db:push               # apply any schema changes
sudo systemctl restart pwe
```

---

## 13. Docker / Docker Compose Alternative

If you prefer Docker, create this `docker-compose.yml` alongside a `Dockerfile`:

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
```

**docker-compose.yml:**
```yaml
version: "3.9"
services:
  app:
    build: .
    ports:
      - "5000:5000"
    env_file: .env
    volumes:
      - uploads:/home/pwe/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pwe
      POSTGRES_USER: pwe
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pwe"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
  uploads:
```

```bash
docker compose up -d
docker compose exec app npx drizzle-kit push  # first-run schema setup
```

---

## 14. Default Credentials

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |

**Change the admin password immediately after first login via User Management.**

---

## Summary Checklist

- [ ] Ubuntu 22.04 server provisioned
- [ ] Node.js 20 installed
- [ ] PostgreSQL installed and database created
- [ ] `.env` file created with all required variables
- [ ] `SESSION_SECRET` set to a strong random value (`openssl rand -hex 32`)
- [ ] `npm run build` completed successfully
- [ ] `npm run db:push` run (schema created)
- [ ] systemd service created and enabled
- [ ] Nginx configured as reverse proxy
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Admin password changed
- [ ] Uploads directory backed up regularly
- [ ] Database backed up regularly
