const { enviarBotones } = require('../lib/botones')
const sharp = require('sharp')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 5 * 60 * 1000
const MAX_ENVIO = 10

if (!global.sticker2Pendientes) {
  global.sticker2Pendientes = new Map()
}

const pendientes = global.sticker2Pendientes

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

async function llamarOrbit(ruta, query) {
  const url =
    `${API_BASE}/${ruta}?apikey=${encodeURIComponent(API_KEY)}` +
    `&${query}`

  const response = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data || data.status !== true) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data
}

async function buscarStickers(query) {
  const data = await llamarOrbit(
    'search/stickerly',
    `query=${encodeURIComponent(query)}`
  )

  if (!Array.isArray(data.results)) {
    throw new Error('Resultados inválidos')
  }

  return data.results
    .map(s => ({
      image: s.preview,
      title: s.name,
      author: s.author,
      url: s.url,
      isAnimated: s.isAnimated
    }))
    .filter(s => s.image && s.title)
}

async function descargarImagen(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Fallo descarga: HTTP ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function convertirAWebp(url) {
  const buffer = await descargarImagen(url)

  return sharp(buffer, { animated: true, pages: -1 })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 80, effort: 4, loop: 0 })
    .toBuffer()
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function enviarLote(conn, m, stickers) {
  const lote = stickers.slice(0, MAX_ENVIO)
  let enviados = 0

  for (const s of lote) {
    try {
      const webp = await convertirAWebp(s.image)
      await conn.sendMessage(m.chat, { sticker: webp }, { quoted: m.raw })
      enviados++
    } catch (e) {
      console.error('[STICKER2] Falló sticker:', e.message)
    }
  }

  return enviados
}

async function enviarBotonMas(conn, m, usedPrefix, query, restantes) {
  const texto =
    `✅ *Enviados ${MAX_ENVIO} stickers*\n\n` +
    `🔎 Búsqueda: ${query}\n` +
    `📦 Disponibles: ${restantes}`

  return enviarBotones(conn, m.chat, {
    texto,
    footer: `Expira en 5 min`,
    botones: [
      {
        texto: '📥 Más stickers',
        id: `${usedPrefix}sticker2mas`
      }
    ],
    mensajeCitado: m.raw
  })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  limpiarVencidas()

  const comando = (command || '').toLowerCase()
  const clave = claveBusqueda(m)

  // ── Botón "Más stickers" ──
  if (comando === 'sticker2mas') {
    const pendiente = pendientes.get(clave)

    if (!pendiente || !pendiente.restantes || !pendiente.restantes.length) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Se agotaron los stickers o expiró la búsqueda.\n\n` +
            `> Usa ${usedPrefix}sticker2 de nuevo.`
        },
        { quoted: m.raw }
      )
    }

    try {
      const lote = pendiente.restantes.slice(0, MAX_ENVIO)
      const enviados = await enviarLote(conn, m, lote)

      pendiente.restantes = pendiente.restantes.slice(enviados)
      pendiente.expira = Date.now() + TIEMPO_SELECCION_MS
      pendientes.set(clave, pendiente)

      if (!pendiente.restantes.length) {
        return conn.sendMessage(
          m.chat,
          { text: `✅ No hay más stickers para "${pendiente.query}"` },
          { quoted: m.raw }
        )
      }

      return enviarBotonMas(
        conn,
        m,
        usedPrefix,
        pendiente.query,
        pendiente.restantes.length
      )
    } catch (e) {
      console.error('[STICKER2]', e)
      return conn.sendMessage(
        m.chat,
        { text: `❌ Error al enviar más stickers.\n\n> ${e.message}` },
        { quoted: m.raw }
      )
    }
  }

  // ── Búsqueda inicial ──
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Escribe qué sticker buscar.\n\n` +
          `📌 Ejemplo:\n${usedPrefix}sticker2 gato`
      },
      { quoted: m.raw }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      { text: `🔎 *Buscando stickers...*\n\n> ${query}` },
      { quoted: m.raw }
    )

    const stickers = await buscarStickers(query)

    if (!stickers.length) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ No encontré stickers para:\n> ${query}` },
        { quoted: m.raw }
      )
    }

    const mezclados = shuffle(stickers)
    const lote = mezclados.slice(0, MAX_ENVIO)
    const restantes = mezclados.slice(MAX_ENVIO)

    const enviados = await enviarLote(conn, m, lote)

    if (enviados === 0) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ No se pudo enviar ningún sticker.` },
        { quoted: m.raw }
      )
    }

    pendientes.set(clave, {
      query,
      restantes,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    if (!restantes.length) {
      return conn.sendMessage(
        m.chat,
        { text: `✅ Enviados: ${enviados} stickers (no hay más)` },
        { quoted: m.raw }
      )
    }

    return enviarBotonMas(conn, m, usedPrefix, query, restantes.length)
  } catch (error) {
    console.error('[STICKER2]', error)
    return conn.sendMessage(
      m.chat,
      { text: `❌ Error al buscar stickers.\n\n> ${error.message}` },
      { quoted: m.raw }
    )
  }
}

handler.help = ['sticker2 <búsqueda>']
handler.tags = ['sticker']
handler.command = ['sticker2', 'sticker2mas']
handler.registro = false

module.exports = handler