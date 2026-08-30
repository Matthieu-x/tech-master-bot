/**
 * lib/banner.js
 * -------------------------------------------------------
 * Banner de terminal al arrancar el bot con estética
 * "tech/hacker" en verde, parecida al diseño gráfico del
 * proyecto (ASCII art + cajas con bordes + info del bot).
 *
 * Usa códigos ANSI directamente (sin dependencias externas
 * como chalk) para no tener que instalar nada nuevo.
 * -------------------------------------------------------
 */

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const VERDE = '\x1b[38;5;46m'      // verde brillante
const VERDE_OSCURO = '\x1b[38;5;22m' // verde apagado, para bordes
const GRIS = '\x1b[38;5;244m'
const BLANCO = '\x1b[97m'

function verde(t) { return `${VERDE}${t}${RESET}` }
function verdeOscuro(t) { return `${VERDE_OSCURO}${t}${RESET}` }
function gris(t) { return `${GRIS}${t}${RESET}` }
function blancoNegrita(t) { return `${BOLD}${BLANCO}${t}${RESET}` }

const ASCII_LOGO = [
  '████████╗███╗   ███╗██████╗ ',
  '╚══██╔══╝████╗ ████║██╔══██╗',
  '   ██║   ██╔████╔██║██████╔╝',
  '   ██║   ██║╚██╔╝██║██╔══██╗',
  '   ██║   ██║ ╚═╝ ██║██████╔╝',
  '   ╚═╝   ╚═╝     ╚═╝╚═════╝ ',
]

function quitarColor(texto) {
  return texto.replace(/\x1b\[[0-9;]*m/g, '')
}

function linea(ancho = 47) {
  return verdeOscuro('─'.repeat(ancho))
}

function caja(lineas, ancho = 47) {
  const top = verdeOscuro('╭' + '─'.repeat(ancho) + '╮')
  const bottom = verdeOscuro('╰' + '─'.repeat(ancho) + '╯')
  const cuerpo = lineas.map(l => {
    const visible = quitarColor(l)
    const relleno = Math.max(0, ancho - visible.length - 2)
    return verdeOscuro('│ ') + l + ' '.repeat(relleno) + verdeOscuro(' │')
  })
  return [top, ...cuerpo, bottom].join('\n')
}

/**
 * Imprime el banner de arranque.
 * @param {string} nombreBot
 * @param {string} version
 */
function mostrarBannerInicio(nombreBot = 'Tech Master Bot', version = '1.0.0') {
  console.log('')
  console.log(ASCII_LOGO.map(l => verde(l)).join('\n'))
  console.log('')
  console.log(
    caja([
      `${blancoNegrita(nombreBot.toUpperCase())}  ${gris('v' + version)}`,
      `${gris('Tu asistente inteligente en WhatsApp')}`,
      '',
      `${verde('●')} ${gris('Iniciando sistema...')}`,
    ])
  )
  console.log('')
}

/**
 * Imprime la caja de "conectado con éxito" (se usa cuando
 * la conexión abre correctamente, no solo al arrancar).
 * @param {string} nombreBot
 */
function mostrarConexionExitosa(nombreBot = 'Tech Master Bot') {
  const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' })
  console.log(
    caja([
      `${verde('●')} ${blancoNegrita(nombreBot)} ${verde('ONLINE')}`,
      `${gris('WhatsApp conectado correctamente')}`,
      `${gris(fecha)}`,
    ])
  )
  console.log(linea())
}

module.exports = { mostrarBannerInicio, mostrarConexionExitosa }
