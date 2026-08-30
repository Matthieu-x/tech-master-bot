/**
 * plugins/pmenu.js
 * -------------------------------------------------------
 * Menú principal de Tech Master Bot.
 * Genera automáticamente los comandos disponibles.
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')

const {
  botName,
  creators
} = require('../settings')

const IMAGEN_MENU =
  'https://files.catbox.moe/23ppfd.png'

function cargarComandos() {
  const pluginsDir = path.join(
    __dirname
  )

  const archivos = fs
    .readdirSync(pluginsDir)
    .filter(file => file.endsWith('.js'))

  const grupos = {}

  for (const archivo of archivos) {
    try {
      const ruta = path.join(
        pluginsDir,
        archivo
      )

      delete require.cache[
        require.resolve(ruta)
      ]

      const plugin = require(ruta)

      if (
        typeof plugin !== 'function' ||
        !Array.isArray(plugin.command)
      ) {
        continue
      }

      const categoria =
        Array.isArray(plugin.tags) &&
        plugin.tags.length
          ? plugin.tags[0]
          : 'general'

      if (!grupos[categoria]) {
        grupos[categoria] = []
      }

      for (const comando of plugin.command) {
        const cmd = String(comando).toLowerCase()

        if (!grupos[categoria].includes(cmd)) {
          grupos[categoria].push(cmd)
        }
      }
    } catch (e) {
      console.log(
        `Error leyendo ${archivo}: ${e.message}`
      )
    }
  }

  return grupos
}

function crearMenu(prefijo) {
  const grupos = cargarComandos()

  let menuComandos = ''

  const nombres = Object.keys(grupos).sort()

  for (const categoria of nombres) {
    const comandos = grupos[categoria]

    if (!comandos.length) continue

    menuComandos +=
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📂 *${categoria.toUpperCase()}*\n`

    for (const comando of comandos) {
      menuComandos +=
        `> ${prefijo}${comando}\n`
    }
  }

  return menuComandos
}

let handler = async (m, { conn, usedPrefix }) => {
  const prefijo = usedPrefix || '#'

  const numeroMencion =
    String(m.sender || '')
      .split('@')[0]

  const listaCreadores =
    Array.isArray(creators)
      ? creators
          .filter(c => c && c.nombre)
          .map(
            c =>
              `> 👨‍💻 ${c.nombre} — ${c.rol || 'Creador'}`
          )
          .join('\n')
      : '> 👨‍💻 Equipo Tech Master'

  const comandos = crearMenu(prefijo)

  const texto =
    `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n` +
    `│   🤖 *${botName}*   │\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +

    `👋 Hola @${numeroMencion}\n` +
    `¡Bienvenido a *${botName}*!\n\n` +

    `⚡ *Menú principal*` +
    `${comandos}\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👨‍💻 *CREADORES*\n` +
    `${listaCreadores}\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Ejemplo:* ${prefijo}ping\n\n` +
    `> 🚀 ${botName} — WhatsApp Bot`

  try {
    await conn.sendMessage(
      m.chat,
      {
        image: {
          url: IMAGEN_MENU
        },
        caption: texto,
        mentions: [m.sender]
      },
      {
        quoted: m.raw
      }
    )
  } catch (error) {
    console.log(
      'Error enviando imagen del menú:',
      error.message
    )

    await conn.sendMessage(
      m.chat,
      {
        text: texto,
        mentions: [m.sender]
      },
      {
        quoted: m.raw
      }
    )
  }
}

handler.help = [
  'menu',
  'help',
  'comandos'
]

handler.tags = [
  'general'
]

handler.command = [
  'menu',
  'help',
  'comandos'
]

module.exports = handler