/**
 * handler.js
 * -------------------------------------------------------
 * Cerebro del bot. Se encarga de:
 *   1. Leer todos los plugins de la carpeta /plugins
 *   2. Revisar cada mensaje entrante
 *   3. Ver si el texto empieza con el prefijo + un comando
 *      que exista en algún plugin, y ejecutarlo
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')
const dfail = require('./lib/dfail')
const { prefix, owner } = require('./settings')
const { estaRegistrado } = require('./lib/db')

const pluginsDir = path.join(__dirname, 'plugins')

/**
 * Carga (o recarga) todos los plugins de la carpeta /plugins.
 * Usamos delete require.cache para poder agregar/editar plugins
 * en caliente sin tener que reiniciar el bot (ej: con savefile.js).
 */
function loadPlugins() {
  const plugins = []

  const archivos = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))

  for (const archivo of archivos) {
    const rutaCompleta = path.join(pluginsDir, archivo)
    try {
      delete require.cache[require.resolve(rutaCompleta)]
      const plugin = require(rutaCompleta)
      plugin.filename = archivo
      plugins.push(plugin)
    } catch (e) {
      console.log(dfail(`Error cargando el plugin ${archivo}: ${e.message}`))
    }
  }

  return plugins
}

/**
 * Procesa un mensaje entrante y ejecuta el plugin que corresponda.
 *
 * @param {object} conn   - socket de baileys (ultra-baileys)
 * @param {object} m      - mensaje ya "serializado" (chat, sender, text, etc.)
 */
async function handler(conn, m) {
  const plugins = loadPlugins()

  // 1) Hooks "all": corren en TODOS los mensajes, tengan o no comando
  //    (útil para anti-link, contadores, etc.)
  for (const plugin of plugins) {
    if (typeof plugin.all === 'function') {
      try {
        await plugin.all(m, { conn })
      } catch (e) {
        console.log(dfail(`Error en hook 'all' de ${plugin.filename}: ${e.message}`))
      }
    }
  }

  if (!m.text) return

  // 2) ¿El mensaje empieza con un prefijo válido?
  const usedPrefix = (m.text.match(prefix) || [])[0]
  if (!usedPrefix) return

  // 3) Separamos comando y argumentos
  //    Ej: "#saludo Matthieu"  ->  command="saludo"  args=["Matthieu"]
  const sinPrefijo = m.text.slice(usedPrefix.length).trim()
  const [command, ...args] = sinPrefijo.split(/\s+/)
  const text = sinPrefijo.slice(command.length).trim()

  if (!command) return

  // 4) Buscamos un plugin cuyo handler.command incluya este comando
  const plugin = plugins.find(
    p => Array.isArray(p.command) && p.command.includes(command.toLowerCase())
  )

  if (!plugin) return // no existe el comando, simplemente se ignora

  // 5) Si el comando requiere estar registrado (todos, salvo que el plugin
  //    ponga handler.registro = false), validamos con .reg primero.
  const requiereRegistro = plugin.registro !== false
  if (requiereRegistro && !estaRegistrado(m)) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Necesitas registrarte antes de usar comandos.\n> Usa: ${usedPrefix}reg Nombre.Edad\n> Ejemplo: ${usedPrefix}reg Carlos.20`) },
      { quoted: m.raw }
    )
  }

  // 6) Si el plugin es solo para owners, validamos
  if (plugin.owner) {
    // Usamos senderNumero (número de teléfono real) en vez de sender,
    // porque sender puede ser un @lid en grupos con el sistema nuevo de
    // WhatsApp, y ahí nunca coincidiría con el número puesto en settings.js.
    const numeroSender = (m.senderNumero || m.sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    const numerosOwner = owner.map(o => o[0].replace(/[^0-9]/g, ''))
    if (!numerosOwner.includes(numeroSender)) {
      return conn.sendMessage(m.chat, { text: dfail('Este comando es solo para el owner.') }, { quoted: m.raw })
    }
  }

  // 7) Ejecutamos el plugin
  try {
    await plugin(m, { conn, args, text, command, usedPrefix })
  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: dfail(`Ocurrió un error ejecutando el comando:\n> ${e.message}`) }, { quoted: m.raw })
  }
}

module.exports = handler
