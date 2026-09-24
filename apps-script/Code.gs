/**
 * GemaFinanzy - servidor (Google Apps Script).
 * Debe estar vinculado a un Google Sheet con una hoja "Autorizados".
 * Pasos completos en GUIA-PUBLICACION.md.
 */
const HOJA_AUTORIZADOS = 'Autorizados';
const CARPETA_DATOS = 'GemaFinanzy-datos';
const MAX_BYTES = 5 * 1024 * 1024;

function onOpen() {
  SpreadsheetApp.getUi().createMenu('GemaFinanzy').addItem('Preparar hoja y carpeta', 'inicializar').addToUi();
}

// Ejecutar una vez: crea la hoja de clientes autorizados y la carpeta de datos.
function inicializar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA_AUTORIZADOS);
  if (!h) h = ss.insertSheet(HOJA_AUTORIZADOS);
  if (h.getLastRow() === 0) {
    h.appendRow(['Correo', 'Nombre', 'Estado', 'Fecha de alta', 'Último acceso']);
    h.setFrozenRows(1);
    h.getRange('A1:E1').setFontWeight('bold');
    h.setColumnWidth(1, 260);
    h.setColumnWidth(2, 200);
    h.setColumnWidth(4, 140);
    h.setColumnWidth(5, 160);
  }
  const regla = SpreadsheetApp.newDataValidation().requireValueInList(['ACTIVO', 'BLOQUEADO'], true).build();
  h.getRange('C2:C1000').setDataValidation(regla);
  carpeta_();
}

function doGet() {
  return json_({ ok: true, servicio: 'GemaFinanzy API' });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    out = manejar_(req);
  } catch (err) {
    console.error(err);
    out = { ok: false, error: 'server' };
  }
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function manejar_(req) {
  const cred = verificarToken_(req.token);
  if (!cred) return { ok: false, error: 'token_invalido' };
  const acceso = buscarAutorizado_(cred.email);
  if (!acceso) return { ok: false, error: 'no_autorizado' };
  if (acceso.estado !== 'ACTIVO') return { ok: false, error: 'bloqueado' };
  if (req.action === 'load') {
    acceso.hoja.getRange(acceso.fila, 5).setValue(new Date());
    return cargar_(cred.email);
  }
  if (req.action === 'save') return guardar_(cred.email, req.state, Number(req.base) || 0);
  return { ok: false, error: 'accion_invalida' };
}

// Valida el token de Google (ID token) y devuelve { email, exp } o null.
function verificarToken_(token) {
  if (!token || typeof token !== 'string' || token.length > 4000) return null;
  const cache = CacheService.getScriptCache();
  const key = 't' + hash_(token);
  const hit = cache.get(key);
  if (hit) {
    const c = JSON.parse(hit);
    if (c.exp * 1000 > Date.now()) return c;
  }
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const t = JSON.parse(res.getContentText());
  const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId || t.aud !== clientId) return null;
  if (String(t.email_verified) !== 'true' || !t.email) return null;
  if (t.iss !== 'accounts.google.com' && t.iss !== 'https://accounts.google.com') return null;
  const exp = Number(t.exp);
  if (!(exp * 1000 > Date.now())) return null;
  const cred = { email: String(t.email).toLowerCase(), exp: exp };
  cache.put(key, JSON.stringify(cred), 300);
  return cred;
}

// Hoja "Autorizados": A correo, B nombre, C estado (ACTIVO o BLOQUEADO; vacío = ACTIVO), D alta, E último acceso.
function buscarAutorizado_(email) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_AUTORIZADOS);
  if (!hoja) return null;
  const n = hoja.getLastRow();
  if (n < 2) return null;
  const filas = hoja.getRange(2, 1, n - 1, 3).getValues();
  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i][0]).trim().toLowerCase() === email) {
      const estado = String(filas[i][2] || 'ACTIVO').trim().toUpperCase();
      return { hoja: hoja, fila: i + 2, estado: estado };
    }
  }
  return null;
}

function carpeta_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* se recrea abajo */ }
  }
  const it = DriveApp.getFoldersByName(CARPETA_DATOS);
  const c = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_DATOS);
  props.setProperty('CARPETA_ID', c.getId());
  return c;
}

function archivo_(email, crear) {
  const nombre = 'u_' + hash_(email) + '.json';
  const c = carpeta_();
  const it = c.getFilesByName(nombre);
  if (it.hasNext()) return it.next();
  return crear ? c.createFile(nombre, '{}', MimeType.PLAIN_TEXT) : null;
}

function leer_(f) {
  const txt = f.getBlob().getDataAsString('UTF-8');
  return txt ? JSON.parse(txt) : {};
}

function cargar_(email) {
  const f = archivo_(email, false);
  if (!f) return { ok: true, updated: 0, state: null };
  const d = leer_(f);
  return { ok: true, updated: d.updated || 0, state: d.state || null };
}

function guardar_(email, state, base) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.wallets) || !Array.isArray(state.tx)) {
    return { ok: false, error: 'estado_invalido' };
  }
  const contenido = JSON.stringify({ email: email, updated: 0, state: state });
  if (contenido.length > MAX_BYTES) return { ok: false, error: 'demasiado_grande' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = archivo_(email, true);
    const actual = leer_(f);
    const previo = actual.updated || 0;
    if (previo > base) return { ok: false, error: 'conflict', updated: previo };
    const updated = Math.max(Number(state.updated) || 0, previo + 1);
    f.setContent(JSON.stringify({ email: email, updated: updated, state: state }));
    return { ok: true, updated: updated };
  } finally {
    lock.releaseLock();
  }
}

function hash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)).replace(/=+$/, '').slice(0, 32);
}
