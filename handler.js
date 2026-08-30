/**
 * handler.js
 * -------------------------------------------------------
 * Cerebro del bot.
 * Detecta prefijos, comandos y ejecuta plugins.
 * Compatible con distintos tipos de mensajes de WhatsApp.
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')
const dfail = require('./lib/dfail')
const { prefix, owner } = require('./settings')

const pluginsDir = path.join(__dirname, 'plugins')

function loadPlugins() {
  const plugins = []

  if (!fs.existsSync(pluginsDir)) {
    console.log(dfail('La carpeta plugins no existe.'))
    return plugins
  }

  const archivos = fs
    .readdirSync(pluginsDir)
    .filter(f => f.endsWith('.js'))

  for (const archivo of archivos) {
    const ruta = path.join(pluginsDir, archivo)

    try {
      delete require.cache[require.resolve(ruta)]

      const plugin = require(ruta)

      if (typeof plugin !== 'function') {
        console.log(dfail(`Plugin inválido: ${archivo}`))
        continue
      }

      plugin.filename = archivo
      plugins.push(plugin)
    } catch (e) {
      console.log(
        dfail(`Error cargando ${archivo}: ${e.message}`)
      )
    }
  }

  return plugins
}

function obtenerTexto(m) {
  if (!m || !m.message) return ''

  let message = m.message

  // Mensajes encapsulados
  if (message.ephemeralMessage?.message) {
    message = message.ephemeralMessage.message
  }

  if (message.viewOnceMessage?.message) {
    message = message.viewOnceMessage.message
  }

  if (message.viewOnceMessageV2?.message) {
    message = message.viewOnceMessageV2.message
  }

  if (message.viewOnceMessageV2Extension?.message) {
    message = message.viewOnceMessageV2Extension.message
  }

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    ''
  )
}

async function handler(conn, m) {
  const plugins = loadPlugins()

  // Hooks globales
  for (const plugin of plugins) {
    if (typeof plugin.all === 'function') {
      try {
        await plugin.all(m, { conn })
      } catch (e) {
        console.log(
          dfail(
            `Error en hook all de ${plugin.filename}: ${e.message}`
          )
        )
      }
    }
  }

  if (!m.text) return

  const textoOriginal = String(m.text).trim()

  if (!textoOriginal) return

  // Detectar prefijo
  const match = textoOriginal.match(prefix)

  if (!match) return

  const usedPrefix = match[0]

  const contenido = textoOriginal
    .slice(usedPrefix.length)
    .trim()

  if (!contenido) return

  const partes = contenido.split(/\s+/)

  const command = partes.shift().toLowerCase()

  const args = partes

  const text = args.join(' ')

  if (!command) return

  // Buscar plugin
  const plugin = plugins.find(plugin => {
    if (!Array.isArray(plugin.command)) return false

    return plugin.command.some(
      cmd => String(cmd).toLowerCase() === command
    )
  })

  if (!plugin) return

  // Comandos exclusivos del owner
  if (plugin.owner) {
    const numeroSender = String(m.sender || '')
      .replace(/[^0-9]/g, '')

    const numerosOwner = Array.isArray(owner)
      ? owner.map(o =>
          String(o?.[0] || '')
            .replace(/[^0-9]/g, '')
        )
      : []

    if (!numerosOwner.includes(numeroSender)) {
      return conn.sendMessage(
        m.chat,
        {
          text: dfail(
            '❌ Este comando es exclusivo del owner.'
          )
        },
        {
          quoted: m.raw
        }
      )
    }
  }

  try {
    await plugin(m, {
      conn,
      args,
      text,
      command,
      usedPrefix
    })
  } catch (e) {
    console.error(
      `Error ejecutando ${command}:`,
      e
    )

    try {
      await conn.sendMessage(
        m.chat,
        {
          text: dfail(
            `❌ Ocurrió un error ejecutando el comando:\n> ${e.message}`
          )
        },
        {
          quoted: m.raw
        }
      )
    } catch {}
  }
}

module.exports = handler