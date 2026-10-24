# Despliegue

La app se despliega en **Vercel**. Este documento es la lista de todo lo
que hay que tener listo antes de que el equipo de campo salga a trabajar.

## 1. Base de datos

Cluster de **Azure DocumentDB for MongoDB vCore** (Free Tier).

- Free Tier: 32 GB, costo cero, de por vida, uno por suscripción.
- **Sin Backup/Restore.** El plan de continuidad es la exportación periódica
  al blob storage y el backup de los archivos de campo originales.
- **Sin Diagnostic Logging**: el consumo no se ve en el portal, pero se
  puede medir con `pnpm prueba:carga`.
- Se pausa a los 60 días de inactividad.

La URI tiene que llevar `retrywrites=false`: Cosmos no implementa los
reintentos de escritura del driver de MongoDB.

```
mongodb+srv://<usuario>:<contraseña-codificada>@<cluster>.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000
```

La contraseña va **percent-encoded**: `#`, `@`, `/`, `?`, `:` y `[` rompen el
parseo de la URI. `lib/server/env.ts` lo valida y avisa.

## 2. Variables de entorno en Vercel

| Variable | Para qué |
| --- | --- |
| `MONGODB_URI` | Conexión al cluster |
| `MONGODB_DB` | Nombre de la base (`geopin`) |
| `BETTER_AUTH_SECRET` | Firma de las sesiones, mínimo 32 caracteres |
| `BETTER_AUTH_URL` | Origen público, sin barra final |
| `BLOB_SAS_URL` | SAS de lectura del contenedor de tiles |
| `NEXT_PUBLIC_TILE_BASE_URL` | Ruta por la que la app pide los tiles (`/tiles`) |

`BETTER_AUTH_SECRET` se genera con:

```bash
openssl rand -base64 48
```

**No** se sube al repositorio. El `.gitignore` ignora `.env`, `.env.*` y
`.env*.local`; solo se versiona `.env.example`, que es una plantilla con
valores de ejemplo.

## 3. Preparar la base

```bash
pnpm db:indexes   # crea los índices
pnpm seed         # publica los esquemas y crea el primer administrador
```

El seeder necesita `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el entorno. El
administrador se crea **solo** ahí: el campo `role` tiene `input: false`, así
que el registro de usuarios nunca puede asignarse ese rol.

## 4. Blob storage de tiles

Ver `.docs/tiles-offline.md`. Resumen:

```bash
pnpm tiles:generar -- --bbox -66.95,10.43,-66.85,10.53 --desde ./tiles --subir
```

## 5. Verificación antes de salir a campo

```bash
pnpm verify
```

Comprueba contra el cluster real: los esquemas publicados, el administrador
con su rol, la escritura de una parcela, la idempotencia ante un reintento,
el control de concurrencia por módulo, el ciclo de esquemas, el de geometría,
el de GPS, el del dashboard, el de exportación y el de importación.

Si pasa entero, el backend está bien.

## 6. Carga

```bash
pnpm prueba:carga -- --parcelas 500
```

Medido contra el cluster real con 300 parcelas:

| Operación | Tiempo | RU |
| --- | --- | --- |
| Escritura | 21,5 s (13,9/s) | ~1500 RU en total, ~70 RU/s |
| Lectura masiva | 0,3 s | ~15 RU |

El pico estimado es de **70 RU/s**, muy por debajo del techo de 1000 RU/s
del free tier. Las escrituras van lentas por la latencia de red hacia la
región del cluster, no por un límite de Cosmos: 500 parcelas se sincronizan
en unos 36 segundos.

## 7. Despliegue

El repositorio está enlazado a Vercel: cada `merge` a `main` despliega.

```bash
git checkout main && git pull
pnpm test && pnpm typecheck && pnpm build
git merge feature/gis-platform-v3
```

## 8. Checklist de campo

- [ ] El equipo tiene la app instalada desde la raíz (`/`).
- [ ] En iOS, la PWA se agrega desde "Compartir → Agregar a inicio": sin eso
      no hay service worker y no hay mapa sin conexión.
- [ ] La app pide permiso de ubicación la primera vez. Sin permiso no hay GPS.
- [ ] Antes de salir, se descargó el área: "Mapa sin conexión → Descargar".
- [ ] Hay batería y los datos se sincronizan con WiFi cuando se puede.
- [ ] El equipo sabe que las capturas offline se sincronizan solas al
      recuperar la señal.
