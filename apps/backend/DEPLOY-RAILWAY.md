# Desplegar Backend en Railway (con PostgreSQL)

Pasos para dejar el backend y la base de datos funcionando en Railway.

---

## 1. Cuenta y proyecto

1. Entra en [railway.app](https://railway.app) e inicia sesión (GitHub recomendado).
2. **New Project**.
3. Elige **Deploy from GitHub repo** y conecta el repo `Gastro-Management-APP` (autoriza si pide permiso).
4. Selecciona el repositorio y la rama (ej. `main` o `develop`).

---

## 2. Añadir PostgreSQL (base de datos)

1. En el proyecto, clic en **+ New**.
2. Elige **Database** → **PostgreSQL**.
3. Railway crea el servicio y te asigna una **DATABASE_URL**.
4. Clic en el servicio de Postgres → pestaña **Variables**: verás `DATABASE_URL` (o **Connect** para copiar la URL). No hace falta copiarla a mano si enlazas el backend al servicio (paso siguiente).

---

## 3. Configurar el servicio Backend

1. En el mismo proyecto, **+ New** → **GitHub Repo** (o **Empty Service** si ya tienes un servicio creado al conectar el repo).
2. Si al conectar el repo Railway creó un servicio automático, usa ese y configura lo siguiente.

### 3.1 Variables de entorno

- Entra al servicio del **backend** (no al de Postgres).
- Pestaña **Variables**.
- Añade o verifica:
  - **DATABASE_URL**: la URL completa de Postgres. Si Postgres está en el mismo proyecto, usa **Add Reference** a la variable del servicio PostgreSQL (`DATABASE_URL` o `DATABASE_PUBLIC_URL`). Si Railway solo muestra `DATABASE_PUBLIC_URL`, copia su valor y créalo como variable **DATABASE_URL** (Prisma usa ese nombre). Ejemplo: `postgresql://usuario:password@host:puerto/railway?schema=public`.
  - **JWT_SECRET** (opcional): string aleatorio largo para producción.

No hace falta **PORT** (Railway la inyecta), ni **DB_USER**, **DB_PASSWORD** ni **DB_DATABASE** por separado: todo va en **DATABASE_URL**.

### 3.2 Configuración del build (monorepo)

En el servicio del backend:

1. **Settings** (o **Configure**).
2. **Root Directory**: `/apps/backend` (así Railway usa solo la carpeta del backend).
3. **Build Command** (reemplaza el que venga por defecto):
   ```bash
   npm ci && npx prisma generate && npm run build
   ```
   El build instala dependencias, genera Prisma Client y compila el backend. No debe aplicar cambios en PostgreSQL.
4. **Pre-Deploy Command**:
   ```bash
   npx prisma migrate deploy
   ```
   Este paso aplica únicamente las migraciones versionadas antes de iniciar la nueva versión de la aplicación.
5. **Start Command**:
   ```bash
   npm run start
   ```
   El proceso Start ejecuta `node dist/app.js` y **no debe modificar el esquema de PostgreSQL**.
6. **Watch Paths** (opcional): `apps/backend/**` para que solo los cambios en el backend disparen un nuevo deploy.

Guarda los cambios.

### 3.3 Seguridad de la baseline y comandos prohibidos

Una base de datos existente debe adoptar primero la baseline canónica de Prisma antes de habilitar `prisma migrate deploy` en producción. No actives el Pre-Deploy Command contra una base existente hasta completar y verificar ese proceso de adopción.

No deben utilizarse en producción:

```text
prisma db push
prisma db push --accept-data-loss
prisma migrate dev
prisma migrate reset
```

`prisma db push` no es un mecanismo productivo de despliegue ni de sincronización del esquema.

---

## 4. Primer deploy

1. Antes del primer despliegue contra una base existente, confirma que la base ya adoptó la baseline canónica de Prisma.
2. Si no se ha lanzado solo, en el servicio del backend usa **Deploy** (o haz un push a la rama conectada).
3. Verifica en los **logs** que Railway respete este orden:

   ```text
   BUILD
   npm ci
   → npx prisma generate
   → npm run build

   ↓

   PRE-DEPLOY
   npx prisma migrate deploy

   ↓

   START
   npm run start

   ↓

   node dist/app.js
   ```

   Si `prisma migrate deploy` falla en Pre-Deploy, revisa `DATABASE_URL`, la conectividad con el servicio PostgreSQL y el estado de adopción de la baseline. El proceso Start no debe intentar compensar un fallo de migración.
4. Cuando el estado sea **Success** / **Active**, Railway te dará una URL pública (ej. `https://tu-backend-production-xxxx.up.railway.app`).

---

## 5. Probar y usar la URL

1. Abre la URL del backend en el navegador: deberías ver algo como `{"message":"¡Backend de Gastro Management API funcionando!"}`.
2. Prueba un endpoint, ej. `GET /auth` o el que tengas (algunos requieren login).
3. Esa URL es la que usarás en el **frontend** como `NEXT_PUBLIC_API_URL` (o similar) en Vercel.

---

## 6. Seed (datos iniciales) – opcional

Si quieres cargar roles, permisos y usuario inicial:

1. En tu máquina, en la raíz del repo:
   ```bash
   cd apps/backend
   ```
2. Crea un `.env` temporal con la misma `DATABASE_URL` que tiene Railway (cópiala desde Railway → Postgres → Variables).
3. Ejecuta:
   ```bash
   npx dotenv -e .env -- npm run seed
   ```
   (o `npx ts-node -r dotenv/config prisma/seed.ts` con `DATABASE_URL` en `.env`).

O bien añade un script/step en Railway que ejecute el seed una vez (por ejemplo un job o un comando manual desde el dashboard si Railway lo permite).

---

## Resumen de configuración en Railway (backend)

| Campo | Valor |
|-------|-------|
| Root Directory | `/apps/backend` |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Pre-Deploy Command | `npx prisma migrate deploy` |
| Start Command | `npm run start` |
| Variables | `DATABASE_URL` (referenciada del servicio Postgres), `JWT_SECRET` |

La base de datos queda gestionada por Railway (PostgreSQL). Las migraciones se ejecutan exclusivamente mediante el **Pre-Deploy Command**, antes de iniciar la aplicación. El proceso Start solo ejecuta la aplicación compilada y no modifica el esquema.
