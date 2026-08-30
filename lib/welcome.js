/**
 * lib/welcome.js
 * -------------------------------------------------------
 * Maneja el evento group-participants.update de Baileys:
 * manda bienvenida cuando alguien entra y despedida cuando
 * alguien sale -- si están activados para ese grupo.
 *
 * El on/off por grupo se controla con el comando de chat
 * en plugins/pwelcome.js (#welcome on/off, #bye on/off).
 * -------------------------------------------------------
 */

const { obtenerGrupo } = require('./db')

/**
 * Normaliza un elemento de "participants": puede venir como string
 * plano ("5199...@lid") o como objeto ({ id: '...' }, { jid: '...' })
 * dependiendo de la versión/fork de Baileys y del sistema @lid.
 */
function extraerJid(participante) {
  if (typeof participante === 'string') return participante
  return participante?.id || participante?.jid || participante?.participant || ''
}

async function manejarParticipantes(conn, evento) {
  const { id: chat, participants, action } = evento

  if (!chat?.endsWith('@g.us')) return
  if (action !== 'add' && action !== 'remove') return // ignora promote/demote/etc.

  const config = obtenerGrupo(chat)
  if (action === 'add' && !config.welcome) return
  if (action === 'remove' && !config.bye) return

  let nombreGrupo = ''
  try {
    const metadata = await conn.groupMetadata(chat)
    nombreGrupo = metadata.subject || ''
  } catch (e) {
    nombreGrupo = ''
  }

  for (const participante of participants) {
    const jid = extraerJid(participante)
    if (!jid) continue

    const numero = jid.split('@')[0]

    const texto = action === 'add'
      ? `ꕥ *¡Bienvenido/a!*\n> @${numero} se unió${nombreGrupo ? ` a *${nombreGrupo}*` : ''} 🎉`
      : `ꕥ *Hasta luego*\n> @${numero} salió del grupo 👋`

    try {
      await conn.sendMessage(chat, { text: texto, mentions: [jid] })
    } catch (e) {
      console.log(`ꕥ\n> Error mandando welcome/bye en ${chat}: ${e.message}`)
    }
  }
}

module.exports = { manejarParticipantes }
