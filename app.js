/* DAFP Soporte técnico — lógica de negocio, eventos e interactividad */
const CLAVE_LOCALSTORAGE = "dafp_soporte_v1";
const EQUIPOS_POR_PAGINA = 6;
const obtenerFechaHoy = () => new Date().toISOString().slice(0, 10);
const $ = (selector, contexto = document) => contexto.querySelector(selector);
const escaparHtml = (cadena) =>
  String(cadena ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[caracter]));

const SEMILLA_INICIAL = {
  catalogos: {
    tipos: ["CPU", "Laptop", "Monitor", "Periférico"],
    estados: ["Activo", "En Mantenimiento", "Dado de Baja"],
    ubicaciones: ["Oficina Central", "Almacén TI"],
    tiposActa: ["Acta de entrega", "Reporte de mantenimiento", "Acta de devolución"]
  },
  usuarios: [{ id: 1, nombre: "Diego Flores", correo: "dafp2008@gmail.com", rol: "Administrador" }],
  equipos: [],
  mantenimientos: [],
  actas: [],
  historial: []
};

const estadoAplicacion = {
  db: null,
  rol: "Administrador",
  pagina: 1,
  actaActual: null,
  firmaHecha: false
};

/* ---------- Persistencia y lectura de datos ---------- */
function migrarDatos(baseDatos) {
  const nombresSustitutos = {
    "Laura Méndez": "Diego Flores",
    "Carlos Ríos": "Luis Blanco",
    "Andrea Salcedo": "Luis Blanco",
    "Mario Torres": "David Garcia"
  };
  const correosSustitutos = {
    "Diego Flores": "dafp2008@gmail.com",
    "Luis Blanco": "luis.blanco@dafp.gov",
    "David Garcia": "david.garcia@dafp.gov"
  };

  baseDatos.usuarios = (baseDatos.usuarios || [])
    .filter((usuario) => !(usuario.rol === "Técnico" && usuario.nombre === "Andrea Salcedo"))
    .map((usuario) => {
      const nombreActualizado = nombresSustitutos[usuario.nombre] || usuario.nombre;
      return { ...usuario, nombre: nombreActualizado, correo: correosSustitutos[nombreActualizado] || usuario.correo };
    });

  baseDatos.mantenimientos?.forEach((mantenimiento) => {
    mantenimiento.tecnico = nombresSustitutos[mantenimiento.tecnico] || mantenimiento.tecnico;
  });

  baseDatos.actas?.forEach((acta) => {
    acta.creadaPor = nombresSustitutos[acta.creadaPor] || acta.creadaPor;
    if (!acta.tipoDocumento) acta.tipoDocumento = "Acta de entrega";
  });

  if (!baseDatos.catalogos) baseDatos.catalogos = {};
  if (!baseDatos.catalogos.tiposActa) {
    baseDatos.catalogos.tiposActa = ["Acta de entrega", "Reporte de mantenimiento", "Acta de devolución"];
  }

  const seriesMigradas = new Map([
    ["DAFP-CPU-0001", "00001"],
    ["DAFP-CPU-0002", "00002"],
    ["DAFP-LAP-0003", "00003"]
  ]);
  baseDatos.equipos?.forEach((equipo) => {
    equipo.serie = seriesMigradas.get(equipo.serie) || equipo.serie;
  });

  // REGLA: Al depurar equipos eliminados, se purgan en cascada sus mantenimientos, actas e historial asociados.
  const seriesInicialesEliminadas = new Set([
    "DAFP-MON-0004", "DAFP-MON-0005", "DAFP-PER-0006", "DAFP-LAP-0007",
    "DAFP-CPU-0008", "DAFP-MON-0009", "DAFP-PER-0010", "DAFP-LAP-0011",
    "DAFP-CPU-0012", "DAFP-PER-0013"
  ]);
  const cantidadEquiposAntes = baseDatos.equipos?.length || 0;
  baseDatos.equipos = (baseDatos.equipos || []).filter((equipo) => !seriesInicialesEliminadas.has(equipo.serie));
  if (baseDatos.equipos.length !== cantidadEquiposAntes) {
    const idsEquiposValidos = new Set(baseDatos.equipos.map((equipo) => equipo.id));
    baseDatos.mantenimientos = (baseDatos.mantenimientos || []).filter((mantenimiento) => idsEquiposValidos.has(mantenimiento.equipoId));
    baseDatos.actas = (baseDatos.actas || []).filter((acta) => idsEquiposValidos.has(acta.equipoId));
    baseDatos.historial = (baseDatos.historial || []).filter((registroHistorial) => idsEquiposValidos.has(registroHistorial.equipoId));
  }
  return baseDatos;
}

async function cargarDatos() {
  let datosDesdeJson = null;
  try {
    const respuesta = await fetch("data.json", { cache: "no-store" });
    if (respuesta.ok) {
      datosDesdeJson = await respuesta.json();
    }
  } catch (errorRed) {
    /* continúa si falla la lectura remota */
  }

  const datosGuardadosLocal = localStorage.getItem(CLAVE_LOCALSTORAGE);
  let datosDesdeLocal = null;
  if (datosGuardadosLocal) {
    try {
      datosDesdeLocal = JSON.parse(datosGuardadosLocal);
    } catch (errorParseo) {}
  }

  // Priorizamos data.json si existe en disco; pero si localStorage tiene más registros, sincronizamos hacia el disco
  if (datosDesdeJson && datosDesdeLocal) {
    const totalEquiposJson = datosDesdeJson.equipos?.length || 0;
    const totalEquiposLocal = datosDesdeLocal.equipos?.length || 0;
    if (totalEquiposLocal > totalEquiposJson) {
      guardarEnArchivoServidor(datosDesdeLocal);
      return migrarDatos(datosDesdeLocal);
    }
    return migrarDatos(datosDesdeJson);
  }

  if (datosDesdeJson) return migrarDatos(datosDesdeJson);
  if (datosDesdeLocal) return migrarDatos(datosDesdeLocal);

  const avisoElemento = $("#avisoDatos");
  avisoElemento.hidden = false;
  avisoElemento.innerHTML = '<div class="aviso">No se pudo leer data.json. Abre el proyecto con <code>python server.py</code> y recarga la página.</div>';
  return structuredClone(SEMILLA_INICIAL);
}

async function guardarEnArchivoServidor(datos) {
  try {
    const respuesta = await fetch("/api/guardar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos, null, 2)
    });
    return respuesta.ok;
  } catch (errorConexion) {
    return false;
  }
}

