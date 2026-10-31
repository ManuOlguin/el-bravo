/**
 * "Novedades" (modal portado de el-bravo-prod). Al publicar una versión nueva: cambiar `CHANGELOG_VERSION`
 * y las secciones. El botón muestra un punto verde hasta que cada persona la abre (por dispositivo).
 */
export const CHANGELOG_VERSION = "v2 · Nov 2026";

export type ChangelogSection = { label: string; tone: "important" | "new" | "improved" | "fixed"; items: { title: string; desc: string }[] };

export const CHANGELOG: ChangelogSection[] = [
  {
    label: "Importante",
    tone: "important",
    items: [
      {
        title: "Empezamos de cero",
        desc: "La versión 2 arranca con una base nueva: hay que crear la cuenta otra vez, armar los grupos y volver a unirse.",
      },
    ],
  },
  {
    label: "Nuevo",
    tone: "new",
    items: [
      {
        title: "Puntos por constancia",
        desc: "Cada día que entrenás suma. Más tiempo suma más, pero cada vez menos (3 h no valen el triple que 1 h). Si hacés dos cosas el mismo día, se suman al tiempo del día. Cumplir la semana y las rachas dan bonus.",
      },
      {
        title: "Festejo al terminar",
        desc: "Después de cada entrenamiento: tus puntos, cómo te movés en el ranking de cada temporada, tu semana, récords e insignias, de a una pantalla.",
      },
      {
        title: "Modo en vivo",
        desc: "Empezá una rutina en el gimnasio y tachá series. Descanso con aviso (también con el celular bloqueado en Android), no se pierde si recargás y te avisa si te olvidaste de terminarlo.",
      },
      {
        title: "Amigos",
        desc: "Seguí a tus amigos, mirá sus entrenamientos con fotos y reaccioná.",
      },
      {
        title: "Temporadas más completas",
        desc: "Peso por tipo de actividad, premios al final y una pantalla de resultados con podio.",
      },
      {
        title: "Notificaciones y app instalable",
        desc: "Avisos en la app y en el celular. Instalala desde el navegador: Android → Instalar app; iPhone → Compartir → Agregar a inicio.",
      },
    ],
  },
  {
    label: "Mejorado",
    tone: "improved",
    items: [
      { title: "Stats nuevas", desc: "Objetivo semanal con puntos, rachas activas y perfectas, y minutos por día, horario y músculo." },
      { title: "78 ejercicios", desc: "Búsqueda más rápida (sin acentos y con errores de tipeo), imágenes y una explicación de cada uno." },
      { title: "Insignias con niveles", desc: "Bronce, Plata y Oro, y ves cuánto te falta para la próxima." },
      { title: "Diseño nuevo", desc: "Negro y verde por defecto; el tema azul (Leo Tema) sigue en Ajustes." },
    ],
  },
  {
    label: "Corregido",
    tone: "fixed",
    items: [
      { title: "Horarios corridos", desc: "Los entrenamientos ya no aparecen con 3 horas de diferencia." },
      { title: "Puntos al editar o borrar", desc: "Los puntos, las rachas y las insignias se recalculan siempre." },
    ],
  },
];
