const dfail = require('../lib/dfail')
const { evogbApiKey } = require('../settings')

const API_BASE = 'https://api.evogb.org'
const TIMEOUT_MS = 30_000
const MAX_AUDIO_BYTES = 15 * 1024 * 1024

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const body = await response.text()
    let data
    try {
      data = JSON.parse(body)
    } catch {
      throw new Error('La API devolvió una respuesta inválida.')
    }
    if (!response.ok || data.status === false) {
      throw new Error(data.message || `La API respondió con HTTP ${response.status}.`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

async function descargarAudio(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`No se pudo descargar el audio: HTTP ${response.status}.`)
    const longitud = Number(response.headers.get('content-length') || 0)
    if (longitud > MAX_AUDIO_BYTES) throw new Error('El audio supera el límite permitido de 15 MB.')
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length) throw new Error('La descarga devolvió un archivo vacío.')
    if (buffer.length > MAX_AUDIO_BYTES) throw new Error('El audio supera el límite permitido de 15 MB.')
    return buffer
  } finally {
    clearTimeout(timer)
  }
}

let handler = async (m, { conn, text }) => {
  if (!evogbApiKey) {
    return conn.sendMessage(m.chat, { text: dfail('La API de Deezer no está configurada en el servidor.') }, { quoted: m.raw })
  }

  const busqueda = String(text || '').trim()
  if (!busqueda) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Uso: deezer nombre de la canción o artista\nEjemplo: deezer Hips Don’t Lie Shakira') },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(m.chat, { text: 'ꕥ Buscando la canción...' }, { quoted: m.raw })

    const searchParams = new URLSearchParams({ q: busqueda, apikey: evogbApiKey })
    const searchData = await fetchJson(`${API_BASE}/search/deezer?${searchParams}`)
    const resultado = Array.isArray(searchData.data) ? searchData.data[0] : null

    if (!resultado?.url) {
      return conn.sendMessage(m.chat, { text: dfail('No encontré resultados para esa búsqueda.') }, { quoted: m.raw })
    }

    const downloadParams = new URLSearchParams({ url: resultado.url, apikey: evogbApiKey })
    const downloadData = await fetchJson(`${API_BASE}/dl/deezer?${downloadParams}`)
    const audioUrl = downloadData.data?.dl
    if (!audioUrl) throw new Error('La API no devolvió un enlace de audio.')

    const audio = await descargarAudio(audioUrl)
    const titulo = resultado.title || downloadData.data?.title || 'Audio de Deezer'
    const artista = resultado.artist || downloadData.data?.artist || 'Artista desconocido'
    const caption = `ꕥ *${titulo}*\n> Artista: ${artista}\n> Fuente: Deezer`

    await conn.sendMessage(
      m.chat,
      { audio, mimetype: 'audio/mpeg', fileName: `${titulo} - ${artista}.mp3`, caption },
      { quoted: m.raw }
    )
  } catch (error) {
    const mensaje = error.name === 'AbortError' ? 'La API tardó demasiado en responder.' : error.message
    console.log('Error en Deezer:', mensaje)
    await conn.sendMessage(m.chat, { text: dfail(`No se pudo obtener la canción:\n> ${mensaje}`) }, { quoted: m.raw })
  }
}

handler.help = ['deezer <búsqueda>']
handler.tags = ['downloader']
handler.command = ['deezer', 'dz']

module.exports = handler