async function guardar() {
  localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify(estadoAplicacion.db));
  const guardadoExitoso = await guardarEnArchivoServidor(estadoAplicacion.db);
  if (guardadoExitoso) {
    console.log("[SERVIDOR] data.json actualizado en disco exitosamente.");
  }
}

function descargarDataJson() {
  const contenidoJson = JSON.stringify(estadoAplicacion.db, null, 2);
  const blobJson = new Blob([contenidoJson], { type: "application/json;charset=utf-8;" });
  const urlDescarga = URL.createObjectURL(blobJson);
  const enlaceDescarga = document.createElement("a");
  enlaceDescarga.href = urlDescarga;
  enlaceDescarga.download = "data.json";
  document.body.appendChild(enlaceDescarga);
  enlaceDescarga.click();
  document.body.removeChild(enlaceDescarga);
  URL.revokeObjectURL(urlDescarga);
  toast("data.json descargado para tu proyecto.");
}

const buscarEquipoPorId = (equipoId) => estadoAplicacion.db.equipos.find((equipo) => equipo.id === Number(equipoId));
const siguienteId = (coleccion) => coleccion.reduce((maximoId, elemento) => Math.max(maximoId, elemento.id), 0) + 1;
const addHistorial = (equipoId, evento) => estadoAplicacion.db.historial.push({ equipoId, fecha: obtenerFechaHoy(), evento });

/* ---------- Utilidades de UI ---------- */
function toast(mensaje, esError = false) {
  const toastElemento = $("#toast");
  toastElemento.textContent = mensaje;
  toastElemento.className = "toast on" + (esError ? " error" : "");
  clearTimeout(toast.temporizador);
  toast.temporizador = setTimeout(() => (toastElemento.className = "toast"), 3200);
}

const claseEstado = (estado) =>
  ({
    "Activo": "b-ok",
    "En Mantenimiento": "b-warn",
    "Dado de Baja": "b-bad",
    "Pendiente": "b-bad",
    "En curso": "b-warn",
    "Completado": "b-ok"
  }[estado] || "b-info");

const badge = (estado) => `<span class="badge ${claseEstado(estado)}">${escaparHtml(estado)}</span>`;

const opciones = (coleccion, elementoSeleccionado, opcionInicial) =>
  (opcionInicial ? `<option value="">${opcionInicial}</option>` : "") +
  coleccion.map((opcion) => `<option ${opcion === elementoSeleccionado ? "selected" : ""}>${escaparHtml(opcion)}</option>`).join("");

const puede = (...rolesPermitidos) => rolesPermitidos.includes(estadoAplicacion.rol);

const debounce = (funcionEjecutable, retrasoMilisegundos = 200) => {
  let temporizador;
  return (...argumentos) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcionEjecutable(...argumentos), retrasoMilisegundos);
  };
};

/* ---------- Roles ---------- */
function aplicarRol() {
  document.body.dataset.rol = estadoAplicacion.rol;
  document.querySelectorAll("[data-roles]").forEach((elemento) => {
    elemento.hidden = !elemento.dataset.roles.split(",").includes(estadoAplicacion.rol);
  });
  const usuarioActivo = estadoAplicacion.db.usuarios.find((usuario) => usuario.rol === estadoAplicacion.rol) || estadoAplicacion.db.usuarios[0];
  $("#userName").textContent = usuarioActivo.nombre;
  $("#userRole").textContent = estadoAplicacion.rol;
  $("#avatar").textContent = usuarioActivo.nombre.split(" ").map((palabra) => palabra[0]).slice(0, 2).join("");
  renderTodo();
}

/* ---------- Render ---------- */
function renderTodo() {
  renderResumen();
  renderFiltros();
  renderTabla();
  renderMant();
  renderUsuarios();
  renderNotif();
  renderSelectsForm();
  renderSelActa();
}

function renderResumen() {
  const { equipos, mantenimientos, actas } = estadoAplicacion.db;
  $("#statTotal").textContent = equipos.length;
  $("#statMant").textContent = equipos.filter((equipo) => equipo.estado === "En Mantenimiento").length;
  $("#statPend").textContent = mantenimientos.filter((mantenimiento) => mantenimiento.estado === "Pendiente").length;
  $("#statActas").textContent = actas.length;
  const ultimaActa = actas[actas.length - 1];
  $("#statActasSub").textContent = ultimaActa ? `Última: ${ultimaActa.fecha}` : "Sin actas aún";
}

function renderFiltros() {
  const catalogos = estadoAplicacion.db.catalogos;
  const obtenerValor = (selector) => $(selector).value;
  const categoriaSeleccionada = obtenerValor("#fCategoria");
  const estadoSeleccionado = obtenerValor("#fEstado");
  const ubicacionSeleccionada = obtenerValor("#fUbicacion");

  $("#fCategoria").innerHTML = opciones(catalogos.tipos, categoriaSeleccionada, "Todas");
  $("#fEstado").innerHTML = opciones(catalogos.estados, estadoSeleccionado, "Todos");
  $("#fUbicacion").innerHTML = opciones(catalogos.ubicaciones, ubicacionSeleccionada, "Todas");
}

function equiposFiltrados() {
  const categoriaFiltro = $("#fCategoria").value;
  const estadoFiltro = $("#fEstado").value;
  const ubicacionFiltro = $("#fUbicacion").value;
  const terminoBusqueda = $("#buscadorSerie").value.trim().toLowerCase();

  return estadoAplicacion.db.equipos.filter((equipo) =>
    (!categoriaFiltro || equipo.tipo === categoriaFiltro) &&
    (!estadoFiltro || equipo.estado === estadoFiltro) &&
    (!ubicacionFiltro || equipo.ubicacion === ubicacionFiltro) &&
    (!terminoBusqueda || equipo.serie.toLowerCase().includes(terminoBusqueda))
  );
}

