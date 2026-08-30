/**
 * lib/db.js
 * -------------------------------------------------------
 * Base de datos simple en JSON para usuarios registrados
 * y su saldo de MASTERCOINS 🪙💱.
 *
 * Usa el NÚMERO REAL (senderNumero) como clave, no el jid
 * crudo -- importante porque en grupos con el sistema @lid
 * de WhatsApp, m.sender puede ser un identificador interno
 * que cambia, mientras que el número real siempre es el mismo.
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')

const RUTA_DB = path.join(__dirname, '..', 'database', 'usuarios.json')
const RUTA_DB_GRUPOS = path.join(__dirname, '..', 'database', 'grupos.json')
const SALDO_INICIAL = 100 // regalo de bienvenida al registrarse

function asegurarDB() {
  const carpeta = path.dirname(RUTA_DB)
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true })
  if (!fs.existsSync(RUTA_DB)) fs.writeFileSync(RUTA_DB, JSON.stringify({}, null, 2))
}

function leerDB() {
  asegurarDB()
  try {
    return JSON.parse(fs.readFileSync(RUTA_DB, 'utf-8'))
  } catch {
    return {}
  }
}

function guardarDB(db) {
  asegurarDB()
  fs.writeFileSync(RUTA_DB, JSON.stringify(db, null, 2))
}

/**
 * Extrae el número de teléfono real a partir del mensaje serializado,
 * usando senderNumero (resuelto en index.js) cuando existe.
 */
function numeroDeSender(m) {
  const jid = m.senderNumero || m.sender
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}

function estaRegistrado(m) {
  const db = leerDB()
  const numero = numeroDeSender(m)
  return Boolean(db[numero]?.registrado)
}

function obtenerUsuario(m) {
  const db = leerDB()
  const numero = numeroDeSender(m)
  return db[numero] || null
}

function registrarUsuario(m, nombre, edad) {
  const db = leerDB()
  const numero = numeroDeSender(m)

  db[numero] = {
    registrado: true,
    nombre,
    edad,
    mastercoins: SALDO_INICIAL,
    ultimoDaily: 0,
    fechaRegistro: new Date().toISOString(),
  }

  guardarDB(db)
  return db[numero]
}

/**
 * -------------------------------------------------------
 * Configuración por grupo (bienvenida, despedida, bot on/off).
 * Se guarda en un archivo aparte (grupos.json) para no mezclar
 * con la base de usuarios/mastercoins de arriba.
 * -------------------------------------------------------
 */

const GRUPO_DEFAULT = { welcome: false, bye: false, botOff: false }

function asegurarDBGrupos() {
  const carpeta = path.dirname(RUTA_DB_GRUPOS)
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true })
  if (!fs.existsSync(RUTA_DB_GRUPOS)) fs.writeFileSync(RUTA_DB_GRUPOS, JSON.stringify({}, null, 2))
}

function leerDBGrupos() {
  asegurarDBGrupos()
  try {
    return JSON.parse(fs.readFileSync(RUTA_DB_GRUPOS, 'utf-8'))
  } catch {
    return {}
  }
}

function guardarDBGrupos(db) {
  asegurarDBGrupos()
  fs.writeFileSync(RUTA_DB_GRUPOS, JSON.stringify(db, null, 2))
}

/**
 * Devuelve la config del grupo (con valores por defecto si nunca
 * se guardó nada para ese chat todavía).
 */
function obtenerGrupo(chat) {
  const db = leerDBGrupos()
  return { ...GRUPO_DEFAULT, ...(db[chat] || {}) }
}

/**
 * Actualiza (mezclando) la config de un grupo. Ej:
 * guardarGrupo(chat, { welcome: true })
 */
function guardarGrupo(chat, cambios) {
  const db = leerDBGrupos()
  db[chat] = { ...obtenerGrupo(chat), ...cambios }
  guardarDBGrupos(db)
  return db[chat]
}

module.exports = {
  leerDB,
  guardarDB,
  numeroDeSender,
  estaRegistrado,
  obtenerUsuario,
  registrarUsuario,
  SALDO_INICIAL,
  obtenerGrupo,
  guardarGrupo,
}
