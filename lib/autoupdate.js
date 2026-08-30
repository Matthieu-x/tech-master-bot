/**
 * lib/autoupdate.js
 * -------------------------------------------------------
 * Revisa el repositorio de git cada cierto tiempo (por
 * defecto 5 minutos). Si hay commits nuevos en el remoto:
 *   1. Hace git pull
 *   2. Si package.json cambió, corre npm install
 *   3. Reinicia el proceso (process.exit) para que tome el
 *      código nuevo -- esto SOLO funciona si el bot corre
 *      bajo PM2 con autorestart activado (el valor por
 *      defecto), ya que es PM2 quien lo vuelve a levantar.
 *
 * Requiere que la carpeta del proyecto sea un repo git válido
 * con un remoto configurado (origin) y una rama con upstream
 * (la que usas normalmente con git pull).
 * -------------------------------------------------------
 */

const { exec } = require('child_process')
const path = require('path')

const CARPETA_PROYECTO = path.join(__dirname, '..')

function ejecutar(comando) {
  return new Promise((resolve, reject) => {
    exec(comando, { cwd: CARPETA_PROYECTO, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve((stdout || '').trim())
    })
  })
}

async function revisarActualizaciones() {
  try {
    await ejecutar('git fetch')

    const local = await ejecutar('git rev-parse HEAD')
    const remoto = await ejecutar('git rev-parse @{u}')

    if (local === remoto) {
      console.log('ꕥ AutoUpdate: sin cambios nuevos.')
      return
    }

    console.log('ꕥ AutoUpdate: se encontraron cambios nuevos, actualizando...')

    // Detectamos si package.json cambia ENTRE el commit actual y el remoto,
    // para saber si hace falta reinstalar dependencias.
    const archivosCambiados = await ejecutar(`git diff --name-only ${local} ${remoto}`)
    const cambioPackageJson = archivosCambiados.split('\n').includes('package.json')

    const salidaPull = await ejecutar('git pull')
    console.log(`ꕥ AutoUpdate:\n${salidaPull}`)

    if (cambioPackageJson) {
      console.log('ꕥ AutoUpdate: package.json cambió, instalando dependencias nuevas...')
      await ejecutar('npm install')
    }

    console.log('ꕥ AutoUpdate: reiniciando el bot para aplicar los cambios...')
    // No cerramos la conexión a mano: simplemente terminamos el proceso.
    // PM2 (autorestart: true por defecto) lo vuelve a levantar de inmediato
    // ya con el código actualizado.
    process.exit(0)
  } catch (e) {
    console.log('ꕥ AutoUpdate: error revisando actualizaciones ->', e.message)
  }
}

/**
 * Inicia el ciclo de auto-actualización.
 * @param {number} minutos cada cuánto revisar (por defecto 5)
 */
function iniciarAutoUpdate(minutos = 5) {
  console.log(`ꕥ AutoUpdate activado (revisa cambios cada ${minutos} min).`)
  setInterval(revisarActualizaciones, minutos * 60 * 1000)
}

module.exports = { iniciarAutoUpdate }