function renderTabla() {
  const listaEquipos = equiposFiltrados();
  const totalPaginas = Math.max(1, Math.ceil(listaEquipos.length / EQUIPOS_POR_PAGINA));
  estadoAplicacion.pagina = Math.min(estadoAplicacion.pagina, totalPaginas);
  const indiceInicio = (estadoAplicacion.pagina - 1) * EQUIPOS_POR_PAGINA;
  const equiposEnPagina = listaEquipos.slice(indiceInicio, indiceInicio + EQUIPOS_POR_PAGINA);
  const puedeEditar = puede("Administrador", "Técnico");

  $("#conteoResultados").textContent = `${listaEquipos.length} equipo${listaEquipos.length === 1 ? "" : "s"} encontrado${listaEquipos.length === 1 ? "" : "s"}`;
  $("#tbodyEquipos").innerHTML = equiposEnPagina.length ? equiposEnPagina.map((equipo) => `
    <tr>
      <td class="serie">${escaparHtml(equipo.serie)}</td>
      <td>${escaparHtml(equipo.marca)} ${escaparHtml(equipo.modelo)}</td>
      <td>${escaparHtml(equipo.tipo)}</td>
      <td>${escaparHtml(equipo.ubicacion)}</td>
      <td>${badge(equipo.estado)}</td>
      <td class="right"><span class="row-actions">
        <button data-act="historial" data-id="${equipo.id}">Historial</button>
        ${puedeEditar ? `<button data-act="editar" data-id="${equipo.id}">Editar</button>
        <button data-act="acta" data-id="${equipo.id}" ${equipo.estado === "Dado de Baja" ? 'disabled title="Un equipo dado de baja no admite actas"' : ""}>Generar acta</button>` : ""}
      </span></td>
    </tr>`).join("") : `<tr><td colspan="6" class="empty">No hay equipos con esos filtros. Prueba limpiarlos.</td></tr>`;

  let botonesPaginacion = `<button ${estadoAplicacion.pagina === 1 ? "disabled" : ""} data-p="${estadoAplicacion.pagina - 1}" aria-label="Anterior">‹</button>`;
  for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina++) {
    botonesPaginacion += `<button class="${numeroPagina === estadoAplicacion.pagina ? "is-on" : ""}" data-p="${numeroPagina}">${numeroPagina}</button>`;
  }
  botonesPaginacion += `<button ${estadoAplicacion.pagina === totalPaginas ? "disabled" : ""} data-p="${estadoAplicacion.pagina + 1}" aria-label="Siguiente">›</button>`;
  $("#pager").innerHTML = botonesPaginacion;
}

function renderMant() {
  const puedeEditar = puede("Administrador", "Técnico");
  const mantenimientosOrdenados = [...estadoAplicacion.db.mantenimientos].sort((primerMantenimiento, segundoMantenimiento) =>
    segundoMantenimiento.fecha.localeCompare(primerMantenimiento.fecha)
  );
  $("#tbodyMant").innerHTML = mantenimientosOrdenados.map((mantenimiento) => {
    const equipoAsociado = buscarEquipoPorId(mantenimiento.equipoId);
    return `<tr><td>${escaparHtml(mantenimiento.fecha)}</td><td><span class="serie">${escaparHtml(equipoAsociado?.serie || "—")}</span><br><small class="muted">${escaparHtml(mantenimiento.detalle)}</small></td>
      <td>${escaparHtml(mantenimiento.tipo)}</td><td>${escaparHtml(mantenimiento.tecnico)}</td><td>${badge(mantenimiento.estado)}</td>
      ${puedeEditar ? `<td class="right">${mantenimiento.estado !== "Completado" ? `<span class="row-actions"><button data-mant="${mantenimiento.id}">Marcar completado</button></span>` : ""}</td>` : ""}</tr>`;
  }).join("");
}

function renderUsuarios() {
  $("#tbodyUsuarios").innerHTML = estadoAplicacion.db.usuarios.map((usuario) =>
    `<tr><td>${escaparHtml(usuario.nombre)}</td><td>${escaparHtml(usuario.correo)}</td><td>${badge(usuario.rol)}</td></tr>`
  ).join("");
}

function renderNotif() {
  const mantenimientosPendientes = estadoAplicacion.db.mantenimientos.filter((mantenimiento) => mantenimiento.estado !== "Completado");
  $("#notifCount").textContent = mantenimientosPendientes.length;
  $("#notifCount").hidden = !mantenimientosPendientes.length;
  $("#notifPanel").innerHTML = `<p class="dropdown__title">Mantenimientos por atender</p><ul>${mantenimientosPendientes.map((mantenimiento) =>
    `<li><strong>${escaparHtml(buscarEquipoPorId(mantenimiento.equipoId)?.serie)}</strong> · ${escaparHtml(mantenimiento.tipo)} (${escaparHtml(mantenimiento.estado)})</li>`
  ).join("") || "<li>Todo al día.</li>"}</ul>`;
}

function renderSelectsForm() {
  const catalogos = estadoAplicacion.db.catalogos;
  const formNuevoEquipo = $("#formEquipo");
  formNuevoEquipo.tipo.innerHTML = opciones(catalogos.tipos, formNuevoEquipo.tipo.value, "Selecciona un tipo");
  formNuevoEquipo.ubicacion.innerHTML = opciones(catalogos.ubicaciones, formNuevoEquipo.ubicacion.value, "Selecciona una ubicación");

  const formNuevaActa = $("#formActa");
  if (formNuevaActa.tipoDocumento && catalogos.tiposActa) {
    const tipoDocumentoActual = formNuevaActa.tipoDocumento.value || catalogos.tiposActa[0];
    formNuevaActa.tipoDocumento.innerHTML = catalogos.tiposActa.map((tipo) =>
      `<option value="${escaparHtml(tipo)}" ${tipo === tipoDocumentoActual ? "selected" : ""}>${escaparHtml(tipo)}</option>`
    ).join("");
  }
  const equipoPrevioSeleccionado = formNuevaActa.equipoId.value;
  formNuevaActa.equipoId.innerHTML = `<option value="">Selecciona un equipo</option>` +
    estadoAplicacion.db.equipos.map((equipo) =>
      `<option value="${equipo.id}" ${String(equipo.id) === equipoPrevioSeleccionado ? "selected" : ""}>${escaparHtml(equipo.serie)} — ${escaparHtml(equipo.marca)} ${escaparHtml(equipo.modelo)}</option>`
    ).join("");
  if (!formNuevaActa.fecha.value) formNuevaActa.fecha.value = obtenerFechaHoy();
}

