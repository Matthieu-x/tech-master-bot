/**
 * lib/reacciones-data.js
 * -------------------------------------------------------
 * Solo datos (sin lógica), compartidos entre:
 *   - plugins/reacciones.js  (comando visible que lista las reacciones)
 *   - plugins/reaccion.js    (comandos ocultos que disparan cada gif)
 * -------------------------------------------------------
 */

const REACCIONES_SOLO = {
  happy: { emoji: '😄', texto: 'está feliz' },
  cry: { emoji: '😢', texto: 'está llorando' },
  dance: { emoji: '💃', texto: 'está bailando' },
  blush: { emoji: '😳', texto: 'se sonrojó' },
  smile: { emoji: '😊', texto: 'sonríe' },
  angry: { emoji: '😠', texto: 'está enojado/a' },
  sad: { emoji: '😞', texto: 'está triste' },
  facepalm: { emoji: '🤦', texto: 'se dio una palmada en la cara' },
  smug: { emoji: '😏', texto: 'se siente superior' },
  run: { emoji: '🏃', texto: 'salió corriendo' },
}

const REACCIONES_PAREJA = {
  hug: { emoji: '🤗', texto: 'abrazó a' },
  kiss: { emoji: '😘', texto: 'besó a' },
  pat: { emoji: '🖐️', texto: 'acarició a' },
  slap: { emoji: '✋', texto: 'abofeteó a' },
  punch: { emoji: '👊', texto: 'golpeó a' },
  kill: { emoji: '🔪', texto: 'asesinó a' },
  poke: { emoji: '👉', texto: 'picó a' },
  cuddle: { emoji: '🥰', texto: 'acurrucó a' },
  bite: { emoji: '😬', texto: 'mordió a' },
  highfive: { emoji: '🙌', texto: 'chocó los cinco con' },
  handhold: { emoji: '🤝', texto: 'tomó de la mano a' },
  tickle: { emoji: '🤣', texto: 'le hizo cosquillas a' },
  kick: { emoji: '🦵', texto: 'pateó a' },
  lick: { emoji: '👅', texto: 'lamió a' },
  wave: { emoji: '👋', texto: 'saludó a' },
  stare: { emoji: '👀', texto: 'miró fijamente a' },
  wink: { emoji: '😉', texto: 'le guiñó el ojo a' },
  feed: { emoji: '🍽️', texto: 'alimentó a' },
  nom: { emoji: '😋', texto: 'devoró a' },
}

module.exports = { REACCIONES_SOLO, REACCIONES_PAREJA }