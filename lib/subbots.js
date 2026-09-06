const fs = require('fs')
const path = require('path')
const pino = require('pino')
const qrcode = require('qrcode')

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
} = require('@whiskeysockets/baileys')

const handler = require('../handler')
const { serializarMensaje } = require('./serializar')

const CARPETA_SUBBOTS = path.join(__dirname, '..', 'subbots')
const RUTA_DB_SUBBOTS = path.join(__dirname, '..', 'database', 'subbots.json')

const activos = new Map()

function asegurarDB() {
  const carpeta = path.dirname(RUTA_DB_SUBBOTS)
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true })
  if (!fs.existsSync(RUTA_DB_SUBBOTS)) fs.writeFileSync(RUTA_DB_SUBBOTS, JSON.stringify({}, null, 2))
}

function leerRegistro() {
  asegurarDB()
  try {
    return JSON.parse(fs.readFileSync(RUTA_DB_SUBBOTS, 'utf-8'))
  } catch {
    return {}
  }
}

function guardarRegistro(registro) {
  asegurarDB()
  fs.writeFileSync(RUTA_DB_SUBBOTS, JSON.stringify(registro, null, 2))
}

function listarSubbots() {
  const registro = leerRegistro()
  return Object.entries(registro).map(([id, datos]) => ({
    id,
    ...datos,
    conectado: activos.has(id),
  }))
}

function eliminarSubbot(id) {
  const registro = leerRegistro()
  if (!registro[id]) return false

  const activo = activos.get(id)
  if (activo?.conn) {
    try { activo.conn.end?.(undefined) } catch {}
  }
  activos.delete(id)

  delete registro[id]
  guardarRegistro(registro)

  const carpetaSesion = path.join(CARPETA_SUBBOTS, id)
  if (fs.existsSync(carpetaSesion)) {
    fs.rmSync(carpetaSesion, { recursive: true, force: true })
  }

  return true
}

async function iniciarSubbot({ id, numeroCreador, chatCreador, metodo, numeroVincular, avisar }) {
  const carpetaSesion = path.join(CARPETA_SUBBOTS, id)
  if (!fs.existsSync(carpetaSesion)) fs.mkdirSync(carpetaSesion, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(carpetaSesion)
  const { version } = await fetchLatestBaileysVersion()

  const yaRegistrado = state.creds.registered

  const conn = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Tech Master Bot', 'Subbot', '1.0.0'],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: global.botName || 'Tech Master Bot' }),
  })

  activos.set(id, { conn, numero: numeroCreador, chatCreador })

  let codigoYaSolicitado = false
  let qrYaEnviado = false

  conn.ev.on('creds.update', saveCreds)

  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && metodo === 'qr' && !qrYaEnviado && !yaRegistrado) {
      qrYaEnviado = true
      try {
        const bufferQR = await qrcode.toBuffer(qr, { type: 'png', scale: 8 })
        await avisar({
          image: bufferQR,
          caption: '📲 Escanea este código QR desde WhatsApp > Dispositivos vinculados.\n> Expira en unos segundos, si falla usa el comando de nuevo.',
        })
      } catch (e) {
        console.log('Error generando QR de subbot:', e)
      }
    }

    if (metodo === 'code' && numeroVincular && !codigoYaSolicitado && !yaRegistrado) {
      codigoYaSolicitado = true
      setTimeout(async () => {
        try {
          await delay(3000)
          const codigo = await conn.requestPairingCode(numeroVincular)
          await avisar({ text: `🔗 Código de vinculación: *${codigo}*\n> Ve a WhatsApp > Dispositivos vinculados > Vincular con número de teléfono.` })
        } catch (e) {
          console.log('Error solicitando código de subbot:', e)
          await avisar({ text: '❌ No se pudo generar el código de vinculación. Intenta de nuevo.' })
        }
      }, 1000)
    }

    if (connection === 'open') {
      const registro = leerRegistro()
      registro[id] = {
        numero: numeroCreador,
        jid: conn.user?.id || null,
        fecha: registro[id]?.fecha || new Date().toISOString(),
      }
      guardarRegistro(registro)
      await avisar({ text: '✅ Subbot conectado correctamente. Ya puedes usar los comandos del bot desde ese número.' })
    }

    if (connection === 'close') {
      const razon = lastDisconnect?.error?.output?.statusCode
      const cerroSesion = razon === DisconnectReason.loggedOut

      activos.delete(id)

      if (cerroSesion) {
        eliminarSubbot(id)
        await avisar({ text: '⚠️ El subbot cerró sesión y fue eliminado. Usa el comando de nuevo para vincular otro.' })
      } else {
        iniciarSubbot({ id, numeroCreador, chatCreador, metodo, numeroVincular, avisar })
      }
    }
  })

  conn.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const m = serializarMensaje(msg)

    try {
      await handler(conn, m)
    } catch (e) {
      console.log('Error en handler de subbot:', e)
    }
  })

  return conn
}

async function crearSubbot({ conn, m, metodo, numeroVincular }) {
  const numeroCreador = (m.senderNumero || m.sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  const id = numeroCreador

  const avisar = (contenido) => conn.sendMessage(m.chat, contenido, { quoted: m.raw })

  if (activos.has(id)) {
    await avisar({ text: '⚠️ Ya tienes un subbot activo. Usa .delsubbot si quieres vincular uno nuevo.' })
    return
  }

  await avisar({ text: metodo === 'qr' ? '📲 Generando código QR...' : '🔗 Generando código de vinculación...' })

  await iniciarSubbot({ id, numeroCreador, chatCreador: m.chat, metodo, numeroVincular, avisar })
}

async function reconectarSubbotsGuardados() {
  const registro = leerRegistro()

  for (const [id, datos] of Object.entries(registro)) {
    const carpetaSesion = path.join(CARPETA_SUBBOTS, id)
    if (!fs.existsSync(carpetaSesion)) {
      delete registro[id]
      continue
    }

    const avisar = async () => {}

    iniciarSubbot({
      id,
      numeroCreador: datos.numero,
      chatCreador: null,
      metodo: 'qr',
      numeroVincular: null,
      avisar,
    }).catch((e) => console.log(`Error reconectando subbot ${id}:`, e))
  }

  guardarRegistro(registro)
}

module.exports = {
  crearSubbot,
  listarSubbots,
  eliminarSubbot,
  reconectarSubbotsGuardados,
}