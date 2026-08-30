const fs = require('fs')
const path = require('path')
const dfail = require('./lib/dfail')
const { prefix, owner } = require('./settings')
const { estaRegistrado, obtenerGrupo } = require('./lib/db')

const pluginsDir = path.join(__dirname, 'plugins')

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

async function handler(conn, m) {
  const plugins = loadPlugins()

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

  const usedPrefix = (m.text.match(prefix) || [])[0]
  if (!usedPrefix) return

  const sinPrefijo = m.text.slice(usedPrefix.length).trim()
  const [command, ...args] = sinPrefijo.split(/\s+/)
  const text = sinPrefijo.slice(command.length).trim()

  if (!command) return

  const plugin = plugins.find((p) => {
    if (Array.isArray(p.command)) return p.command.includes(command.toLowerCase())
    if (p.command instanceof RegExp) return p.command.test(command.toLowerCase())
    return false
  })

  if (!plugin) return

  if (m.isGroup && !plugin.owner && plugin.command[0] !== 'bot') {
    const configGrupo = obtenerGrupo(m.chat)
    if (configGrupo.botOff) return
  }

  const requiereRegistro = plugin.registro !== false
  if (requiereRegistro && !estaRegistrado(m)) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Necesitas registrarte antes de usar comandos.\n> Usa: ${usedPrefix}reg Nombre.Edad\n> Ejemplo: ${usedPrefix}reg Matthieu.20`) },
      { quoted: m.raw }
    )
  }

  if (plugin.owner) {
    const numeroSender = (m.senderNumero || m.sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    const numerosOwner = owner.map(o => o[0].replace(/[^0-9]/g, ''))
    if (!numerosOwner.includes(numeroSender)) {
      return conn.sendMessage(m.chat, { text: dfail('Este comando es solo para el owner.') }, { quoted: m.raw })
    }
  }

  try {
    await plugin(m, { conn, args, text, command, usedPrefix })
  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: dfail(`Ocurrió un error ejecutando el comando:\n> ${e.message}`) }, { quoted: m.raw })
  }
}

module.exports = handler