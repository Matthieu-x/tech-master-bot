const dfail = require('../lib/dfail')

const API_URL = 'https://apiyosoyyo-ofc.onrender.com/api/youtube'
const API_KEY = 'yosoyyo_sk_qin39ynp'
const TIMEOUT_MS = 30_000

async function buscarYouTube(consulta) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const params = new URLSearchParams({ q: consulta, apiKey: API_KEY })
    const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal })
    const texto = await response.text()
    let datos
    try {
      datos = JSON.parse(texto)
    } catch {
      throw new Error('La API devolvió una respuesta inválida.')
    }
    if (!response.ok) throw new Error(`La API respondió con HTTP ${response.status}.`)
    if (datos.status !== true) throw new Error(datos.message || 'La API no encontró el video.')
    if (!datos.result?.url) throw new Error('La API no devolvió un enlace de YouTube.')
    return datos.result
  } finally {
    clearTimeout(timer)
  }
}

let handler = async (m, { conn, text }) => {
  const consulta = String(text || '').trim()
  if (!consulta) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Uso: ytsearch nombre del video\nEjemplo: ytsearch gura') },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(m.chat, { text: 'ꕥ Buscando en YouTube...' }, { quoted: m.raw })
    const resultado = await buscarYouTube(consulta)
    const titulo = resultado.title || 'Video encontrado'
    const enlace = resultado.url
    await conn.sendMessage(
      m.chat,
      { text: `ꕥ *${titulo}*\n\n> ${enlace}` },
      { quoted: m.raw }
    )
  } catch (error) {
    const mensaje = error.name === 'AbortError' ? 'La API tardó demasiado en responder.' : error.message
    console.log('Error en ytsearch:', mensaje)
    await conn.sendMessage(m.chat, { text: dfail(`No se pudo buscar en YouTube:\n> ${mensaje}`) }, { quoted: m.raw })
  }
}

handler.help = ['ytsearch <búsqueda>']
handler.tags = ['buscador']
handler.command = ['ytsearch', 'yts']

module.exports = handler
