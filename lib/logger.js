function logMensaje(etiqueta, m) {
  const fecha = new Date().toLocaleString('es-PE', { hour12: false })
  const tipoChat = m.isGroup ? 'grupo' : 'privado'
  const remitente = m.senderNumero || m.sender || 'desconocido'
  const texto = m.text ? m.text.slice(0, 200) : '(sin texto / media)'

  console.log(`[${fecha}] [${etiqueta}] (${tipoChat}) ${m.chat} | de: ${remitente} | tipo: ${m.tipo} | "${texto}"`)
}

function logError(etiqueta, m, error) {
  const fecha = new Date().toLocaleString('es-PE', { hour12: false })
  const remitente = m?.senderNumero || m?.sender || 'desconocido'
  const texto = m?.text ? m.text.slice(0, 200) : '(sin texto / media)'

  console.log(`[${fecha}] [${etiqueta}] ❌ ERROR procesando mensaje de ${remitente} ("${texto}"):`)
  console.log(error)
}

module.exports = { logMensaje, logError }