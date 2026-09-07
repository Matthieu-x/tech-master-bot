const API_KEY = 'ORBIT-UODSS'
const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/ia'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `Debes escribir algo para preguntarle a la IA.\n\n` +
          `Ejemplo:\n` +
          `${usedPrefix}ia Hola, ¿cómo estás?`
      },
      { quoted: m.raw }
    )
  }

  const pregunta = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      {
        text: `Procesando tu consulta...`
      },
      { quoted: m.raw }
    )

    const apiUrl =
      `${API_URL}?apikey=${encodeURIComponent(API_KEY)}` +
      `&text=${encodeURIComponent(pregunta)}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (
      !data ||
      !data.status ||
      !data.data ||
      !data.data.response
    ) {
      throw new Error('La API no devolvió una respuesta válida')
    }

    const respuesta = data.data.response

    await conn.sendMessage(
      m.chat,
      {
        text: respuesta
      },
      { quoted: m.raw }
    )

  } catch (error) {
    console.error('[IA]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `No se pudo obtener una respuesta de la IA.\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = ['ia <texto>']
handler.tags = ['ai']
handler.command = ['ia', 'ai']
handler.registro = true

module.exports = handler