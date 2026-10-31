/**
 * Frases motivacionales de la home (portadas de el-bravo-prod, abril 2026). Una distinta en cada visita.
 */
export type Quote = { quote: string; author: string };

export const QUOTES: Quote[] = [
  { quote: "No cuentes los días, hacé que los días cuenten.", author: "Muhammad Ali" },
  { quote: "La fuerza no viene de la capacidad física, sino de una voluntad indomable.", author: "Mahatma Gandhi" },
  { quote: "El dolor es temporal, rendirse dura para siempre.", author: "Lance Armstrong" },
  { quote: "La diferencia entre lo imposible y lo posible está en la determinación.", author: "Tommy Lasorda" },
  { quote: "La excelencia no es un acto, sino un hábito.", author: "Aristóteles" },
  { quote: "Lo que hacés hoy puede mejorar todos tus mañanas.", author: "Ralph Marston" },
  { quote: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { quote: "La acción es la clave fundamental de todo éxito.", author: "Pablo Picasso" },
  { quote: "La energía y la persistencia conquistan todas las cosas.", author: "Benjamin Franklin" },
  { quote: "Nunca sabés qué tan fuerte sos hasta que ser fuerte es tu única opción.", author: "Bob Marley" },
  { quote: "Todo logro empieza con la decisión de intentarlo.", author: "John F. Kennedy" },
  { quote: "La calidad de tu vida depende de la calidad de tus hábitos.", author: "James Clear" },
  { quote: "Primero dominá tus hábitos, después tus hábitos te dominan a vos.", author: "John Dryden" },
  { quote: "Una meta sin plan es solo un deseo.", author: "Antoine de Saint-Exupéry" },
  { quote: "El trabajo duro vence al talento cuando el talento no trabaja duro.", author: "Tim Notke" },
  { quote: "La confianza viene de la preparación.", author: "Kobe Bryant" },
  { quote: "No pares cuando estés cansado, pará cuando hayas terminado.", author: "David Goggins" },
  { quote: "Los campeones siguen jugando hasta que les sale bien.", author: "Billie Jean King" },
  { quote: "No hay atajos para ningún lugar al que valga la pena llegar.", author: "Beverly Sills" },
  { quote: "La persistencia puede cambiar el fracaso en logro extraordinario.", author: "Matt Biondi" },
  { quote: "El éxito generalmente llega a quienes están demasiado ocupados para buscarlo.", author: "Henry David Thoreau" },
  { quote: "La disciplina es el puente entre metas y logros.", author: "Jim Rohn" },
  { quote: "El éxito no es definitivo, el fracaso no es fatal: lo que cuenta es el coraje para continuar.", author: "Winston Churchill" },
  { quote: "Actuá como si lo que hacés marcara la diferencia. Porque lo hace.", author: "William James" },
  { quote: "El único lugar donde el éxito viene antes que el trabajo es en el diccionario.", author: "Vidal Sassoon" },
  { quote: "La motivación es lo que te pone en marcha, el hábito es lo que hace que sigas.", author: "Jim Ryun" },
  { quote: "El futuro depende de lo que hagas hoy.", author: "Mahatma Gandhi" },
  { quote: "No podés poner límite a nada. Cuanto más soñás, más lejos llegás.", author: "Michael Phelps" },
  { quote: "Si algo está entre vos y tu éxito, movelo. Nunca te niegues.", author: "Dwayne Johnson" },
  { quote: "El dolor que sentís hoy es la fuerza que sentirás mañana.", author: "Arnold Schwarzenegger" },
  { quote: "La mente es todo. En lo que pensás te convertís.", author: "Buda" },
  { quote: "El esfuerzo continuo, no la fuerza o inteligencia, es la clave para desbloquear nuestro potencial.", author: "Winston Churchill" },
  { quote: "La vida es como andar en bicicleta. Para mantener el equilibrio, debés seguir moviéndote.", author: "Albert Einstein" },
  { quote: "Siempre parece imposible hasta que se hace.", author: "Nelson Mandela" },
  { quote: "No te limites. Muchas personas se limitan a lo que creen que pueden hacer.", author: "Mary Kay Ash" },
  { quote: "Haz lo que puedas, con lo que tengas, donde estés.", author: "Theodore Roosevelt" },
  { quote: "La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.", author: "Séneca" },
  { quote: "Cuanto más duro trabajo, más suerte tengo.", author: "Gary Player" },
  { quote: "La mejor forma de predecir el futuro es crearlo.", author: "Peter Drucker" },
  { quote: "Convertite en la persona que querés ser.", author: "Jim Rohn" },
  { quote: "La diferencia entre ganar y perder es muchas veces no rendirse.", author: "Walt Disney" },
  { quote: "El progreso es imposible sin cambio.", author: "George Bernard Shaw" },
  { quote: "No tengas miedo de fallar. Tené miedo de no intentarlo.", author: "Roy T. Bennett" },
  { quote: "Si querés algo que nunca tuviste, tenés que hacer algo que nunca hiciste.", author: "Thomas Jefferson" },
  { quote: "El éxito es ir de fracaso en fracaso sin perder el entusiasmo.", author: "Winston Churchill" },
  { quote: "El secreto para salir adelante es empezar.", author: "Mark Twain" },
  { quote: "La determinación de hoy crea el éxito de mañana.", author: "Anónimo (atribuida, uso común)" },
];

/** `rand` en [0, 1): se pasa de afuera para que el componente siga siendo puro. */
export function pickQuote(rand: number): Quote {
  return QUOTES[Math.min(QUOTES.length - 1, Math.floor(rand * QUOTES.length))];
}