function renderSelActa() {
  const selectorActas = $("#selActa");
  selectorActas.innerHTML = estadoAplicacion.db.actas.length
    ? estadoAplicacion.db.actas.map((acta) =>
        `<option value="${acta.id}" ${acta.id === estadoAplicacion.actaActual ? "selected" : ""}>${escaparHtml(acta.tipoDocumento || "Acta")} #${acta.id} — ${escaparHtml(buscarEquipoPorId(acta.equipoId)?.serie)}</option>`
      ).join("")
    : `<option value="">Sin actas</option>`;
  if (estadoAplicacion.actaActual == null && estadoAplicacion.db.actas.length) {
    estadoAplicacion.actaActual = estadoAplicacion.db.actas[estadoAplicacion.db.actas.length - 1].id;
  }
  selectorActas.value = estadoAplicacion.actaActual ?? "";
  renderDoc();
}

function renderDoc() {
  const actaActual = estadoAplicacion.db.actas.find((acta) => acta.id === Number(estadoAplicacion.actaActual));
  if (!actaActual) {
    $("#docPreview").innerHTML = '<p class="muted">Genera o selecciona un acta para ver su vista previa.</p>';
    return;
  }
  const equipoAsociado = buscarEquipoPorId(actaActual.equipoId) || {};
  const tituloDocumento = actaActual.tipoDocumento || "Acta de entrega y reporte técnico";
  $("#docPreview").innerHTML = `
    <div class="doc__head"><div><h3>${escaparHtml(tituloDocumento)}</h3><span class="muted">DAFP Soporte técnico</span></div><strong>N.º ${String(actaActual.id).padStart(4, "0")}</strong></div>
    <dl>
      <dt>Tipo de documento</dt><dd>${escaparHtml(tituloDocumento)}</dd>
      <dt>Equipo</dt><dd>${escaparHtml(equipoAsociado.marca)} ${escaparHtml(equipoAsociado.modelo)} (${escaparHtml(equipoAsociado.tipo)})</dd>
      <dt>Número de serie</dt><dd>${escaparHtml(equipoAsociado.serie)}</dd>
      <dt>Ubicación</dt><dd>${escaparHtml(equipoAsociado.ubicacion)}</dd>
      <dt>Responsable</dt><dd>${escaparHtml(actaActual.responsable)}</dd>
      <dt>Fecha</dt><dd>${escaparHtml(actaActual.fecha)}</dd>
      <dt>Descripción técnica</dt><dd>${escaparHtml(actaActual.descripcion)}</dd>
      <dt>Elaboró</dt><dd>${escaparHtml(actaActual.creadaPor)}</dd>
    </dl>
    <p><strong>Firma del responsable</strong></p>
    ${actaActual.firma ? `<img src="${actaActual.firma}" alt="Firma digital">` : '<p class="muted">Sin firma digital registrada (acta de ejemplo).</p>'}`;
}

/* ---------- Validación de formularios ---------- */
function marcarCampoInvalido(campoElemento, mensajeError) {
  const contenedorCampo = campoElemento.closest(".field");
  contenedorCampo.classList.toggle("invalid", !!mensajeError);
  contenedorCampo.querySelector(".err").textContent = mensajeError || "";
  return !mensajeError;
}

function validarEquipo(formularioEquipo, ignorarEquipoId = null) {
  let esValido = true;
  const serie = formularioEquipo.serie.value.trim().toUpperCase();
  let mensajeError = "";

  // REGLA: El número de serie debe ser único en el sistema y tener exactamente 5 dígitos numéricos.
  if (!serie) mensajeError = "El número de serie es obligatorio.";
  else if (!/^\d{5}$/.test(serie)) mensajeError = "Usa exactamente 5 números, por ejemplo 00001.";
  else if (estadoAplicacion.db.equipos.some((equipo) => equipo.serie === serie && equipo.id !== ignorarEquipoId)) {
    mensajeError = "Ya existe un equipo con este número de serie.";
  }
  esValido = marcarCampoInvalido(formularioEquipo.serie, mensajeError) && esValido;
  esValido = marcarCampoInvalido(formularioEquipo.marca, formularioEquipo.marca.value.trim().length < 2 ? "Escribe la marca (mínimo 2 caracteres)." : "") && esValido;
  esValido = marcarCampoInvalido(formularioEquipo.modelo, formularioEquipo.modelo.value.trim() ? "" : "Escribe el modelo.") && esValido;
  esValido = marcarCampoInvalido(formularioEquipo.tipo, formularioEquipo.tipo.value ? "" : "Selecciona un tipo.") && esValido;
  esValido = marcarCampoInvalido(formularioEquipo.ubicacion, formularioEquipo.ubicacion.value ? "" : "Selecciona una ubicación.") && esValido;
  return esValido;
}

function validarActa(formularioActa) {
  let esValido = true;
  if (formularioActa.tipoDocumento && !formularioActa.tipoDocumento.value) {
    esValido = marcarCampoInvalido(formularioActa.tipoDocumento, "Selecciona el tipo de documento.") && esValido;
  }
  const equipoSeleccionado = buscarEquipoPorId(formularioActa.equipoId.value);
  let mensajeError = "";

  // REGLA: Los equipos con estado 'Dado de Baja' quedan inhabilitados para emitir nuevas actas.
  if (!equipoSeleccionado) mensajeError = "Selecciona un equipo.";
  else if (equipoSeleccionado.estado === "Dado de Baja") mensajeError = "Un equipo dado de baja no puede tener actas.";
  esValido = marcarCampoInvalido(formularioActa.equipoId, mensajeError) && esValido;
  esValido = marcarCampoInvalido(formularioActa.responsable, formularioActa.responsable.value.trim().length < 5 ? "Escribe el nombre completo del responsable." : "") && esValido;

  // REGLA: No se admiten fechas futuras en la emisión de actas técnicas.
  mensajeError = "";
  if (!formularioActa.fecha.value) mensajeError = "Indica la fecha.";
  else if (formularioActa.fecha.value > obtenerFechaHoy()) mensajeError = "La fecha no puede ser futura.";
  esValido = marcarCampoInvalido(formularioActa.fecha, mensajeError) && esValido;
  esValido = marcarCampoInvalido(formularioActa.descripcion, formularioActa.descripcion.value.trim().length < 20 ? "Describe con al menos 20 caracteres." : "") && esValido;

  $("#errFirma").textContent = estadoAplicacion.firmaHecha ? "" : "La firma digital es obligatoria.";
  $("#firma").closest(".field").classList.toggle("invalid", !estadoAplicacion.firmaHecha);
  return esValido && estadoAplicacion.firmaHecha;
}

