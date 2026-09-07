function normalizarJid(jid) {
  if (!jid) return jid
  const [usuario, servidor] = jid.split('@')
  return `${usuario.split(':')[0]}@${servidor}`
}

function serializarMensaje(msg) {
  const tipoMensaje = Object.keys(msg.message)[0]
  const contenido = msg.message[tipoMensaje]

  let texto =
    contenido?.text ||
    contenido?.caption ||
    (tipoMensaje === 'conversation' ? msg.message.conversation : '') ||
    ''

  if (tipoMensaje === 'buttonsResponseMessage') {
    texto = contenido?.selectedButtonId || ''
  }

  if (tipoMensaje === 'templateButtonReplyMessage') {
    texto = contenido?.selectedId || ''
  }

  if (tipoMensaje === 'listResponseMessage') {
    texto = contenido?.singleSelectReply?.selectedRowId || ''
  }

  if (tipoMensaje === 'interactiveResponseMessage') {
    try {
      const paramsJson = contenido?.nativeFlowResponseMessage?.paramsJson
      if (paramsJson) {
        const params = JSON.parse(paramsJson)
        texto = params.id || params.selectedId || params.buttonId || params.rowId || texto
      }
    } catch {}
  }

  const sender = msg.key.participant || msg.key.remoteJid
  const senderAlt = msg.key.participantAlt || msg.key.participantPn || null
  const senderNumero = (sender.endsWith('@lid') && senderAlt) ? senderAlt : sender

  return {
    raw: msg,
    key: msg.key,
    chat: msg.key.remoteJid,
    sender,
    senderNumero,
    fromMe: msg.key.fromMe,
    text: texto,
    isGroup: msg.key.remoteJid?.endsWith('@g.us'),
  }
}

module.exports = { serializarMensaje, normalizarJid }