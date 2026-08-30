const fs = require('fs')
const path = require('path')

const { botName } = require('../settings')
const { leerDB } = require('../lib/db')

const IMAGEN_MENU = path.join(__dirname, '..', 'lib', 'master.jpg')
const TIMEOUT_IMAGEN_MS = 10_000

function cargarComandos() {
  const pluginsDir = path.join(__dirname)
  const archivos = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'))
  const grupos = {}

  for (const archivo of archivos) {
    if (archivo === path.basename(__filename)) continue

    try {
      const ruta = path.join(pluginsDir, archivo)
      delete require.cache[require.resolve(ruta)]
      const plugin = require(ruta)

      if (typeof plugin !== 'function' || !Array.isArray(plugin.command) || !plugin.command.length) continue

      const categoria = Array.isArray(plugin.tags) && plugin.tags.length ? plugin.tags[0] : 'general'
      if (!grupos[categoria]) grupos[categoria] = []

      const [principal, ...alias] = plugin.command.map(c => String(c).toLowerCase())
      grupos[categoria].push({ principal, alias })
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

    menuComandos += `\n〄 *_${categoria.toUpperCase()}_*\n`
    for (const { principal, alias } of comandos) {
      const listaCompleta = [principal, ...alias].map(c => prefijo + c).join(', ')
      menuComandos += `> ✐ ${listaCompleta}\n`
    }
  }

  return menuComandos
}

function conTimeout(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

let handler = async (m, { conn, usedPrefix }) => {
  const prefijo = usedPrefix || '#'
  const numeroMencion = String(m.sender || '').split('@')[0]

  const comandos = crearMenu(prefijo)

  const usuarios = leerDB()
  const totalRegistrados = Object.values(usuarios).filter(u => u?.registrado).length

  const texto =
    `ꕥ *_${botName}_*\n` +
    `✰ *_Hola @${numeroMencion}, bienvenido_*\n\n` +
    `✐ *_Usuarios registrados:_* ${totalRegistrados}\n\n` +
    `〄 *_Comandos disponibles_*${comandos}\n` +
    `> Ejemplo: ${prefijo}ping`

  try {
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
