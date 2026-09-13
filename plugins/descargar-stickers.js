const { enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbit-cloud.onrender.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.stickerBusquedasPendientes) {
  global.stickerBusquedasPendientes = new Map()
}

const busquedasPendientes = global.stickerBusquedasPendientes

function limpiarBusquedasVencidas() {
  const ahora = Date.now()
  for (const [clave, valor] of busquedasPendientes) {
    if (!valor || ahora > valor.expira) busquedasPendientes.delete(clave)
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
    throw new Error(data?.error || 'La API de Orbit no devolvió un resultado válido')
  }

  return data
}

async function buscarStickers(query) {
  const data = await llamarOrbit('sticker-search', `query=${encodeURIComponent(query)}`)
  if (!Array.isArray(data.results)) throw new Error('Respuesta de stickers inválida')
  return data.results
}

async function enviarListaStickers(conn, m, stickers, usedPrefix, query) {
  return enviarLista(conn, m.chat, {
    texto:
      `🔎 *Stickers para:* ${query}\n\n` +
      `🎨 Encontrados: ${stickers.length}`,
    footer: 'Selecciona uno · expira en 3 minutos',
    titulo: 'Sticker Search',
    textoBoton: 'Ver stickers',
    mensajeCitado: m.raw,
    secciones: [
      {
        titulo: `${stickers.length} resultado(s)`,
        filas: stickers.map((s, i) => ({
          titulo: (s.title || 'Sticker').slice(0, 60),
          id: `${usedPrefix}stickerget ${i}`,
          descripcion: 'Toca para enviarlo'
        }))
      }
    ]
  })
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  limpiarBusquedasVencidas()

  const comando = (command || '').toLowerCase()
  const clave = claveBusqueda(m)

  if (comando === 'stickerget') {
    const indice = Number(args[0])
    const pendiente = busquedasPendientes.get(clave)

    if (!pendiente || !pendiente.stickers || Number.isNaN(indice) || !pendiente.stickers[indice]) {
      return conn.sendMessage(m.chat, {
        text: `❌ Esa búsqueda expiró o no es válida.\n\n> Usa ${usedPrefix}sticker de nuevo.`
      }, { quoted: m.raw })
    }

    const sticker = pendiente.stickers[indice]

    try {
      await conn.sendMessage(m.chat, { text: `🎨 *_Enviando "${sticker.title}"..._*` }, { quoted: m.raw })

      await conn.sendMessage(m.chat, {
        sticker: { url: sticker.image }
      }, { quoted: m.raw })

      return
    } catch (error) {
      console.error('[STICKER]', error)
      return conn.sendMessage(m.chat, {
        text: `❌ Error al enviar el sticker.\n\n> ${error.message || 'Error desconocido'}`
      }, { quoted: m.raw })
    }
  }

  if (!text || !text.trim()) {
    return conn.sendMessage(m.chat, {
      text: `❌ Escribe qué sticker buscar.\n\n📌 Ejemplo:\n${usedPrefix}sticker goku`
    }, { quoted: m.raw })
  }

  const query = text.trim()

  try {
    await conn.sendMessage(m.chat, {
      text: `🔎 *Buscando stickers...*\n\n> ${query}`
    }, { quoted: m.raw })

    const stickers = await buscarStickers(query)

    if (!stickers.length) {
      return conn.sendMessage(m.chat, {
        text: `❌ No encontré stickers para:\n> ${query}`
      }, { quoted: m.raw })
    }

    const resultados = stickers
      .filter(s => s && s.image && s.title)
      .slice(0, MAX_RESULTADOS)

    if (!resultados.length) throw new Error('No se encontraron stickers válidos')

    busquedasPendientes.set(clave, {
      stickers: resultados,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    return enviarListaStickers(conn, m, resultados, usedPrefix, query)
  } catch (error) {
    console.error('[STICKER]', error)
    return conn.sendMessage(m.chat, {
      text: `❌ Error al buscar stickers.\n\n> ${error.message || 'Error desconocido'}`
    }, { quoted: m.raw })
  }
}

handler.help = ['sticker <búsqueda>']
handler.tags = ['sticker']
handler.command = ['sticker', 'stickersearch', 'stickerget']
handler.registro = false

module.exports = handler