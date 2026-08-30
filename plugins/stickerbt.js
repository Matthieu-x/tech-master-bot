const dfail = require('../lib/dfail')

const SEARCH_URL = 'https://api.delirius.online/search/stickerly'
const DOWNLOAD_URL = 'https://api.delirius.online/download/stickerly'

// Intenta ubicar el array de resultados sin importar bajo qué clave venga
function extraerLista(json) {
  if (Array.isArray(json)) return json
  if (Array.isArray(json?.data)) return json.data
  if (Array.isArray(json?.data?.result)) return json.data.result
  if (Array.isArray(json?.result)) return json.result
  return []
}

// Intenta ubicar la url del pack de sticker.ly en un resultado de búsqueda
function urlDePaquete(item) {
  return item?.url || item?.link || item?.share_url || item?.packUrl || null
}

let handler = async (m, { conn, command, args, usedPrefix }) => {
  const prefijo = usedPrefix || '.'
  const tipo = command.toLowerCase()
  const query = args.join(' ').trim()

  try {
    if (tipo === 'stickerly' || tipo === 'sticker') {
      if (!query) {
        return conn.sendMessage(
          m.chat,
          {
            text: dfail(
              `Escribe algo para buscar packs de stickers.\n` +
              `Ejemplo: ${prefijo}${tipo} my melody`
            ),
          },
          { quoted: m.raw }
        )
      }

      const respuesta = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}`)
      if (!respuesta.ok) throw new Error(`La API respondió con estado ${respuesta.status}`)

      const json = await respuesta.json()
      const lista = extraerLista(json)

      if (!lista.length) {
        throw new Error(`No se encontraron packs de stickers para "${query}"`)
      }

      const top = lista.slice(0, 10)
      const texto = top
        .map((item, i) => {
          const nombre = item?.name || item?.title || `Pack ${i + 1}`
          const autor = item?.author || item?.artist || 'desconocido'
          const url = urlDePaquete(item)
          return `${i + 1}. *${nombre}* — por ${autor}\n   URL: ${url}`
        })
        .join('\n\n')

      return conn.sendMessage(
        m.chat,
        {
          text:
            `🔎 Resultados para "${query}":\n\n${texto}\n\n` +
            `Usa ${prefijo}stickerdl <URL> para descargar un pack.`,
        },
        { quoted: m.raw }
      )
    }

    if (tipo === 'stickerdl') {
      if (!query) {
        return conn.sendMessage(
          m.chat,
          {
            text: dfail(
              `Indica la URL del pack de sticker.ly a descargar.\n` +
              `Ejemplo: ${prefijo}${tipo} https://sticker.ly/s/MPTYYK`
            ),
          },
          { quoted: m.raw }
        )
      }

      const respuesta = await fetch(`${DOWNLOAD_URL}?url=${encodeURIComponent(query)}`)
      if (!respuesta.ok) throw new Error(`La API respondió con estado ${respuesta.status}`)

      const json = await respuesta.json()
      const stickers = extraerLista(json?.data?.stickers || json?.stickers || json)

      if (!stickers.length) {
        throw new Error(`No se pudieron obtener los stickers de "${query}"`)
      }

      await conn.sendMessage(
        m.chat,
        { text: `📦 Descargando ${stickers.length} stickers...` },
        { quoted: m.raw }
      )

      for (const st of stickers) {
        const url = typeof st === 'string' ? st : st?.url || st?.image
        if (!url) continue
        await conn.sendMessage(
          m.chat,
          { sticker: { url } },
          { quoted: m.raw }
        )
      }
      return
    }
  } catch (e) {
    console.log(`Error en "${tipo}":`, e)
    await conn.sendMessage(
      m.chat,
      { text: dfail(`Error obteniendo stickers para "${tipo}":\n> ${e.message}`) },
      { quoted: m.raw }
    )
  }
}

handler.help = ['stickerly <búsqueda>', 'stickerdl <url>']
handler.tags = ['sticker']
handler.command = ['stickerly', 'sticker', 'stickerdl']

module.exports = handler