/* ---------- Firma digital (canvas) ---------- */
function iniciarFirma() {
  const canvasFirma = $("#firma");
  const contextoCanvas = canvasFirma.getContext("2d");
  contextoCanvas.lineWidth = 2.4;
  contextoCanvas.lineCap = "round";
  contextoCanvas.strokeStyle = "#0B2447";
  let dibujando = false;

  const obtenerCoordenadasPuntero = (eventoPuntero) => {
    const rectanguloCanvas = canvasFirma.getBoundingClientRect();
    return [
      (eventoPuntero.clientX - rectanguloCanvas.left) * (canvasFirma.width / rectanguloCanvas.width),
      (eventoPuntero.clientY - rectanguloCanvas.top) * (canvasFirma.height / rectanguloCanvas.height)
    ];
  };

  canvasFirma.addEventListener("pointerdown", (evento) => {
    dibujando = true;
    canvasFirma.setPointerCapture(evento.pointerId);
    contextoCanvas.beginPath();
    contextoCanvas.moveTo(...obtenerCoordenadasPuntero(evento));
  });

  canvasFirma.addEventListener("pointermove", (evento) => {
    if (!dibujando) return;
    contextoCanvas.lineTo(...obtenerCoordenadasPuntero(evento));
    contextoCanvas.stroke();
    estadoAplicacion.firmaHecha = true;
    $("#errFirma").textContent = "";
  });

  ["pointerup", "pointercancel"].forEach((nombreEvento) =>
    canvasFirma.addEventListener(nombreEvento, () => (dibujando = false))
  );

  $("#btnBorrarFirma").addEventListener("click", limpiarFirma);
}

function limpiarFirma() {
  const canvasFirma = $("#firma");
  canvasFirma.getContext("2d").clearRect(0, 0, canvasFirma.width, canvasFirma.height);
  estadoAplicacion.firmaHecha = false;
}

/* ---------- Acciones y modales ---------- */
function abrirDialogo(contenidoHtml) {
  $("#dlgBody").innerHTML = contenidoHtml;
  $("#dlg").showModal();
}

function verHistorial(equipoId) {
  const equipo = buscarEquipoPorId(equipoId);
  const historialEquipo = estadoAplicacion.db.historial
    .filter((registro) => registro.equipoId === equipoId)
    .sort((registroA, registroB) => registroB.fecha.localeCompare(registroA.fecha));

  abrirDialogo(`<h3>Historial · ${escaparHtml(equipo.serie)}</h3><ul>${historialEquipo.map((registro) =>
    `<li><strong>${escaparHtml(registro.fecha)}</strong> — ${escaparHtml(registro.evento)}</li>`
  ).join("") || "<li>Este equipo aún no tiene eventos registrados.</li>"}</ul>
  <div class="dlg-actions"><button class="btn btn--ghost btn--sm" onclick="document.getElementById('dlg').close()">Cerrar</button></div>`);
}

function construirHtmlModalEdicion(equipoAEditar, catalogos, bajaBloqueada) {
  return `<h3>Editar equipo</h3>
    <form id="formEdit" novalidate><div class="grid2">
      <label class="field">Número de serie<input name="serie" value="${escaparHtml(equipoAEditar.serie)}" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" placeholder="00001"><span class="err"></span></label>
      <label class="field">Marca<input name="marca" value="${escaparHtml(equipoAEditar.marca)}"><span class="err"></span></label>
      <label class="field">Modelo<input name="modelo" value="${escaparHtml(equipoAEditar.modelo)}"><span class="err"></span></label>
      <label class="field">Tipo<select name="tipo">${opciones(catalogos.tipos, equipoAEditar.tipo)}</select><span class="err"></span></label>
      <label class="field">Ubicación<select name="ubicacion">${opciones(catalogos.ubicaciones, equipoAEditar.ubicacion)}</select><span class="err"></span></label>
      <label class="field">Estado<select name="estado">${catalogos.estados.map((estado) =>
        `<option ${estado === equipoAEditar.estado ? "selected" : ""} ${estado === "Dado de Baja" && bajaBloqueada ? "disabled" : ""}>${estado}</option>`
      ).join("")}</select><span class="err"></span></label>
    </div>
    ${bajaBloqueada ? '<p class="muted" style="margin:-6px 0 12px;font-size:.8rem">Solo un Administrador puede dar de baja un equipo.</p>' : ""}
    <div class="dlg-actions"><button type="button" class="btn btn--ghost btn--sm" onclick="document.getElementById('dlg').close()">Cancelar</button><button class="btn btn--primary btn--sm">Guardar cambios</button></div></form>`;
}

function aplicarCambiosEdicionEquipo(formularioEdicion, equipoAEditar, equipoId) {
  const estadoAnterior = equipoAEditar.estado;
  Object.assign(equipoAEditar, {
    serie: formularioEdicion.serie.value.trim().toUpperCase(),
    marca: formularioEdicion.marca.value.trim(),
    modelo: formularioEdicion.modelo.value.trim(),
    tipo: formularioEdicion.tipo.value,
    ubicacion: formularioEdicion.ubicacion.value,
    estado: formularioEdicion.estado.value
  });

  if (estadoAnterior !== equipoAEditar.estado) {
    addHistorial(equipoId, `Estado cambiado de "${estadoAnterior}" a "${equipoAEditar.estado}"`);

    // REGLA: Al cambiar un equipo a 'En Mantenimiento', se crea automáticamente un ticket correctivo si no tiene uno activo.
    if (equipoAEditar.estado === "En Mantenimiento" && !estadoAplicacion.db.mantenimientos.some((mantenimientoActivo) => mantenimientoActivo.equipoId === equipoId && mantenimientoActivo.estado !== "Completado")) {
      const tecnicoAsignado = estadoAplicacion.db.usuarios.find((usuario) => usuario.rol === "Técnico");
      estadoAplicacion.db.mantenimientos.push({
        id: siguienteId(estadoAplicacion.db.mantenimientos),
        equipoId,
        fecha: obtenerFechaHoy(),
        tipo: "Correctivo",
        tecnico: tecnicoAsignado?.nombre || "Sin asignar",
        estado: "En curso",
        detalle: "Ingreso registrado desde edición"
      });
    }
  }
}

