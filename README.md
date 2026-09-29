# PBG Carrier Truth

MVP para extraer y reconciliar solicitudes de cotización contra documentos emitidos por carriers. La interfaz muestra cliente, carrier, cobertura y premium, junto con el archivo, la página y el fragmento exacto del que proviene cada valor.

La aplicación no usa OpenAI ni otro servicio externo. Los PDFs suministrados contienen texto embebido, por lo que PDF.js realiza la extracción en el navegador y un motor de reglas determinista toma las decisiones de confianza.

## Ejecutar con Docker

Requisito: Docker Desktop o Docker Engine con Compose.

```bash
docker compose up
```

La primera ejecución construye la imagen e instala las dependencias. Cuando el healthcheck esté listo, abre:

```text
http://localhost:5173
```

Para reconstruir después de cambiar dependencias:

```bash
docker compose up --build
```

Para detener el proyecto:

```bash
docker compose down
```

## Ejecutar sin Docker

Requisito: Node.js 22.

```bash
cd src
npm install
npm run dev
```

Comandos de validación:

```bash
cd src
npm run typecheck
npm test
npm run build
```

## Estructura

```text
.
├── base/                       # Paquete original del reto, sin modificar
│   ├── documents/              # PDFs sintéticos C001-C006
│   ├── quote_requests.json
│   ├── README.md               # Enunciado original
│   └── RETO_UNIVERSAL_SCREEN_SHARING.md
├── src/                        # Aplicación React + TypeScript
│   ├── src/components/         # Tabla, estados y panel de evidencia
│   ├── src/lib/                # Extracción PDF y reconciliación
│   ├── public/                 # Favicon
│   └── vite.config.ts
├── Dockerfile
└── docker-compose.yml
```

Vite usa `base/` como directorio público durante el desarrollo y el build. De esta forma, la aplicación consume directamente el JSON y los PDFs originales sin duplicarlos ni alterarlos.

## Flujo de implementación

1. `loadQuoteRequests` obtiene las solicitudes desde `base/quote_requests.json`.
2. `extractDocument` abre cada PDF con PDF.js y agrupa los elementos de texto por coordenada vertical.
3. El extractor identifica título, applicant, carrier, face amount, premium, periodicidad y premiums adicionales.
4. Antes de confiar en los valores, valida que la fuente sea una `Carrier Illustration` y que no contenga una advertencia de documento no emitido.
5. `reconcileCase` compara los candidatos extraídos contra la solicitud y el valor mostrado en la UI.
6. Cada campo recibe un estado independiente y conserva evidencia con documento, página y texto literal.
7. La interfaz bloquea el resumen verificado cuando existe una contradicción o la fuente no es válida.

## Reglas de confianza

- Dinero y cobertura provienen del documento del carrier.
- Una coincidencia con la UI no vuelve válida una fuente que no fue emitida por el carrier.
- Importe y periodicidad se conservan tal como aparecen en el documento.
- No se infiere que un importe anual equivale a otro valor mensual si la UI no declara periodicidad.
- Un cliente genérico como `Client` no se vincula automáticamente a una persona solicitada.
- Los riders opcionales se presentan por separado y nunca se mezclan con el premium base.
- Una contradicción material produce una negativa explícita; no se resuelve silenciosamente.

## Casos cubiertos

| Caso | Resultado esperado | Regla principal |
| --- | --- | --- |
| C001 | Contradicción | `$450,000` solicitados frente a `$50` en el carrier |
| C002 | Verificado | Todos los campos coinciden |
| C003 | Contradicción | Cliente genérico y `$720 ANNUAL` frente a `60` en UI |
| C004 | Verificado | Todos los campos coinciden |
| C005 | Verificado con nota | Premium base y rider opcional permanecen separados |
| C006 | No verificable | Es una vista de portal, no una ilustración emitida |

## Decisiones y alcance

### Por qué no se usa un LLM

Los documentos del reto son estructurados, tienen una sola página y contienen texto embebido. Un parser determinista es más rápido, reproducible, auditable y fácil de probar. Para documentos escaneados o formatos desconocidos se podría añadir un adaptador OCR o multimodal, pero su salida seguiría pasando por el mismo motor de reglas; el modelo no decidiría por sí solo si un dato está verificado.

### Limitaciones conscientes

- El extractor reconoce las etiquetas incluidas en el paquete (`Applicant`, `Carrier`, `Face Amount`, `Premium`).
- No procesa PDFs escaneados sin capa de texto.
- La moneda del paquete se interpreta como USD por el símbolo `$`.
- La validez criptográfica o autenticidad externa del PDF no forma parte de este MVP.
- En producción, la extracción debería ejecutarse en backend, almacenar hashes de los archivos y persistir un audit log inmutable.

## Diseño

La interfaz toma como referencia otros proyectos: navegación lateral oscura, superficies claras, densidad de dashboard, tipografía Plus Jakarta Sans, tarjetas blancas y acento índigo. Se implementó desde cero para mantener el reto independiente y liviano.

