# GeoPin — Tutorial de uso

Sistema para marcar establecimientos, viviendas y edificaciones en un mapa mientras
caminas por el vecindario. Usa el GPS del navegador para posicionarte, rellena el
formulario y guarda cada punto de interés en un archivo JSON persistente.

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js     | 18.x o superior |
| pnpm        | 8.x o superior (recomendado) |
| Navegador   | Chrome, Firefox, Safari o Edge modernos |

> El sistema también funciona con `npm` o `yarn`. Sustituye `pnpm` en los
> comandos siguientes si usas otro gestor de paquetes.

---

## Instalacion y puesta en marcha

### 1. Clonar o descomprimir el proyecto

```bash
# Si clonaste desde un repositorio:
git clone <url-del-repositorio>
cd geopin

# Si descargaste el ZIP:
unzip geopin.zip
cd geopin
```

### 2. Instalar dependencias

```bash
pnpm install
```

Esto instala Next.js, React, Leaflet, react-leaflet y el resto de paquetes
declarados en `package.json`.

### 3. Arrancar el servidor de desarrollo

```bash
pnpm dev
```

El servidor arranca en `http://localhost:3000` por defecto.

### 4. Compilar para produccion

```bash
pnpm build
pnpm start
```

---

## Estructura del proyecto

```
geopin/
├── app/
│   ├── api/
│   │   └── pins/
│   │       └── route.ts       # API REST: GET / POST / DELETE
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Pagina principal (pantalla dividida)
├── components/
│   ├── MapView.tsx            # Mapa Leaflet / OpenStreetMap
│   ├── PinForm.tsx            # Formulario de captura
│   └── PinsList.tsx           # Lista de pins guardados
├── data/
│   └── pins.json              # Base de datos local (archivo JSON)
├── lib/
│   ├── categories.ts          # Configuracion de categorias (colores, abreviaturas)
│   └── types.ts               # Tipos TypeScript compartidos
└── TUTORIAL.md
```

---

## Como funciona

### Pantalla dividida

Al abrir la aplicacion verás dos paneles:

- **Panel izquierdo (360 px):** formulario de captura y lista de pins guardados.
- **Panel derecho:** mapa interactivo OpenStreetMap.

### Flujo de uso paso a paso

1. **Deteccion GPS automatica**  
   Al cargar la pagina el navegador solicita permiso de ubicacion.  
   - Si aceptas, el mapa vuele automaticamente a tu posicion y el marcador se
     coloca en ella. Los campos Latitud / Longitud del formulario se actualizan.
   - Si rechazas, el mapa muestra una vista general y debes hacer clic
     manualmente para colocar el pin.

2. **Posicionar el marcador**  
   Tienes tres formas de mover el marcador activo (el que tiene el simbolo `+`):
   - **Arrastrar:** mantén pulsado el marcador y sueltalo en la nueva posicion.
   - **Clic en el mapa:** haz clic en cualquier punto del mapa.
   - **Teclear coordenadas:** escribe los valores directamente en los campos
     Latitud / Longitud del formulario.

3. **Rellenar el formulario**

   | Campo       | Tipo         | Descripcion                              |
   |-------------|--------------|------------------------------------------|
   | Latitud     | Numero       | Se actualiza con el mapa automaticamente |
   | Longitud    | Numero       | Se actualiza con el mapa automaticamente |
   | Nombre      | Texto        | Nombre del establecimiento (obligatorio) |
   | Descripcion | Texto largo  | Referencias, notas adicionales           |
   | Categoria   | Selector     | Tipo de edificacion (ver lista abajo)    |

4. **Guardar el pin**  
   Haz clic en **Guardar Pin**. El punto aparecera inmediatamente en el mapa
   con el icono de su categoria y en la lista del panel izquierdo.

5. **Ver detalles de un pin guardado**  
   Haz clic sobre cualquier marcador del mapa para ver un popup con nombre,
   categoria, descripcion y coordenadas.

6. **Eliminar un pin**  
   - Desde la lista: icono de papelera al lado derecho del pin.
   - Desde el mapa: boton "Eliminar" dentro del popup.

7. **Exportar a JSON**  
   En la cabecera de la lista haz clic en **Exportar JSON** para descargar el
   archivo `geopin-YYYY-MM-DD.json` con todos los pins.