function editarEquipo(equipoId) {
  const equipoAEditar = buscarEquipoPorId(equipoId);
  const catalogos = estadoAplicacion.db.catalogos;

  // REGLA: Únicamente los usuarios con rol Administrador pueden dar de baja un equipo.
  const bajaBloqueada = estadoAplicacion.rol !== "Administrador";

  abrirDialogo(construirHtmlModalEdicion(equipoAEditar, catalogos, bajaBloqueada));

  $("#formEdit").addEventListener("submit", (eventoSubmit) => {
    eventoSubmit.preventDefault();
    const formularioEdicion = eventoSubmit.target;
    if (!validarEquipo(formularioEdicion, equipoId)) return;

    aplicarCambiosEdicionEquipo(formularioEdicion, equipoAEditar, equipoId);
    guardar();
    $("#dlg").close();
    renderTodo();
    toast("Equipo actualizado.");
  });
}

function prepararActa(equipoId) {
  const formActa = $("#formActa");
  formActa.equipoId.value = equipoId;
  location.hash = "#actas";
  setTimeout(() => formActa.responsable.focus(), 400);
}

/* ---------- Exportaciones (Excel, PDF e Impresión) ---------- */
function exportarInventarioExcel() {
  const todosLosEquipos = estadoAplicacion.db?.equipos || [];
  if (!todosLosEquipos.length) {
    toast("No hay equipos registrados en el inventario para exportar.", true);
    return;
  }

  // Estructura completa de columnas optimizada para control contable y registro operativo
  const filasExcel = todosLosEquipos.map((equipo) => {
    const totalMantenimientos = (estadoAplicacion.db.mantenimientos || []).filter((mantenimiento) => mantenimiento.equipoId === equipo.id).length;
    const totalActas = (estadoAplicacion.db.actas || []).filter((acta) => acta.equipoId === equipo.id).length;

    return {
      "Número de Serie": String(equipo.serie).padStart(5, "0"),
      "Marca": equipo.marca,
      "Modelo": equipo.modelo,
      "Categoría": equipo.tipo,
      "Ubicación": equipo.ubicacion,
      "Estado": equipo.estado,
      "Mantenimientos Totales": totalMantenimientos,
      "Actas Registradas": totalActas
    };
  });

  const nombreArchivo = `inventario-equipos-dafp-${obtenerFechaHoy()}`;

  // Si la librería SheetJS (XLSX) está presente, se genera un archivo .xlsx genuino con anchos de columna
  if (window.XLSX) {
    const libroTrabajo = window.XLSX.utils.book_new();
    const hojaTrabajo = window.XLSX.utils.json_to_sheet(filasExcel);

    hojaTrabajo["!cols"] = [
      { wch: 16 }, // Número de Serie
      { wch: 18 }, // Marca
      { wch: 22 }, // Modelo
      { wch: 16 }, // Categoría
      { wch: 22 }, // Ubicación
      { wch: 18 }, // Estado
      { wch: 24 }, // Mantenimientos
      { wch: 18 }  // Actas
    ];

    window.XLSX.utils.book_append_sheet(libroTrabajo, hojaTrabajo, "Inventario");
    window.XLSX.writeFile(libroTrabajo, `${nombreArchivo}.xlsx`);
    toast(`Exportados ${todosLosEquipos.length} equipos a Excel (.xlsx).`);
    return;
  }

  // Fallback: Descarga CSV con BOM UTF-8 delimitado por ';' para apertura directa en Microsoft Excel
  descargarCsvCompatibleExcel(filasExcel, `${nombreArchivo}.csv`);
}

function descargarCsvCompatibleExcel(filasDatos, nombreArchivo) {
  if (!filasDatos.length) return;
  const encabezados = Object.keys(filasDatos[0]);
  const lineasCsv = filasDatos.map((fila) =>
    encabezados
      .map((campo) => `"${String(fila[campo] ?? "").replace(/"/g, '""')}"`)
      .join(";")
  );
  // Byte Order Mark (BOM) UTF-8 (\uFEFF) para forzar a Excel a decodificar caracteres latinos y tildes correctamente
  const contenidoBOM = "\uFEFF" + [encabezados.map((nombreColumna) => `"${nombreColumna}"`).join(";"), ...lineasCsv].join("\r\n");
  const blobCsv = new Blob([contenidoBOM], { type: "text/csv;charset=utf-8;" });
  const urlDescarga = URL.createObjectURL(blobCsv);
  const enlaceDescarga = document.createElement("a");
  enlaceDescarga.href = urlDescarga;
  enlaceDescarga.download = nombreArchivo;
  document.body.appendChild(enlaceDescarga);
  enlaceDescarga.click();
  document.body.removeChild(enlaceDescarga);
  URL.revokeObjectURL(urlDescarga);
  toast(`Exportados ${filasDatos.length} equipos a archivo compatible con Excel.`);
}

// Dibuja la cabecera institucional y el encabezado formal del documento PDF.
function maquetarEncabezadoPdf(documentoPdf, actaId, tituloDocumento) {
  documentoPdf.setFillColor(11, 36, 71);
  documentoPdf.rect(0, 0, 210, 26, "F");
  documentoPdf.setTextColor(255);
  documentoPdf.setFontSize(16);
  documentoPdf.text("DAFP Soporte técnico", 15, 16);
  documentoPdf.setFontSize(10);
  documentoPdf.text(`Acta N.º ${String(actaId).padStart(4, "0")}`, 195, 16, { align: "right" });
  documentoPdf.setTextColor(11, 36, 71);
  documentoPdf.setFontSize(14);
  documentoPdf.text(tituloDocumento, 15, 42);
}

// Renderiza los metadatos tabulares, la descripción particionada y la imagen de firma digital en el PDF.
function maquetarCuerpoPdf(documentoPdf, filasDetalle, descripcion, firmaBase64) {
  let coordenadaY = 54;
  documentoPdf.setFontSize(11);
  filasDetalle.forEach(([etiqueta, valor]) => {
    documentoPdf.setFont(undefined, "bold");
    documentoPdf.text(etiqueta + ":", 15, coordenadaY);
    documentoPdf.setFont(undefined, "normal");
    documentoPdf.text(String(valor ?? ""), 60, coordenadaY);
    coordenadaY += 8;
  });

  documentoPdf.setFont(undefined, "bold");
  documentoPdf.text("Descripción técnica:", 15, coordenadaY + 4);
  documentoPdf.setFont(undefined, "normal");
  const lineasDescripcion = documentoPdf.splitTextToSize(descripcion, 180);
  documentoPdf.text(lineasDescripcion, 15, coordenadaY + 12);
  coordenadaY += 20 + lineasDescripcion.length * 5.5;

  documentoPdf.setFont(undefined, "bold");
  documentoPdf.text("Firma del responsable:", 15, coordenadaY);
  if (firmaBase64) documentoPdf.addImage(firmaBase64, "PNG", 15, coordenadaY + 3, 70, 18);
  documentoPdf.line(15, coordenadaY + 24, 85, coordenadaY + 24);
}

