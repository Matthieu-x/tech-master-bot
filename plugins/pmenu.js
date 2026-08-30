/**
 * plugins/pmenu.js
 * -------------------------------------------------------
 * Menú principal de Tech Master Bot.
 * Genera automáticamente los comandos disponibles.
 *
 * FIX: el envío de imagen desde URL externa se colgaba sin
 * error en el hosting (petición de red que nunca resuelve),
 * dejando el bot "sin responder". Ahora tiene un timeout: si
 * la imagen tarda más de 10s, se cancela sola y manda el
 * menú en texto plano en su lugar.
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')

const { botName, creators } = require('../settings')

const IMAGEN_MENU = path.join(__dirname, '..', 'lib', 'master.jpg')
const TIMEOUT_IMAGEN_MS = 10_000 // por si acaso, aunque ya es un archivo local

function cargarComandos() {
  const pluginsDir = path.join(__dirname)
  const archivos = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'))
  const grupos = {}

  for (const archivo of archivos) {
    // Nos saltamos este mismo archivo para no re-requerirse a sí mismo
    if (archivo === path.basename(__filename)) continue

    try {
      const ruta = path.join(pluginsDir, archivo)
      delete require.cache[require.resolve(ruta)]
      const plugin = require(ruta)

      if (typeof plugin !== 'function' || !Array.isArray(plugin.command)) continue

      const categoria = Array.isArray(plugin.tags) && plugin.tags.length ? plugin.tags[0] : 'general'
      if (!grupos[categoria]) grupos[categoria] = []

      for (const comando of plugin.command) {
        const cmd = String(comando).toLowerCase()
        if (!grupos[categoria].includes(cmd)) grupos[categoria].push(cmd)
      }
    } catch (e) {
      console.log(`ꕥ\n> Error leyendo ${archivo}: ${e.message}`)
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

    menuComandos += `\n〄 *${categoria.toUpperCase()}*\n`
    for (const comando of comandos) {
      menuComandos += `> ✐ ${prefijo}${comando}\n`
    }
  }

  return menuComandos
}

/**
 * Envuelve una promesa con un límite de tiempo. Si no resuelve a tiempo,
 * la rechaza manualmente para que el catch de afuera sí pueda actuar
 * (a diferencia de dejar la petición colgada para siempre).
 */
function conTimeout(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

let handler = async (m, { conn, usedPrefix }) => {
  const prefijo = usedPrefix || '#'
  const numeroMencion = String(m.sender || '').split('@')[0]

  const listaCreadores = Array.isArray(creators)
    ? creators
        .filter(c => c && c.nombre)
        .map(c => `> ࿇ ${c.nombre} — ${c.rol || 'Creador'}`)
        .join('\n')
    : '> ࿇ Equipo Tech Master'

  const comandos = crearMenu(prefijo)

  const texto =
    `ꕥ *${botName}*\n` +
    `❧ Hola @${numeroMencion}, bienvenido\n\n` +
    `✰ *Comandos disponibles*${comandos}\n` +
    `𖣔 *Creadores*\n${listaCreadores}\n\n` +
    `> 💡 Ejemplo: ${prefijo}ping`

  try {
    // Intenta con imagen local. Si no existe el archivo o falla la lectura,
    // cae al texto plano (el try/catch cubre ambos casos).
    await conTimeout(
      conn.sendMessage(
        m.chat,
        { image: fs.readFileSync(IMAGEN_MENU), caption: texto, mentions: [m.sender] },
        { quoted: m.raw }
      ),
      TIMEOUT_IMAGEN_MS
    )
  } catch (error) {
    console.log(`ꕥ\n> No se pudo enviar la imagen del menú (${error.message}), mandando solo texto.`)
    await conn.sendMessage(m.chat, { text: texto, mentions: [m.sender] }, { quoted: m.raw })
  }
}

handler.help = ['menu', 'help', 'comandos']
handler.tags = ['general']
handler.command = ['menu', 'help', 'comandos']

module.exports = handler
