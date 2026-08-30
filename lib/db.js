/**
 * lib/db.js
 * -------------------------------------------------------
 * Guardado simple en JSON para configuración por grupo:
 * welcome (bienvenida), bye (despedida) y botOff (bot
 * apagado en ese grupo). Un archivo, sin base de datos
 * externa -- suficiente para esto.
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')

const RUTA_DB = path.join(__dirname, '..', 'db.json')

// Config por defecto de un grupo que todavía no tiene entrada en el JSON
const DEFAULT_GRUPO = { welcome: true, bye: true, botOff: false }

function leerDB() {
  try {
    if (!fs.existsSync(RUTA_DB)) return {}
    return JSON.parse(fs.readFileSync(RUTA_DB, 'utf-8'))
  } catch (e) {
    console.log(`ꕥ\n> Error leyendo db.json: ${e.message}`)
    return {}
  }
}

function guardarDB(db) {
  fs.writeFileSync(RUTA_DB, JSON.stringify(db, null, 2), 'utf-8')
}

function obtenerGrupo(chatId) {
  const db = leerDB()
  return { ...DEFAULT_GRUPO, ...(db[chatId] || {}) }
}

function guardarGrupo(chatId, cambios) {
  const db = leerDB()
  db[chatId] = { ...DEFAULT_GRUPO, ...(db[chatId] || {}), ...cambios }
  guardarDB(db)
  return db[chatId]
}

module.exports = { obtenerGrupo, guardarGrupo }
