const { enviarBotones, enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 5 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.tiktokPendientes) {
  global.tiktokPendientes = new Map()
}
const pendientes = global.tiktokPendientes

function limpiarVencidas() {
  const ahora = Date.now()
  for (const [clave, valor] of pendientes) {
    if (!valor || ahora > valor.expira) pendientes.delete(clave)
  }
}

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

async function orbitFetch(path, params = {}) {
  const qs = new URLSearchParams({ apikey: API_KEY, ...params }).toString()
  const url = `${API_BASE}/${path}?${qs}`

  const res = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('API key inválida o IP no registrada (401)')
    if (res.status === 403) throw new Error('IP bloqueada (403)')
    if (res.status === 429) throw new Error('Se agotaron las solicitudes (429)')
    throw new Error(`HTTP ${res.status}`)
  }

  return res.json()
}

async function buscarTikTok(query) {
  const data = await orbitFetch('tiktok-search', { query })

  if (!data || data.status !== true || !Array.isArray(data.results)) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data.results
}

async function descargarTikTokPorUrl(url) {
  const data = await orbitFetch('download/tiktok', { url })

  if (!data || data.status !== true || !data.data?.video) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data.data
}

function formatearNumero(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatearDuracion(seg) {
  const s = Number(seg) || 0
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
}

async function enviarListaTikTok(conn, m, videos, usedPrefix, query) {
  return enviarLista(conn, m.chat, {
    texto:
      `🎬 *TikTok:* ${query}\n\n` +
      `📦 Resultados: ${videos.length}`,
    footer: `Toca uno para enviarlo · expira en 5 min`,
    titulo: 'TikTok Search',
    textoBoton: 'Ver videos',
    mensajeCitado: m.raw,
    secciones: [
      {
        titulo: `${videos.length} video(s)`,
        filas: videos.map((v, i) => ({
          titulo: `@${v.author?.uniqueId || '?'} · ${v.desc?.slice(0, 40) || 'Sin desc'}`,
          id: `${usedPrefix}tiktokget ${i}`,
          descripcion: `👁️ ${formatearNumero(v.stats?.playCount)} · ❤️ ${formatearNumero(v.stats?.diggCount)} · ⏱️ ${formatearDuracion(v.video?.duration)}`
        }))
      }
    ]
  })
}

async function enviarBotonMas(conn, m, usedPrefix, query, restantes) {
  return enviarBotones(conn, m.chat, {
    texto:
      `✅ *Video enviado*\n\n` +
      `🔎 Búsqueda: ${query}\n` +
      `📦 Restantes: ${restantes}`,
    footer: `Expira en 5 min`,
    botones: [
      {
        texto: '🎬 Más videos',
        id: `${usedPrefix}tiktokmas`
      }
    ],
    mensajeCitado: m.raw
  })
}

async function enviarVideoTikTok(conn, m, video) {
  const urlVideo = video.video?.play || video.video?.download
  if (!urlVideo) throw new Error('Sin URL de video')

  const caption =
    `🎬 *@${video.author?.uniqueId || '?'}* (${video.author?.nickname || ''})\n\n` +
    `📝 ${video.desc || 'Sin descripción'}\n\n` +
    `👁️ ${formatearNumero(video.stats?.playCount)} vistas\n` +
    `❤️ ${formatearNumero(video.stats?.diggCount)} likes\n` +
    `💬 ${formatearNumero(video.stats?.commentCount)} comentarios\n` +
    `🔗 ${video.url}`

  return conn.sendMessage(
    m.chat,
    {
      video: { url: urlVideo },
      mimetype: 'video/mp4',
      caption
    },
    { quoted: m.raw }
  )
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  limpiarVencidas()

  const comando = (command || '').toLowerCase()
  const clave = claveBusqueda(m)

  // ── Enviar video seleccionado ──
  if (comando === 'tiktokget') {
    const indice = Number(args[0])
    const pendiente = pendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.videos ||
      Number.isNaN(indice) ||
      !pendiente.videos[indice]
    ) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ Esa búsqueda expiró.\n\n> Usa ${usedPrefix}tiktok de nuevo.` },
        { quoted: m.raw }
      )
    }

    const video = pendiente.videos[indice]

    try {
      await enviarVideoTikTok(conn, m, video)

      const restantes = pendiente.videos.length - (indice + 1)
      if (restantes > 0) {
        return enviarBotonMas(conn, m, usedPrefix, pendiente.query, restantes)
      }
      return
    } catch (e) {
      console.error('[TIKTOK]', e)
      return conn.sendMessage(
        m.chat,
        { text: `❌ Error al enviar el video.\n\n> ${e.message}` },
        { quoted: m.raw }
      )
    }
  }

  // ── Botón "más videos" ──
  if (comando === 'tiktokmas') {
    const pendiente = pendientes.get(clave)

    if (!pendiente || !pendiente.videos) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ Expiró la búsqueda.\n\n> Usa ${usedPrefix}tiktok de nuevo.` },
        { quoted: m.raw }
      )
    }

    return enviarListaTikTok(
      conn,
      m,
      pendiente.videos,
      usedPrefix,
      pendiente.query
    )
  }

  // ── Búsqueda inicial ──
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 Escribe qué buscar en TikTok.\n\n` +
          `📌 Ejemplo:\n${usedPrefix}tiktok goku`
      },
      { quoted: m.raw }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      { text: `🎬 *Buscando en TikTok...*\n\n> ${query}` },
      { quoted: m.raw }
    )

    const videos = await buscarTikTok(query)

    if (!videos.length) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ No encontré videos para:\n> ${query}` },
        { quoted: m.raw }
      )
    }

    const resultados = videos.slice(0, MAX_RESULTADOS)

    pendientes.set(clave, {
      query,
      videos: resultados,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    return enviarListaTikTok(conn, m, resultados, usedPrefix, query)
  } catch (error) {
    console.error('[TIKTOK]', error)
    return conn.sendMessage(
      m.chat,
      { text: `❌ Error al buscar.\n\n> ${error.message}` },
      { quoted: m.raw }
    )
  }
}

handler.help = ['tiktok <búsqueda>']
handler.tags = ['tiktok']
handler.command = ['tiktok', 'tiktokget', 'tiktokmas']
handler.registro = false

module.exports = handler