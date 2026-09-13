const { enviarLista } = require('../lib/botones')
const sharp = require('sharp')
const { Sticker, StickerTypes } = require('wa-sticker-formatter')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbit-cloud.onrender.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10
const MAX_PACK = 5

const PACK_NAME = 'Lil Matthieu'
const PACK_AUTHOR = 'Lil Matthieu'
const PACK_DESCRIPTION = 'Es un legado'

if (!global.stickerBusquedasPendientes) {
  global.stickerBusquedasPendientes = new Map()
}

const busquedasPendientes = global.stickerBusquedasPendientes

function limpiarBusquedasVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of busquedasPendientes) {
    if (!valor || ahora > valor.expira) {
      busquedasPendientes.delete(clave)
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
    headers: {
      'x-orbit-ip': ORBIT_IP
    }
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
    'sticker-search',
    `query=${encodeURIComponent(query)}`
  )

  if (!Array.isArray(data.results)) {
    throw new Error('Resultados inválidos')
  }

  return data.results
}

async function descargarImagen(url) {
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Fallo descarga: HTTP ${res.status}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

async function prepararSticker(url) {
  const buffer = await descargarImagen(url)

  return sharp(buffer, {
    animated: true,
    pages: -1
  })
    .resize(512, 512, {
      fit: 'contain',
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .webp({
      quality: 80,
      effort: 4,
      loop: 0
    })
    .toBuffer()
}

async function convertirASticker(url) {
  const webp = await prepararSticker(url)

  const sticker = new Sticker(webp, {
    pack: PACK_NAME,
    author: PACK_AUTHOR,
    type: StickerTypes.FULL,
    categories: ['✨'],
    id: `orbit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    quality: 80,
    background: 'transparent'
  })

  return sticker.build()
}

async function enviarListaStickers(
  conn,
  m,
  stickers,
  usedPrefix,
  query
) {
  return enviarLista(conn, m.chat, {
    texto:
      `🔎 *Stickers para:* ${query}\n\n` +
      `🎨 Encontrados: ${stickers.length}\n` +
      `📦 Pack: ${PACK_NAME}\n` +
      `✐ ${PACK_DESCRIPTION}`,

    footer:
      `By ${PACK_AUTHOR} · Selecciona uno o envía el pack · expira en 3 min`,

    titulo: 'Sticker Search',

    textoBoton: 'Ver stickers',

    mensajeCitado: m.raw,

    secciones: [
      {
        titulo: `${stickers.length} resultado(s)`,

        filas: stickers.map((s, i) => ({
          titulo: (s.title || 'Sticker').slice(0, 60),

          id: `${usedPrefix}stickerget ${i}`,

          descripcion:
            `By ${PACK_AUTHOR} · ${PACK_DESCRIPTION}`
        }))
      },

      {
        titulo: 'Pack',

        filas: [
          {
            titulo: `📦 Enviar pack de ${Math.min(
              MAX_PACK,
              stickers.length
            )}`,

            id: `${usedPrefix}stickerpack`,

            descripcion:
              `${PACK_NAME} · ${PACK_DESCRIPTION}`
          }
        ]
      }
    ]
  })
}

let handler = async (
  m,
  {
    conn,
    text,
    usedPrefix,
    command,
    args
  }
) => {
  limpiarBusquedasVencidas()

  const comando = (command || '').toLowerCase()
  const clave = claveBusqueda(m)

  if (comando === 'stickerget') {
    const indice = Number(args[0])
    const pendiente = busquedasPendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.stickers ||
      Number.isNaN(indice) ||
      !pendiente.stickers[indice]
    ) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Esa búsqueda expiró.\n\n` +
            `> Usa ${usedPrefix}sticker de nuevo.`
        },
        {
          quoted: m.raw
        }
      )
    }

    const sticker = pendiente.stickers[indice]

    try {
      await conn.sendMessage(
        m.chat,
        {
          text:
            `🎨 *_Enviando "${sticker.title}"..._*\n\n` +
            `📦 ${PACK_NAME}\n` +
            `✐ ${PACK_DESCRIPTION}`
        },
        {
          quoted: m.raw
        }
      )

      const webp = await convertirASticker(sticker.image)

      await conn.sendMessage(
        m.chat,
        {
          sticker: webp
        },
        {
          quoted: m.raw
        }
      )

      return
    } catch (e) {
      console.error('[STICKER]', e)

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Error al procesar el sticker.\n\n` +
            `> ${e.message}`
        },
        {
          quoted: m.raw
        }
      )
    }
  }

  if (comando === 'stickerpack') {
    const pendiente = busquedasPendientes.get(clave)

    if (!pendiente || !pendiente.stickers) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Esa búsqueda expiró.\n\n` +
            `> Usa ${usedPrefix}sticker de nuevo.`
        },
        {
          quoted: m.raw
        }
      )
    }

    const pack = pendiente.stickers.slice(0, MAX_PACK)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `📦 *Enviando pack...*\n\n` +
          `✐ Autor: ${PACK_AUTHOR}\n` +
          `🎨 Pack: ${PACK_NAME}\n` +
          `📝 ${PACK_DESCRIPTION}\n\n` +
          `🎟️ Stickers: ${pack.length}`
      },
      {
        quoted: m.raw
      }
    )

    let ok = 0
    let fail = 0

    for (const s of pack) {
      try {
        const webp = await convertirASticker(s.image)

        await conn.sendMessage(
          m.chat,
          {
            sticker: webp
          },
          {
            quoted: m.raw
          }
        )

        ok++
      } catch (e) {
        console.error(
          `[STICKER] Falló "${s.title}":`,
          e.message
        )

        fail++
      }
    }

    let resultado =
      `📦 *Pack enviado*\n\n` +
      `🎨 ${PACK_NAME}\n` +
      `✐ By ${PACK_AUTHOR}\n` +
      `📝 ${PACK_DESCRIPTION}\n\n` +
      `✅ ${ok} enviados`

    if (fail > 0) {
      resultado += `\n❌ ${fail} fallaron`
    }

    await conn.sendMessage(
      m.chat,
      {
        text: resultado
      },
      {
        quoted: m.raw
      }
    )

    return
  }

  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Escribe qué sticker buscar.\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}sticker goku`
      },
      {
        quoted: m.raw
      }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🔎 *Buscando stickers...*\n\n` +
          `> ${query}`
      },
      {
        quoted: m.raw
      }
    )

    const stickers = await buscarStickers(query)

    if (!stickers.length) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ No encontré stickers para:\n` +
            `> ${query}`
        },
        {
          quoted: m.raw
        }
      )
    }

    const resultados = stickers
      .filter(s => s?.image && s?.title)
      .slice(0, MAX_RESULTADOS)

    if (!resultados.length) {
      throw new Error('No hay stickers válidos')
    }

    busquedasPendientes.set(clave, {
      stickers: resultados,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    return enviarListaStickers(
      conn,
      m,
      resultados,
      usedPrefix,
      query
    )
  } catch (error) {
    console.error('[STICKER]', error)

    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Error al buscar stickers.\n\n` +
          `> ${error.message}`
      },
      {
        quoted: m.raw
      }
    )
  }
}

handler.help = [
  'sticker <búsqueda>'
]

handler.tags = [
  'sticker'
]

handler.command = [
  'sticker',
  'stickersearch',
  'stickerget',
  'stickerpack'
]

handler.registro = false

module.exports = handler
