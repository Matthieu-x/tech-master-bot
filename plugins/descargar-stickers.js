const { enviarLista } = require('../lib/botones')
const sharp = require('sharp')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbit-cloud.onrender.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10
const MAX_PACK = 5

const CREDITOS = 'By Lil Matthieu'
const DESCRIPCION = 'Es un legado'

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

function escaparXML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function convertirAWebp(url) {
  const buffer = await descargarImagen(url)

  const base = sharp(buffer, {
    animated: true,
    pages: -1
  })

  const metadata = await base.metadata()

  const width = Math.min(metadata.width || 512, 512)
  const height = Math.min(metadata.height || 512, 512)

  const creditosSvg = Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .credit {
          font-family: Arial, Helvetica, sans-serif;
          font-weight: bold;
          font-size: ${Math.max(16, Math.round(width * 0.045))}px;
          fill: white;
          stroke: black;
          stroke-width: 2px;
          paint-order: stroke;
        }

        .desc {
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${Math.max(12, Math.round(width * 0.032))}px;
          fill: white;
          stroke: black;
          stroke-width: 1.5px;
          paint-order: stroke;
        }
      </style>

      <text
        x="50%"
        y="${height - Math.max(38, Math.round(height * 0.08))}"
        text-anchor="middle"
        class="credit"
      >${escaparXML(CREDITOS)}</text>

      <text
        x="50%"
        y="${height - Math.max(16, Math.round(height * 0.035))}"
        text-anchor="middle"
        class="desc"
      >${escaparXML(DESCRIPCION)}</text>
    </svg>
  `)

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
    .composite([
      {
        input: creditosSvg,
        gravity: 'south'
      }
    ])
    .webp({
      quality: 80,
      effort: 4,
      loop: 0
    })
    .toBuffer()
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
      `🎨 Encontrados: ${stickers.length}`,

    footer:
      `Selecciona uno o envía el pack · expira en 3 min`,

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
      },

      {
        titulo: 'Pack',

        filas: [
          {
            titulo: `Enviar los primeros ${MAX_PACK}`,

            id: `${usedPrefix}stickerpack`,

            descripcion:
              `${CREDITOS} · ${DESCRIPCION}`
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
      const webp = await convertirAWebp(sticker.image)

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

    let ok = 0
    let fail = 0

    for (const s of pack) {
      try {
        const webp = await convertirAWebp(s.image)

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