---

## Controles del mapa

| Control               | Accion                              |
|-----------------------|-------------------------------------|
| Boton `+` (esquina)   | Acercar (zoom in)                   |
| Boton `−` (esquina)   | Alejar (zoom out)                   |
| Rueda del raton       | Zoom con scroll                     |
| Clic en el mapa       | Mover el pin activo a esa posicion  |
| Arrastrar marcador    | Mover el pin activo libremente      |
| Clic en marcador      | Abrir popup con detalles            |

---

## Categorias disponibles

| Valor interno      | Etiqueta           |
|--------------------|--------------------|
| `vivienda`         | Vivienda           |
| `edificio`         | Edificio           |
| `hospital`         | Hospital           |
| `restaurante`      | Restaurante        |
| `abasto`           | Abasto             |
| `clinica`          | Clinica            |
| `escuela`          | Escuela            |
| `cancha_deportiva` | Cancha Deportiva   |
| `auditorio`        | Auditorio          |
| `estadio`          | Estadio            |
| `centro_deportivo` | Centro Deportivo   |
| `gimnasio`         | Gimnasio           |
| `bodega`           | Bodega             |
| `kiosko`           | Kiosko             |
| `centro_comercial` | Centro Comercial   |
| `local_comercial`  | Local Comercial    |
| `taller`           | Taller             |
| `garaje`           | Garaje             |
| `hotel`            | Hotel              |
| `posada`           | Posada             |
| `otro`             | Otro               |

Cada categoria tiene un **color unico** y una **abreviatura** que aparece
dentro del icono del marcador en el mapa.

---

## Estructura del archivo JSON

Cada pin guardado en `data/pins.json` (y en el archivo exportado) tiene esta forma:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "lat": 10.480612,
  "lng": -66.903588,
  "nombre": "Bodega El Palmar",
  "descripcion": "Esquina con calle principal, frente a la plaza",
  "categoria": "abasto",
  "creadoEn": "2026-07-09T14:32:00.000Z"
}
```

| Campo      | Tipo   | Descripcion                                |
|------------|--------|--------------------------------------------|
| `id`       | string | UUID v4 generado automaticamente           |
| `lat`      | number | Latitud decimal (WGS84)                    |
| `lng`      | number | Longitud decimal (WGS84)                   |
| `nombre`   | string | Nombre del establecimiento                 |
| `descripcion` | string | Descripcion libre (puede estar vacia)   |
| `categoria` | string | Valor interno de la categoria             |
| `creadoEn` | string | Fecha/hora ISO 8601 en UTC                 |

---

## API REST interna

La aplicacion expone tres endpoints en `/api/pins`:

```
GET  /api/pins          Devuelve la lista completa de pins (array JSON)
POST /api/pins          Crea un nuevo pin (cuerpo: PinFormData en JSON)
DELETE /api/pins        Elimina un pin por id (cuerpo: { "id": "..." })
```

Puedes usarlos desde cualquier cliente HTTP si necesitas integrar GeoPin con
otras herramientas:

```bash
# Listar todos los pins
curl http://localhost:3000/api/pins

# Crear un pin manualmente
curl -X POST http://localhost:3000/api/pins \
  -H "Content-Type: application/json" \
  -d '{"lat":10.48,"lng":-66.90,"nombre":"Test","descripcion":"","categoria":"otro"}'

# Eliminar un pin
curl -X DELETE http://localhost:3000/api/pins \
  -H "Content-Type: application/json" \
  -d '{"id":"550e8400-e29b-41d4-a716-446655440000"}'
```

---

## Comandos de referencia rapida

```bash
pnpm install      # Instalar dependencias
pnpm dev          # Servidor de desarrollo  → http://localhost:3000
pnpm build        # Compilar para produccion
pnpm start        # Arrancar servidor de produccion
pnpm lint         # Revisar codigo con ESLint
```

---

## Notas de privacidad

El GPS solo se activa cuando el usuario acepta el permiso en el navegador.
Ningun dato se envia a servidores externos: los pins se guardan exclusivamente
en el archivo local `data/pins.json` del servidor donde corre la aplicacion.