// Orquesta la extracción de datos, composición vectorial y descarga del documento técnico en formato PDF.
function descargarPdf() {
  const actaExportar = estadoAplicacion.db.actas.find((acta) => acta.id === Number(estadoAplicacion.actaActual));
  if (!actaExportar) return toast("Primero selecciona un acta.", true);
  if (!window.jspdf) {
    toast("No se cargó la librería PDF. Usa Imprimir y elige «Guardar como PDF».", true);
    return;
  }
  const equipoAsociado = buscarEquipoPorId(actaExportar.equipoId) || {};
  const documentoPdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const tituloDocumento = actaExportar.tipoDocumento || "Acta de entrega y reporte técnico";

  maquetarEncabezadoPdf(documentoPdf, actaExportar.id, tituloDocumento);

  const filasDetalle = [
    ["Tipo de documento", tituloDocumento],
    ["Equipo", `${equipoAsociado.marca} ${equipoAsociado.modelo} (${equipoAsociado.tipo})`],
    ["Número de serie", equipoAsociado.serie],
    ["Ubicación", equipoAsociado.ubicacion],
    ["Responsable", actaExportar.responsable],
    ["Fecha", actaExportar.fecha],
    ["Elaboró", actaExportar.creadaPor]
  ];

  maquetarCuerpoPdf(documentoPdf, filasDetalle, actaExportar.descripcion, actaExportar.firma);

  const prefijoArchivo = (actaExportar.tipoDocumento || "acta").toLowerCase().replace(/\s+/g, "-");
  documentoPdf.save(`${prefijoArchivo}-${String(actaExportar.id).padStart(4, "0")}-${equipoAsociado.serie || "equipo"}.pdf`);
  toast("PDF descargado.");
}

function imprimir() {
  if (!estadoAplicacion.actaActual) return toast("Primero selecciona un acta.", true);
  document.body.classList.add("printing");
  window.print();
}
window.addEventListener("afterprint", () => document.body.classList.remove("printing"));

/* ---------- Configuración modular de eventos ---------- */

// Configura los escuchadores de los filtros de inventario y la barra de búsqueda con debounce.
function configurarFiltrosYBusqueda() {
  ["#fCategoria", "#fEstado", "#fUbicacion"].forEach((selectorFiltro) =>
    $(selectorFiltro).addEventListener("change", () => {
      estadoAplicacion.pagina = 1;
      renderTabla();
    })
  );

  const ejecutarBusquedaDebounced = debounce(() => {
    estadoAplicacion.pagina = 1;
    renderTabla();
    if ($("#buscadorSerie").value) $("#inventario").scrollIntoView({ behavior: "smooth" });
  }, 180);
  $("#buscadorSerie").addEventListener("input", ejecutarBusquedaDebounced);

  $("#btnLimpiar").addEventListener("click", () => {
    ["#fCategoria", "#fEstado", "#fUbicacion", "#buscadorSerie"].forEach((selector) => ($(selector).value = ""));
    estadoAplicacion.pagina = 1;
    renderTabla();
  });
}

// Enlaza los botones de descarga de reportes en Excel (.xlsx) y sincronización del archivo data.json.
function configurarExportaciones() {
  $("#btnExportarExcel")?.addEventListener("click", exportarInventarioExcel);
  $("#btnExcelFiltros")?.addEventListener("click", exportarInventarioExcel);
  $("#btnSincronizarJson")?.addEventListener("click", async () => {
    await guardar();
    descargarDataJson();
  });
}

// Gestiona la delegación de eventos para la paginación, acciones por equipo y completado de mantenimientos.
function configurarAccionesTablas() {
  $("#pager").addEventListener("click", (eventoClick) => {
    const botonPagina = eventoClick.target.closest("button[data-p]");
    if (botonPagina && !botonPagina.disabled) {
      estadoAplicacion.pagina = Number(botonPagina.dataset.p);
      renderTabla();
    }
  });

  $("#tbodyEquipos").addEventListener("click", (eventoClick) => {
    const botonAccion = eventoClick.target.closest("button[data-act]");
    if (!botonAccion || botonAccion.disabled) return;
    const equipoId = Number(botonAccion.dataset.id);
    ({ historial: verHistorial, editar: editarEquipo, acta: prepararActa })[botonAccion.dataset.act](equipoId);
  });

  $("#tbodyMant").addEventListener("click", (eventoClick) => {
    const botonMantenimiento = eventoClick.target.closest("button[data-mant]");
    if (!botonMantenimiento) return;
    const mantenimientoSeleccionado = estadoAplicacion.db.mantenimientos.find((mantenimiento) => mantenimiento.id === Number(botonMantenimiento.dataset.mant));
    mantenimientoSeleccionado.estado = "Completado";

    // REGLA: Si el equipo estaba 'En Mantenimiento' y se completan todas sus órdenes pendientes, vuelve automáticamente a 'Activo'.
    const equipoAsociado = buscarEquipoPorId(mantenimientoSeleccionado.equipoId);
    if (equipoAsociado && equipoAsociado.estado === "En Mantenimiento" && !estadoAplicacion.db.mantenimientos.some((mantenimientoPendiente) => mantenimientoPendiente.equipoId === equipoAsociado.id && mantenimientoPendiente.estado !== "Completado")) {
      equipoAsociado.estado = "Activo";
    }
    addHistorial(mantenimientoSeleccionado.equipoId, `Mantenimiento ${mantenimientoSeleccionado.tipo.toLowerCase()} completado`);
    guardar();
    renderTodo();
    toast("Mantenimiento completado.");
  });
}

