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

// Intenta ubicar el link/id de descarga de un paquete de stickers
function idDePaquete(item) {
  return item?.packId || item?.id || item?.url || item?.link || null
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
              `Ejemplo: ${prefijo}${tipo} gato`
            ),
          },
          { quoted: m.raw }
        )
      }

      const respuesta = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`)
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
          const id = idDePaquete(item)
          return `${i + 1}. *${nombre}* — por ${autor}\n   ID: ${id}`
        })
        .join('\n\n')

      return conn.sendMessage(
        m.chat,
        {
          text:
            `🔎 Resultados para "${query}":\n\n${texto}\n\n` +
            `Usa ${prefijo}stickerdl <ID> para descargar un pack.`,
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
              `Indica el ID del pack a descargar.\n` +
              `Ejemplo: ${prefijo}${tipo} <ID>`
            ),
          },
          { quoted: m.raw }
        )
      }

      const respuesta = await fetch(`${DOWNLOAD_URL}?id=${encodeURIComponent(query)}`)
      if (!respuesta.ok) throw new Error(`La API respondió con estado ${respuesta.status}`)

      const json = await respuesta.json()
      const stickers = extraerLista(json?.data?.stickers || json?.stickers || json)

      if (!stickers.length) {
        throw new Error(`No se pudieron obtener los stickers del pack "${query}"`)
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

handler.help = ['stickerly <búsqueda>', 'stickerdl <id>']
handler.tags = ['sticker']
handler.command = ['stickerly', 'sticker', 'stickerdl']

module.exports = handler