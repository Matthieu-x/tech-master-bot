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

function urlDePaquete(item) {
  return item?.url || item?.link || item?.share_url || item?.packUrl || null
}

function esUrlStickerly(texto) {
  return /^https?:\/\/(www\.)?sticker\.ly\//i.test(texto)
}

let handler = async (m, { conn, command, args, usedPrefix }) => {
  const prefijo = usedPrefix || '.'
  const tipo = command.toLowerCase()
  const query = args.join(' ').trim()

  if (!query) {
    return conn.sendMessage(
      m.chat,
      {
        text: dfail(
          `Escribe una búsqueda o pega el link de un pack de sticker.ly.\n` +
          `Ejemplo: ${prefijo}${tipo} my melody\n` +
          `Ejemplo: ${prefijo}${tipo} https://sticker.ly/s/MPTYYK`
        ),
      },
      { quoted: m.raw }
    )
  }

  try {
    let urlPaquete = query

    // Si no es un link directo, primero buscamos y usamos el primer resultado
    if (!esUrlStickerly(query)) {
      const respBusqueda = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}`)
      if (!respBusqueda.ok) throw new Error(`La búsqueda respondió con estado ${respBusqueda.status}`)

      const jsonBusqueda = await respBusqueda.json()
      const lista = extraerLista(jsonBusqueda)

      if (!lista.length) {
        throw new Error(`No se encontraron packs de stickers para "${query}"`)
      }

      urlPaquete = urlDePaquete(lista[0])
      if (!urlPaquete) {
        throw new Error('No se pudo obtener la URL del primer resultado')
      }
    }

    const respDescarga = await fetch(`${DOWNLOAD_URL}?url=${encodeURIComponent(urlPaquete)}`)
    if (!respDescarga.ok) throw new Error(`La descarga respondió con estado ${respDescarga.status}`)

    const jsonDescarga = await respDescarga.json()
    const stickers = extraerLista(
      jsonDescarga?.data?.stickers || jsonDescarga?.stickers || jsonDescarga
    )

    if (!stickers.length) {
      throw new Error(`No se pudieron obtener los stickers de "${query}"`)
    }

    for (const st of stickers) {
      const url = typeof st === 'string' ? st : st?.url || st?.image
      if (!url) continue
      await conn.sendMessage(
        m.chat,
        { sticker: { url } },
        { quoted: m.raw }
      )
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

handler.help = ['stickerly <búsqueda o url>']
handler.tags = ['sticker']
handler.command = ['stickerly', 'sticker']

module.exports = handler