// Controla la captura, validación y persistencia de nuevos equipos en el inventario.
function configurarFormularioNuevoEquipo() {
  const formNuevoEquipo = $("#formEquipo");
  formNuevoEquipo.addEventListener("submit", (eventoSubmit) => {
    eventoSubmit.preventDefault();
    if (!puede("Administrador", "Técnico")) return toast("Tu rol no permite registrar equipos.", true);
    if (!validarEquipo(formNuevoEquipo)) return toast("Revisa los campos marcados.", true);

    const nuevoEquipo = {
      id: siguienteId(estadoAplicacion.db.equipos),
      serie: formNuevoEquipo.serie.value.trim().toUpperCase(),
      marca: formNuevoEquipo.marca.value.trim(),
      modelo: formNuevoEquipo.modelo.value.trim(),
      tipo: formNuevoEquipo.tipo.value,
      ubicacion: formNuevoEquipo.ubicacion.value,
      estado: "Activo"
    };
    estadoAplicacion.db.equipos.push(nuevoEquipo);
    addHistorial(nuevoEquipo.id, "Equipo registrado en el inventario");
    guardar();
    formNuevoEquipo.reset();
    renderTodo();
    toast(`Equipo ${nuevoEquipo.serie} registrado.`);
  });
  formNuevoEquipo.addEventListener("input", (evento) => evento.target.closest(".field")?.classList.remove("invalid"));
}

// Administra el ciclo de vida del formulario de actas técnicas, su firma digital y contador dinámico.
function configurarFormularioNuevaActa() {
  const formNuevaActa = $("#formActa");
  formNuevaActa.addEventListener("submit", (eventoSubmit) => {
    eventoSubmit.preventDefault();
    if (!puede("Administrador", "Técnico")) return toast("Tu rol no permite generar actas.", true);
    if (!validarActa(formNuevaActa)) return toast("Revisa los campos marcados.", true);

    const tipoDocumento = formNuevaActa.tipoDocumento?.value || "Acta de entrega";
    const nuevaActa = {
      id: siguienteId(estadoAplicacion.db.actas),
      tipoDocumento,
      equipoId: Number(formNuevaActa.equipoId.value),
      responsable: formNuevaActa.responsable.value.trim(),
      fecha: formNuevaActa.fecha.value,
      descripcion: formNuevaActa.descripcion.value.trim(),
      firma: $("#firma").toDataURL("image/png"),
      creadaPor: $("#userName").textContent
    };
    estadoAplicacion.db.actas.push(nuevaActa);
    addHistorial(nuevaActa.equipoId, `${tipoDocumento} #${nuevaActa.id} generada`);
    estadoAplicacion.actaActual = nuevaActa.id;
    guardar();
    formNuevaActa.reset();
    const contadorDescripcion = $("#descCounter");
    if (contadorDescripcion) contadorDescripcion.textContent = "0 / 500";
    limpiarFirma();
    renderTodo();
    toast(`${tipoDocumento} #${nuevaActa.id} generada.`);
    $("#visor").scrollIntoView({ behavior: "smooth" });
  });

  formNuevaActa.addEventListener("input", (evento) => evento.target.closest(".field")?.classList.remove("invalid"));
  formNuevaActa.addEventListener("change", (evento) => evento.target.closest(".field")?.classList.remove("invalid"));

  const campoDescripcionActa = formNuevaActa.querySelector('[name="descripcion"]');
  const contadorDescripcion = $("#descCounter");
  if (campoDescripcionActa && contadorDescripcion) {
    campoDescripcionActa.addEventListener("input", () => {
      contadorDescripcion.textContent = `${campoDescripcionActa.value.length} / 500`;
    });
  }
}

// Sincroniza la selección de actas emitidas y despacha las acciones de exportación PDF e impresión.
function configurarVisorDocumentos() {
  $("#selActa").addEventListener("change", (evento) => {
    estadoAplicacion.actaActual = Number(evento.target.value);
    renderDoc();
  });
  $("#btnPdf").addEventListener("click", descargarPdf);
  $("#btnImprimir").addEventListener("click", imprimir);
}

// Maneja el cambio reactivo de roles de usuario, menús desplegables y navegación móvil.
function configurarNavegacionYRoles() {
  $("#selRol").innerHTML = ["Administrador", "Técnico", "Auditor"].map((rol) => `<option>${rol}</option>`).join("");
  $("#selRol").addEventListener("change", (evento) => {
    estadoAplicacion.rol = evento.target.value;
    aplicarRol();
    toast(`Vista de ${estadoAplicacion.rol}.`);
  });

  const alternarMenu = (boton, panel, otroPanel) =>
    boton.addEventListener("click", () => {
      const abrir = panel.hidden;
      $(otroPanel).hidden = true;
      panel.hidden = !abrir;
      boton.setAttribute("aria-expanded", abrir);
    });

  alternarMenu($("#btnNotif"), $("#notifPanel"), "#userPanel");
  alternarMenu($("#btnUser"), $("#userPanel"), "#notifPanel");
  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".menu-wrap")) {
      $("#notifPanel").hidden = true;
      $("#userPanel").hidden = true;
    }
  });

  $("#burger").addEventListener("click", () => {
    const abierto = $("#nav").classList.toggle("open");
    $("#burger").setAttribute("aria-expanded", abierto);
  });
  $("#nav").addEventListener("click", (evento) => {
    if (evento.target.tagName === "A") $("#nav").classList.remove("open");
  });
}

// Sincroniza el indicador visual de navegación activa con el desplazamiento usando throttling de GPU.
function configurarSeguimientoScroll() {
  const secciones = ["inicio", "inventario", "mantenimientos", "actas", "usuarios"];
  let scrollBloqueado = false;
  window.addEventListener("scroll", () => {
    if (scrollBloqueado) return;
    scrollBloqueado = true;
    window.requestAnimationFrame(() => {
      let seccionActual = "inicio";
      secciones.forEach((idSeccion) => {
        const elementoSeccion = document.getElementById(idSeccion);
        if (elementoSeccion && elementoSeccion.offsetParent && elementoSeccion.getBoundingClientRect().top < 140) {
          seccionActual = idSeccion;
        }
      });
      document.querySelectorAll(".nav a").forEach((enlaceNav) =>
        enlaceNav.classList.toggle("is-active", enlaceNav.getAttribute("href") === "#" + seccionActual)
      );
      scrollBloqueado = false;
    });
  }, { passive: true });
}

// Orquestador principal que inicializa de forma desacoplada todos los subsistemas de eventos de la aplicación.
function eventos() {
  configurarFiltrosYBusqueda();
  configurarExportaciones();
  configurarAccionesTablas();
  configurarFormularioNuevoEquipo();
  configurarFormularioNuevaActa();
  configurarVisorDocumentos();
  configurarNavegacionYRoles();
  configurarSeguimientoScroll();
}

/* ---------- Inicio ---------- */
(async function init() {
  estadoAplicacion.db = await cargarDatos();
  iniciarFirma();
  eventos();
  aplicarRol();
})();
