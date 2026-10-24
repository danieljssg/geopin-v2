# Tiles offline: del extract de OSM al mapa sin señal

Este documento es el manual del pipeline que genera los tiles del área de
levantamiento y los sube al blob storage. La app de campo los descarga al
dispositivo y el mapa funciona sin cobertura.

## Por qué tiles propios

La [Tile Usage Policy de OSMF](https://operations.osmfoundation.org/policies/tiles/)
prohíbe explícitamente el uso offline y el prefetch contra
`tile.openstreetmap.org`:

> *"Offline use is not permitted on `tile.openstreetmap.org`. Features such as
> 'Download city/country for offline use' or 'Save area for later' rely on
> prefetch/bulk downloading and are therefore prohibited."*

Lo que **sí** está permitido es cachear mientras el usuario navega por el
viewport, que es lo que hace la regla de cache del service worker.

Además, en Venezuela es dudoso que exista una ortofoto pública y actualizada:
generar los tiles propios resuelve las dos cosas de una.

## Volumen del área

El área del levantamiento es de 10 × 10 km. En esa latitud un tile mide:

| Nivel | Lado del tile | Teselas del área | Volumen |
| --- | --- | --- | --- |
| z14 | ~2,4 km | ~30 | 0,6 MB |
| z15 | ~1,2 km | ~110 | 2 MB |
| z16 | ~600 m | ~380 | 8 MB |
| z17 | ~300 m | ~1.500 | 30 MB |
| z18 | ~150 m | ~5.700 | 110 MB |

**La app precachea z12 a z16** (unos 10 MB): es el mapa base con el que el
levantador se orienta. Los niveles finos se van llenando a medida que navega,
porque bajarlos de entrada son 150 MB de datos móviles.

## Pipeline

### 1. Descargar el extract

```bash
# Geofabrik publica extracts por país.
curl -O https://download.geofabrik.de/americas/venezuela-latest.osm.pbf
```

### 2. Renderizar la pirámide

```bash
tilemaker --output=levantamiento.mbtiles \
  --bbox=-66.95,10.43,-66.85,10.53 \
  --minzoom=12 --maxzoom=18 \
  --layers=water,roads,building,landuse,transit,boundary \
  --config=tilemaker.json \
  venezuela-latest.osm.pbf

mb-util --image_format=png --silent -o tiles levantamiento.mbtiles
```

`tilemaker` recorta por el bbox, así que no hace falta procesar todo el
país.

### 3. Subir al blob storage

Con la SAS (más simple):

```bash
export BLOB_SAS_URL='https://<cuenta>.blob.core.windows.net/tiles?sv=...&sig=...'
pnpm tiles:generar -- --bbox -66.95,10.43,-66.85,10.53 --desde ./tiles --subir
```

O con la CLI de Azure:

```bash
export BLOB_CONTAINER=tiles
export AZURE_STORAGE_CONNECTION_STRING='...'
pnpm tiles:generar -- --bbox -66.95,10.43,-66.85,10.53 --desde ./tiles --subir
```

Para ver el plan sin hacer nada:

```bash
pnpm tiles:generar -- --bbox -66.95,10.43,-66.85,10.53 --dry-run
```

### 4. Configurar la app

```
BLOB_SAS_URL=https://<cuenta>.blob.core.windows.net/tiles?sv=...&sig=...
NEXT_PUBLIC_TILE_BASE_URL=/tiles
```

`NEXT_PUBLIC_TILE_BASE_URL` es la ruta por la que la app pide los tiles. La
app los sirve con un route handler que los lee del blob, así el service
worker los cachea bajo el origen de la app y no hace falta exponer el
contenedor al público.

## Estructura en el blob

```
tiles/
  12/2048/1234.png
  12/2048/1235.png
  ...
```

Es la convención XYZ: primero el nivel, después la columna y la fila.

## En el campo

En la app de campo, el botón **"Mapa sin conexión → Descargar el área"**
calcula los tiles del área (la del polígono que se está trazando, o un radio
alrededor de la posición actual) y los baja al caché del service worker.

El progreso se muestra tile a tile y se puede cancelar. Si un tile falla, el
resto se sigue descargando: al final se informa cuántos quedaron sin bajar.

## Cuidado con la memoria

Un área de 10 × 10 km a z18 son ~7.500 teselas. Descargarlas todas de una
vez satura el almacenamiento del navegador y las del iOS. Por eso el
precacheo se limita a z16 y los niveles finos se piden bajo demanda.
