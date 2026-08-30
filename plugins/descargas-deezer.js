/**
 * plugins/descargas-deezer.js
 * -------------------------------------------------------
 * Busca y descarga una canción de Deezer.
 * Mejoras sobre la versión anterior:
 *   - Cobra MASTERCOINS 🪙💱 por descarga (le da uso a la economía)
 *   - Cooldown por usuario para no saturar la API
 *   - Reintenta la descarga una vez si falla la primera
 *   - Muestra duración de la canción cuando la API la da
 *   - Solo cobra si la descarga se completó con éxito
 * -------------------------------------------------------
 */

const dfail = require('../lib/dfail')
const { evogbApiKey } = require('../settings')
const { obtenerUsuario, modificarSaldo } = require('../lib/db')

const API_BASE = 'https://api.evogb.org'
const TIMEOUT_MS = 30_000
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const COSTO_MASTERCOINS = 5
const COOLDOWN_MS = 15_000
const INTENTOS_DESCARGA = 2

// Cooldown en memoria (por número, se reinicia si el bot se reinicia -- suficiente para evitar spam)
const ultimoUso = new Map()

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

/** Reintenta la descarga hasta INTENTOS_DESCARGA veces antes de rendirse. */
async function descargarConReintentos(url) {
  let ultimoError
  for (let intento = 1; intento <= INTENTOS_DESCARGA; intento++) {
    try {
      return await descargarAudio(url)
    } catch (e) {
      ultimoError = e
      if (intento < INTENTOS_DESCARGA) await new Promise(r => setTimeout(r, 1500))
    }
  }
  throw ultimoError
}

function formatearDuracion(segundos) {
  const s = Number(segundos)
  if (!s || isNaN(s)) return null
  const min = Math.floor(s / 60)
  const seg = Math.floor(s % 60).toString().padStart(2, '0')
  return `${min}:${seg}`
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

  // Cooldown: evita que un usuario dispare descargas seguidas sin pausa
  const numero = require('../lib/db').numeroDeSender(m)
  const ahora = Date.now()
  const ultima = ultimoUso.get(numero) || 0
  const restanteCooldown = COOLDOWN_MS - (ahora - ultima)
  if (restanteCooldown > 0) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Espera ${Math.ceil(restanteCooldown / 1000)}s antes de pedir otra canción.`) },
      { quoted: m.raw }
    )
  }

  // Verifica saldo ANTES de gastar tiempo buscando/descargando
  const usuario = obtenerUsuario(m)
  if ((usuario?.mastercoins || 0) < COSTO_MASTERCOINS) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Necesitas ${COSTO_MASTERCOINS} 🪙 MASTERCOINS para descargar una canción.\n> Tu saldo: ${usuario?.mastercoins || 0}\n> Usa .daily para conseguir más.`) },
      { quoted: m.raw }
    )
  }

  try {
    ultimoUso.set(numero, ahora)
    await conn.sendMessage(m.chat, { text: `ꕥ Buscando "${busqueda}"...` }, { quoted: m.raw })

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

    const audio = await descargarConReintentos(audioUrl)

    const titulo = resultado.title || downloadData.data?.title || 'Audio de Deezer'
    const artista = resultado.artist || downloadData.data?.artist || 'Artista desconocido'
    const duracion = formatearDuracion(resultado.duration || downloadData.data?.duration)

    // Solo se cobra si TODO salió bien hasta este punto
    const saldoNuevo = modificarSaldo(m, -COSTO_MASTERCOINS)

    const caption =
      `ꕥ *${titulo}*\n` +
      `> Artista: ${artista}\n` +
      (duracion ? `> Duración: ${duracion}\n` : '') +
      `> Fuente: Deezer\n\n` +
      `🪙💱 -${COSTO_MASTERCOINS} MASTERCOINS (saldo: ${saldoNuevo ?? '—'})`

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
