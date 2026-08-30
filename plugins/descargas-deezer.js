const crypto = require('crypto')
const dfail = require('../lib/dfail')
const { evogbApiKey } = require('../settings')
const { obtenerUsuario, modificarSaldo, numeroDeSender } = require('../lib/db')

const API_BASE = 'https://api.evogb.org'
const TIMEOUT_MS = 30_000
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const COSTO_MASTERCOINS = 5
const COOLDOWN_MS = 15_000
const INTENTOS_DESCARGA = 2
const MAX_RESULTADOS = 5
const TTL_BUSQUEDA_MS = 3 * 60 * 1000

const ultimoUso = new Map()
const busquedasPendientes = new Map()

function limpiarBusquedasVencidas() {
  const ahora = Date.now()
  for (const [id, datos] of busquedasPendientes) {
    if (ahora - datos.creada > TTL_BUSQUEDA_MS) busquedasPendientes.delete(id)
  }
}

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

function formatearDuracion(duracion) {
  if (!duracion) return null
  if (typeof duracion === 'string' && duracion.includes(':')) return duracion

  const s = Number(duracion)
  if (!s || isNaN(s)) return null
  const min = Math.floor(s / 60)
  const seg = Math.floor(s % 60).toString().padStart(2, '0')
  return `${min}:${seg}`
}

async function descargarYEnviar(m, conn, resultado) {
  const downloadParams = new URLSearchParams({ url: resultado.url, key: evogbApiKey })
  const downloadData = await fetchJson(`${API_BASE}/dl/deezer?${downloadParams}`)
  const audioUrl = downloadData.data?.dl
  if (!audioUrl) throw new Error('La API no devolvió un enlace de audio.')

  const audio = await descargarConReintentos(audioUrl)

  const titulo = resultado.title || downloadData.data?.title || 'Audio de Deezer'
  const artista = resultado.artist || downloadData.data?.artist || 'Artista desconocido'
  const duracion = formatearDuracion(resultado.duration || downloadData.data?.duration)

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

  const numero = numeroDeSender(m)
  const ahora = Date.now()
  const ultima = ultimoUso.get(numero) || 0
  const restanteCooldown = COOLDOWN_MS - (ahora - ultima)
  if (restanteCooldown > 0) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Espera ${Math.ceil(restanteCooldown / 1000)}s antes de buscar otra canción.`) },
      { quoted: m.raw }
    )
  }

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
    limpiarBusquedasVencidas()

    const searchParams = new URLSearchParams({ query: busqueda, limit: String(MAX_RESULTADOS), key: evogbApiKey })
    const searchData = await fetchJson(`${API_BASE}/search/deezer?${searchParams}`)
    const resultados = (Array.isArray(searchData.data) ? searchData.data : []).filter(r => r?.url).slice(0, MAX_RESULTADOS)

    if (!resultados.length) {
      return conn.sendMessage(m.chat, { text: dfail('No encontré resultados para esa búsqueda.') }, { quoted: m.raw })
    }

    const searchId = crypto.randomBytes(4).toString('hex')
    busquedasPendientes.set(searchId, { numero, chat: m.chat, resultados, creada: ahora })

    const rows = resultados.map((r, i) => {
      const duracion = formatearDuracion(r.duration)
      return {
        title: (r.title || 'Sin título').slice(0, 60),
        description: `${r.artist || 'Desconocido'}${duracion ? ` • ${duracion}` : ''}`,
        rowId: `deezer|${searchId}|${i}`,
      }
    })

    await conn.sendMessage(
      m.chat,
      {
        text: `ꕥ Resultados para *"${busqueda}"*\n> Elige una canción de la lista (cuesta ${COSTO_MASTERCOINS} 🪙 MASTERCOINS).`,
        footer: 'Tech Master Bot',
        title: '🎵 Deezer',
        buttonText: '📋 Ver resultados',
        sections: [{ title: 'Resultados', rows }],
      },
      { quoted: m.raw }
    )
  } catch (error) {
    const mensaje = error.name === 'AbortError' ? 'La API tardó demasiado en responder.' : error.message
    console.log('Error en Deezer (búsqueda):', mensaje)
    await conn.sendMessage(m.chat, { text: dfail(`No se pudo buscar la canción:\n> ${mensaje}`) }, { quoted: m.raw })
  }
}

handler.all = async (m, { conn }) => {
  const selectedRowId = m.raw.message?.listResponseMessage?.singleSelectReply?.selectedRowId
  if (!selectedRowId || !selectedRowId.startsWith('deezer|')) return

  const [, searchId, indiceTexto] = selectedRowId.split('|')
  const busquedaGuardada = busquedasPendientes.get(searchId)

  if (!busquedaGuardada) {
    return conn.sendMessage(m.chat, { text: dfail('Esta lista ya expiró, busca la canción de nuevo.') }, { quoted: m.raw })
  }

  if (numeroDeSender(m) !== busquedaGuardada.numero) return

  busquedasPendientes.delete(searchId)

  const resultado = busquedaGuardada.resultados[Number(indiceTexto)]
  if (!resultado) {
    return conn.sendMessage(m.chat, { text: dfail('Esa opción ya no es válida.') }, { quoted: m.raw })
  }

  const usuario = obtenerUsuario(m)
  if ((usuario?.mastercoins || 0) < COSTO_MASTERCOINS) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Ya no tienes suficientes MASTERCOINS (necesitas ${COSTO_MASTERCOINS}).`) },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(m.chat, { text: `ꕥ Descargando "${resultado.title}"...` }, { quoted: m.raw })
    await descargarYEnviar(m, conn, resultado)
  } catch (error) {
    const mensaje = error.name === 'AbortError' ? 'La API tardó demasiado en responder.' : error.message
    console.log('Error en Deezer (descarga):', mensaje)
    await conn.sendMessage(m.chat, { text: dfail(`No se pudo descargar la canción:\n> ${mensaje}`) }, { quoted: m.raw })
  }
}

handler.help = ['deezer <búsqueda>']
handler.tags = ['downloader']
handler.command = ['deezer', 'dz']

module.exports = handler
