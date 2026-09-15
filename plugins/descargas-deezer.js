const { enviarBotones, enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 5 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.deezerPendientes) {
  global.deezerPendientes = new Map()
}

const pendientes = global.deezerPendientes

function limpiarVencidas() {
  const ahora = Date.now()
  for (const [clave, valor] of pendientes) {
    if (!valor || ahora > valor.expira) {
      pendientes.delete(clave)
    }
  }
}

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

async function buscarDeezer(query) {
  const url =
    `${API_BASE}/search/deezer?apikey=${encodeURIComponent(API_KEY)}` +
    `&q=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }   // ✅ IP agregada
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Se agotaron las solicitudes de hoy (429)')
    }
    if (res.status === 403) {
      throw new Error('IP bloqueada o endpoint no permitido en tu plan (403)')
    }
    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()

  if (!data || data.status !== true) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  if (!Array.isArray(data.results)) {
    throw new Error('Resultados inválidos')
  }

  return data.results
}

async function descargarBuffer(url) {
  const res = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }
  })
  if (!res.ok) {
    throw new Error(`Fallo descarga: HTTP ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function enviarListaDeezer(conn, m, canciones, usedPrefix, query) {
  return enviarLista(conn, m.chat, {
    texto:
      `🎵 *Deezer:* ${query}\n\n` +
      `🔍 Encontradas: ${canciones.length}`,
    footer: `Toca una canción para verla · expira en 5 min`,
    titulo: 'Deezer Search',
    textoBoton: 'Ver canciones',
    mensajeCitado: m.raw,
    secciones: [
      {
        titulo: `${canciones.length} resultado(s)`,
        filas: canciones.map((c, i) => ({
          titulo: `${c.title} - ${c.artist}`.slice(0, 60),
          id: `${usedPrefix}deezerget ${i}`,
          descripcion: `⏱️ ${c.duration} · Rank ${c.rank || 'N/A'}`
        }))
      }
    ]
  })
}

async function enviarBotonMas(conn, m, usedPrefix, query, restantes) {
  return enviarBotones(conn, m.chat, {
    texto:
      `✅ *Enviado*\n\n` +
      `🔎 Búsqueda: ${query}\n` +
      `📦 Restantes: ${restantes}`,
    footer: `Expira en 5 min`,
    botones: [
      {
        texto: '🎵 Ver más canciones',
        id: `${usedPrefix}deezermas`
      }
    ],
    mensajeCitado: m.raw
  })
}

async function enviarCancion(conn, m, cancion) {
  const caption =
    `🎵 *${cancion.title}*\n\n` +
    `👤 Artista: ${cancion.artist}\n` +
    `⏱️ Duración: ${cancion.duration}\n` +
    `📊 Rank: ${cancion.rank || 'N/A'}\n` +
    `🔗 ${cancion.url}`

  await conn.sendMessage(
    m.chat,
    {
      image: { url: cancion.image },
      caption
    },
    { quoted: m.raw }
  )

  if (cancion.preview) {
    try {
      const audioBuffer = await descargarBuffer(cancion.preview)
      await conn.sendMessage(
        m.chat,
        {
          audio: audioBuffer,
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: `${cancion.title} - ${cancion.artist}.mp3`
        },
        { quoted: m.raw }
      )
    } catch (e) {
      console.error('[DEEZER] Falló preview:', e.message)
    }
  }
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  limpiarVencidas()

  const comando = (command || '').toLowerCase()
  const clave = claveBusqueda(m)

  if (comando === 'deezerget') {
    const indice = Number(args[0])
    const pendiente = pendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.canciones ||
      Number.isNaN(indice) ||
      !pendiente.canciones[indice]
    ) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ Esa búsqueda expiró.\n\n> Usa ${usedPrefix}deezer de nuevo.` },
        { quoted: m.raw }
      )
    }

    const cancion = pendiente.canciones[indice]

    try {
      await enviarCancion(conn, m, cancion)

      const restantes = pendiente.canciones.length - (indice + 1)
      if (restantes > 0) {
        return enviarBotonMas(conn, m, usedPrefix, pendiente.query, restantes)
      }
      return
    } catch (e) {
      console.error('[DEEZER]', e)
      return conn.sendMessage(
        m.chat,
        { text: `❌ Error al enviar la canción.\n\n> ${e.message}` },
        { quoted: m.raw }
      )
    }
  }

  if (comando === 'deezermas') {
    const pendiente = pendientes.get(clave)

    if (!pendiente || !pendiente.canciones) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ Expiró la búsqueda.\n\n> Usa ${usedPrefix}deezer de nuevo.` },
        { quoted: m.raw }
      )
    }

    return enviarListaDeezer(
      conn,
      m,
      pendiente.canciones,
      usedPrefix,
      pendiente.query
    )
  }

  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Escribe qué canción buscar.\n\n` +
          `📌 Ejemplo:\n${usedPrefix}deezer twice`
      },
      { quoted: m.raw }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      { text: `🎵 *Buscando en Deezer...*\n\n> ${query}` },
      { quoted: m.raw }
    )

    const canciones = await buscarDeezer(query)

    if (!canciones.length) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ No encontré canciones para:\n> ${query}` },
        { quoted: m.raw }
      )
    }

    const resultados = canciones.slice(0, MAX_RESULTADOS)

    pendientes.set(clave, {
      query,
      canciones: resultados,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    return enviarListaDeezer(conn, m, resultados, usedPrefix, query)
  } catch (error) {
    console.error('[DEEZER]', error)
    return conn.sendMessage(
      m.chat,
      { text: `❌ Error al buscar.\n\n> ${error.message}` },
      { quoted: m.raw }
    )
  }
}

handler.help = ['deezer <búsqueda>']
handler.tags = ['deezer']
handler.command = ['deezer', 'deezerget', 'deezermas']
handler.registro = false

module.exports = handler