const dfail = require('../lib/dfail')

const API_URL = 'https://delirius-api-oficial.vercel.app/api/ytsearch'
const TIMEOUT_MS = 20_000

async function buscarYouTube(consulta) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const params = new URLSearchParams({ q: consulta })
    const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal })
    const texto = await response.text()
    let datos
    try {
      datos = JSON.parse(texto)
    } catch {
      throw new Error('La API devolvió una respuesta inválida.')
    }
    if (!response.ok) throw new Error(`La API respondió con HTTP ${response.status}.`)
    if (!Array.isArray(datos)) throw new Error('La API no devolvió una lista de resultados.')
    return datos
  } finally {
    clearTimeout(timer)
  }
}

function formatearVistas(vistas) {
  const numero = Number(vistas)
  return Number.isFinite(numero) && numero > 0 ? numero.toLocaleString('es-ES') : 'No disponible'
}

function formatearResultado(video, indice) {
  const autor = typeof video.author === 'object' ? video.author?.name : video.author
  return `${indice}. *${video.title || 'Sin título'}*\n> Duración: ${video.timestamp || video.duration?.timestamp || 'No disponible'}\n> Vistas: ${formatearVistas(video.views)}\n> Canal: ${autor || 'No disponible'}\n> ${video.url || `https://www.youtube.com/watch?v=${video.videoId}`}`
}

let handler = async (m, { conn, text }) => {
  const consulta = String(text || '').trim()
  if (!consulta) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Uso: ytsearch nombre del video\nEjemplo: ytsearch música electrónica') },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(m.chat, { text: 'ꕥ Buscando en YouTube...' }, { quoted: m.raw })
    const resultados = await buscarYouTube(consulta)
    if (!resultados.length) {
      return conn.sendMessage(m.chat, { text: dfail('No encontré videos para esa búsqueda.') }, { quoted: m.raw })
    }

    const lista = resultados.slice(0, 5).map(formatearResultado).join('\n\n')
    await conn.sendMessage(
      m.chat,
      { text: `ꕥ *Resultados para:* ${consulta}\n\n${lista}` },
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
