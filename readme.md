# DAFP Soporte Técnico — Sistema de Gestión de Inventario, Mantenimientos y Actas Digitales

> **Plataforma web integral para el control de inventario de equipos de cómputo, seguimiento de órdenes de soporte preventivo/correctivo y emisión formal de actas técnicas con firma digital y exportación a PDF y Excel.**

---

## 1. Título del Proyecto y Descripción General

### **Título:** 
**DAFP Soporte Técnico — Plataforma de Gestión de Activos Informáticos y Documentación Digital**

### **Problemática que resuelve:**
En entidades públicas y entornos corporativos como **DAFP Soporte Técnico**, la administración descentralizada del parque computacional suele gestionarse a través de planillas dispersas o registros físicos en papel. Esto genera:
1. **Pérdida de trazabilidad:** Dificultad para auditar el ciclo de vida, reubicaciones y modificaciones de hardware en cada dependencia.
2. **Fallas en la atención técnica:** Falta de visibilidad de los equipos en mantenimiento preventivo o correctivo, ocasionando cuellos de botella operativos.
3. **Inseguridad documental:** Emisión de actas de entrega, reportes de soporte y devolución sin firmas estandarizadas ni respaldos digitales centralizados.

Esta aplicación resuelve de manera directa dicha problemática al proveer un entorno web unificado y accesible que centraliza el inventario en tiempo real, controla las órdenes de servicio técnico, captura firmas manuscritas digitales en pantalla y genera automáticamente actas oficiales en PDF y reportes analíticos en Excel (.xlsx), garantizando persistencia híbrida (archivo local `data.json` y almacenamiento `localStorage`).

---

## 2. Tecnologías y Librerías Utilizadas

El sistema fue diseñado con un enfoque modular, de alto rendimiento y sin dependencias pesadas de empaquetado (*zero-build architecture*):

- **HTML5 Semántico:** Estructuración mediante landmarks accesibles (`<header>`, `<main>`, `<section>`, `<figure>`, `<table>`, `<dialog>`), atributos ARIA (`aria-live`, `aria-label`, `aria-expanded`, `aria-modal`) y validaciones nativas de formulario conformes a las pautas **WCAG 2.1 Nivel AA**.
- **CSS3 Moderno:** Arquitectura de estilos escalable basada en *Design Tokens* con CSS Custom Properties, maquetación responsiva híbrida (CSS Grid y Flexbox), microinteracciones optimizadas para la GPU (`transform`, `opacity`), contención de renderizado (`contain: layout style`) y directivas oficiales de impresión `@media print`.
- **JavaScript Nativo (ES6+):** Programación modular orientada al negocio bajo el **Principio de Responsabilidad Única (SRP)**, manipulaciones seguras del DOM con escape de caracteres HTML contra ataques XSS, algoritmo de búsqueda reactiva con *debounce*, seguimiento de navegación con *throttling* vía `requestAnimationFrame` y Canvas API para firma manuscrita capacitiva/táctil.
- **JSON (JavaScript Object Notation):** Estructura relacional desacoplada en `data.json` que actúa como base de datos de catálogos maestros, usuarios RBAC, equipos, órdenes de mantenimiento, actas técnicas e historial cronológico de auditoría.
- **Python 3 (`server.py`):** Micro-servidor HTTP local multihilo (`ThreadingHTTPServer` y `SimpleHTTPRequestHandler`) que provee el servicio de archivos estáticos y un endpoint RESTful (`POST /api/guardar`) para la sincronización y persistencia atómica en disco del archivo `data.json`.
- **Librerías Client-Side (CDN):**
  - **SheetJS (`xlsx.full.min.js` v0.18.5):** Generación binaria y exportación en el navegador de hojas de cálculo reales en formato Microsoft Excel (`.xlsx`) con metadatos estructurados y fallback a CSV codificado en UTF-8 con BOM.
  - **jsPDF (`jspdf.umd.min.js` v2.5.1):** Motor vectorial en el cliente para el armado programático de actas oficiales en PDF con paginación, foliado institucional, tipografía calibrada e incrustación de la firma digital rasterizada.
  - **Google Fonts (Manrope):** Tipografía corporativa contemporánea optimizada mediante preconexión DNS (`preconnect`).

---

## 3. Estructura del Repositorio

A continuación se detalla la organización de los archivos que integran el proyecto y la responsabilidad específica de cada uno:

```
avanceproyecto_DiegoFlores/
├── index.html          # Interfaz de usuario principal: estructura semántica, formularios, modales y tablas.
├── style.css           # Sistema de diseño: variables, componentes visuales, estados de validación y CSS print.
├── app.js              # Controlador principal (SRP): lógica de negocio, validaciones, canvas, PDF y Excel.
├── data.json           # Fuente de datos centralizada (catálogos, usuarios, equipos, mantenimientos, actas).
├── server.py           # Servidor HTTP en Python para persistencia automática de datos en disco vía API REST.
└── README.md           # Documentación técnica y operativa completa del proyecto.
```

### **Detalle funcional de los componentes clave:**
- **[index.html](file:///c:/Users/PC/Documents/Diego%20Flores%20actividades/bases%20de%20la%20programaci%C3%B3n/paginas%20web/avanceproyecto_DiegoFlores/index.html):** Define la estructura semántica de la página. Incluye la barra superior con buscador de series y menú de roles, el hero informativo, el cuadro de métricas resumidas, la tabla interactiva de inventario con paginador, la tabla de órdenes de mantenimiento, los formularios de alta con canvas de firma y el visualizador interactivo de actas.
- **[style.css](file:///c:/Users/PC/Documents/Diego%20Flores%20actividades/bases%20de%20la%20programaci%C3%B3n/paginas%20web/avanceproyecto_DiegoFlores/style.css):** Define la identidad gráfica corporativa del DAFP. Emplea variables centralizadas para colores accesibles, sombras de elevación, estados de error (`.invalid`, `.err`), diseño responsivo adaptable a dispositivos móviles y una plantilla limpia de impresión que aísla únicamente el documento generado.
- **[app.js](file:///c:/Users/PC/Documents/Diego%20Flores%20actividades/bases%20de%20la%20programaci%C3%B3n/paginas%20web/avanceproyecto_DiegoFlores/app.js):** Núcleo funcional dividido en módulos especializados: capa de persistencia híbrida, gestión de roles (Administrador, Técnico, Auditor), renderizado declarativo de tablas, validaciones de reglas de negocio (series únicas de 5 dígitos, bloqueo de actas para equipos dados de baja), firma digital y generación de reportes.
- **[data.json](file:///c:/Users/PC/Documents/Diego%20Flores%20actividades/bases%20de%20la%20programaci%C3%B3n/paginas%20web/avanceproyecto_DiegoFlores/data.json):** Repositorio de datos estructurado en formato JSON estándar que contiene los catálogos institucionales (tipos de equipo, estados, dependencias, tipos de acta) y las colecciones de registros.
- **[server.py](file:///c:/Users/PC/Documents/Diego%20Flores%20actividades/bases%20de%20la%20programaci%C3%B3n/paginas%20web/avanceproyecto_DiegoFlores/server.py):** Script de backend en Python que expone un servidor en el puerto `8085` (o el que se configure) y permite que cualquier modificación hecha desde la interfaz web se guarde de forma permanente en el archivo físico `data.json`.

---

## 4. Instrucciones de Instalación y Configuración

El proyecto no requiere gestores de dependencias como `npm` ni compiladores previos. Se puede desplegar en minutos siguiendo cualquiera de los siguientes métodos:

### **Opción A: Ejecución Local con Servidor Python (Recomendada con persistencia en disco)**

Esta modalidad activa el backend local para que cada equipo creado o acta emitida se escriba directamente en `data.json`.

1. **Verificar prerrequisitos:**
   Asegúrese de tener instalado Python 3.8 o superior abriendo una terminal:
   ```bash
   python --version
   ```

2. **Navegar a la carpeta del proyecto:**
   ```bash
   cd "avanceproyecto_DiegoFlores"
   ```

3. **Iniciar el servidor local:**
   Ejecute el script `server.py` incluido en el proyecto:
   ```bash
   python server.py
   ```
   *El terminal indicará que el servidor está escuchando activamente en el puerto local (por defecto `http://localhost:8085` o `http://127.0.0.1:8085`).*

4. **Abrir en el navegador:**
   Ingrese a la siguiente dirección en Google Chrome, Microsoft Edge o Firefox:
   ```
   http://localhost:8085
   ```

---

### **Opción B: Despliegue en la Nube (Vercel, GitHub Pages, Netlify)**

El sistema cuenta con un motor de contingencia resiliente (*graceful degradation*): si no se detecta el servidor Python de fondo, utiliza automáticamente `localStorage` del navegador y ofrece un botón en la barra superior para descargar el archivo `data.json` actualizado.

1. **Subir el repositorio:** Suba los archivos (`index.html`, `style.css`, `app.js`, `data.json`) a su repositorio de GitHub.
2. **Conectar a la plataforma de hosting:**
   - En **Vercel** o **Netlify**, importe el repositorio y seleccione la configuración por defecto de proyecto estático (*Static Site*).
   - En **GitHub Pages**, diríjase a *Settings* -> *Pages* y elija la rama `main` en la carpeta raíz `/root`.
3. **Acceder a la URL pública:** La aplicación funcionará de manera inmediata y 100% interactiva en cualquier dispositivo.

---

## 5. Guía Rápida de Uso

Siga estos pasos para operar las funcionalidades principales del software:

### **Paso 1: Demostración del Control de Acceso por Roles (RBAC)**
- En la esquina superior derecha, haga clic en el botón de usuario (por defecto **Diego Flores - Administrador**).
- En el menú desplegable, cambie el rol a **Técnico** o **Auditor**:
  - **Administrador:** Acceso irrestricto a registro de equipos, edición, generación de actas, completado de mantenimientos y gestión de usuarios.
  - **Técnico:** Permite registrar equipos, dar soporte y firmar actas; oculta la gestión de usuarios.
  - **Auditor:** Modo de solo lectura; oculta botones de acción y formularios de edición.

### **Paso 2: Búsqueda y Filtrado Dinámico de Inventario**
- En la barra superior, escriba en el campo **Buscar por n.º de serie** (ejemplo: `00001` o `00003`). El inventario se actualizará en tiempo real con una respuesta optimizada por *debounce*.
- En la sección **Inventario de equipos**, utilice los selectores de **Categoría** (CPU, Laptop, Monitor), **Estado** (Activo, En Mantenimiento, Dado de Baja) y **Ubicación** para acotar los resultados.
- Presione **Limpiar filtros** para restaurar la vista completa paginada.

### **Paso 3: Exportación del Inventario a Excel (.xlsx)**
- En el panel de inventario, haga clic en el botón verde con icono institucional **Exportar a Excel** (o en **Descargar Excel** junto a los filtros).
- El sistema compilará en milisegundos un archivo nativo de Microsoft Excel nombrado `inventario_equipos_dafp_[fecha].xlsx` con encabezados formateados, series tabulares y el estado operativo de cada equipo.

### **Paso 4: Registro de un Nuevo Equipo Informático**
- Desplácese a la sección **Nuevo equipo** (o use el botón de acceso directo del Hero).
- Complete los campos requeridos:
  - **Número de serie:** Debe contener exactamente 5 dígitos numéricos únicos (ej. `00005`).
  - **Marca y Modelo:** Ingrese el fabricante y referencia técnica (ej. *Lenovo ThinkCentre*).
  - **Tipo y Ubicación:** Seleccione las opciones correspondientes del catálogo institucional.
- Presione **Guardar equipo**. El sistema validará los datos, persistirá el equipo en el archivo y emitirá una notificación de éxito.

### **Paso 5: Emisión de Actas Técnicas con Firma Digital**
- En el formulario **Acta / Reporte técnico**:
  - Seleccione el **Tipo de documento** (*Acta de entrega*, *Reporte de mantenimiento* o *Acta de devolución*).
  - Elija el equipo de destino en la lista desplegable.
  - Ingrese el nombre del funcionario **Responsable** y la **Fecha** de la diligencia.
  - Redacte la **Descripción técnica** (cuenta con contador dinámico de 500 caracteres y validación de longitud mínima).
  - En el recuadro de **Firma digital**, capture el trazo manuscrito con el ratón o en pantalla táctil (puede usar el botón *Borrar firma* si requiere corregirlo).
- Presione **Generar acta**. El sistema vinculará el acta al historial del equipo y lo redirigirá al visualizador.

### **Paso 6: Descarga en PDF e Impresión Oficial**
- En el **Visualizador de documentos**, seleccione cualquier acta emitida en la lista de folios.
- Haga clic en **Descargar PDF** para obtener un documento con membrete institucional, especificaciones del hardware, datos del responsable y la firma digital incrustada.
- Opcionalmente, presione **Imprimir** para enviar el acta a la impresora física usando la hoja de estilo optimizada que remueve automáticamente menús, cabeceras y elementos ajenos al documento.

### **Paso 7: Cierre de Órdenes de Mantenimiento**
- En la sección **Mantenimientos**, identifique los mantenimientos con estado *Pendiente* o *En curso*.
- Haga clic en **Marcar completado**. La orden cambiará a estado *Completado* y, si el equipo no posee más incidentes abiertos, su estado en el inventario cambiará automáticamente de *En Mantenimiento* a *Activo*.
