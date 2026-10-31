// W1-3 es dueño de este archivo y de prisma/seed/data/** (catálogo completo con equipamiento, alias, etc.).
import { prisma } from "./db";
import { slugify } from "./slugify";

type SeedExercise = { name: string; measureType: "reps" | "duration" };

const exercises: SeedExercise[] = [
  // pecho
  { name: "Press de Banca", measureType: "reps" },
  { name: "Press Inclinado", measureType: "reps" },
  { name: "Press Declinado", measureType: "reps" },
  { name: "Aperturas con Mancuernas", measureType: "reps" },
  { name: "Fondos Pecho", measureType: "reps" },
  { name: "Lagartijas", measureType: "reps" },
  { name: "Lagartijas Inclinadas", measureType: "reps" },

  // espalda
  { name: "Dominadas", measureType: "reps" },
  { name: "Jalón al Pecho", measureType: "reps" },
  { name: "Remo con Barra", measureType: "reps" },
  { name: "Remo con Mancuerna", measureType: "reps" },
  { name: "Remo Sentado", measureType: "reps" },
  { name: "Pull Over", measureType: "reps" },
  { name: "Peso Muerto", measureType: "reps" },

  // hombros
  { name: "Press Militar", measureType: "reps" },
  { name: "Elevaciones Laterales", measureType: "reps" },
  { name: "Elevaciones Frontales", measureType: "reps" },
  { name: "Pájaros", measureType: "reps" },
  { name: "Arnold Press", measureType: "reps" },
  { name: "Face Pull", measureType: "reps" },

  // bíceps / antebrazo
  { name: "Curl de Bíceps", measureType: "reps" },
  { name: "Curl Martillo", measureType: "reps" },
  { name: "Curl Inverso", measureType: "reps" },
  { name: "Curl Concentrado", measureType: "reps" },
  { name: "Curl Inclinado", measureType: "reps" },
  { name: "Curl Predicador", measureType: "reps" },
  { name: "Farmer Carry", measureType: "duration" },

  // tríceps
  { name: "Press Francés", measureType: "reps" },
  { name: "Extensión de Tríceps en Polea", measureType: "reps" },
  { name: "Rompecráneos", measureType: "reps" },
  { name: "Fondos Tríceps", measureType: "reps" },
  { name: "Extensión por Encima de la Cabeza", measureType: "reps" },

  // piernas
  { name: "Sentadillas", measureType: "reps" },
  { name: "Sentadilla Frontal", measureType: "reps" },
  { name: "Prensa", measureType: "reps" },
  { name: "Zancadas", measureType: "reps" },
  { name: "Bulgarian Split Squat", measureType: "reps" },
  { name: "Peso Muerto Rumano", measureType: "reps" },
  { name: "Hip Thrust", measureType: "reps" },
  { name: "Curl Femoral", measureType: "reps" },
  { name: "Extensión de Cuádriceps", measureType: "reps" },
  { name: "Elevación de Gemelos", measureType: "reps" },
  { name: "Step Ups", measureType: "reps" },
  { name: "Buenos Días", measureType: "reps" },

  // core
  { name: "Abdominales", measureType: "reps" },
  { name: "Crunch", measureType: "reps" },
  { name: "Elevación de Piernas", measureType: "reps" },
  { name: "Russian Twists", measureType: "reps" },
  { name: "Ab Wheel", measureType: "reps" },
  { name: "Dead Bug", measureType: "reps" },
  { name: "Mountain Climbers", measureType: "duration" },
  { name: "Plancha", measureType: "duration" },
  { name: "Plancha Lateral", measureType: "duration" },
  { name: "Hollow Hold", measureType: "duration" },
  { name: "Wall Sit", measureType: "duration" },
  { name: "Superman Hold", measureType: "duration" },

  // cardio / conditioning
  { name: "Correr", measureType: "duration" },
  { name: "Trote en Cinta", measureType: "duration" },
  { name: "Bicicleta Fija", measureType: "duration" },
  { name: "Elíptico", measureType: "duration" },
  { name: "Soga", measureType: "duration" },
  { name: "Remo Ergométrico", measureType: "duration" },
  { name: "Air Bike", measureType: "duration" },
  { name: "Caminata Inclinada", measureType: "duration" },
  { name: "Burpees", measureType: "reps" },
  { name: "Jumping Jacks", measureType: "duration" },
  { name: "Box Jumps", measureType: "reps" },
  { name: "Battle Ropes", measureType: "duration" },
  { name: "Kettlebell Swings", measureType: "reps" },

  // movilidad
  { name: "Movilidad de Cadera", measureType: "duration" },
  { name: "Movilidad de Hombros", measureType: "duration" },
  { name: "Movilidad de Tobillos", measureType: "duration" },
  { name: "Estiramiento de Isquios", measureType: "duration" },
  { name: "Estiramiento de Cuádriceps", measureType: "duration" },
  { name: "Movilidad Torácica", measureType: "duration" },

  // full body extra
  { name: "Thrusters", measureType: "reps" },
  { name: "Clean and Press", measureType: "reps" },
  { name: "Snatch con Mancuerna", measureType: "reps" },
];

const exerciseMappings: Record<
  string,
  { muscleSlug: string; percentage: number }[]
> = {
  "Press de Banca": [
    { muscleSlug: "pecho", percentage: 70 },
    { muscleSlug: "triceps", percentage: 20 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  "Press Inclinado": [
    { muscleSlug: "pecho", percentage: 60 },
    { muscleSlug: "hombros", percentage: 20 },
    { muscleSlug: "triceps", percentage: 20 },
  ],
  "Press Declinado": [
    { muscleSlug: "pecho", percentage: 70 },
    { muscleSlug: "triceps", percentage: 20 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  "Aperturas con Mancuernas": [
    { muscleSlug: "pecho", percentage: 80 },
    { muscleSlug: "hombros", percentage: 20 },
  ],
  "Fondos Pecho": [
    { muscleSlug: "pecho", percentage: 55 },
    { muscleSlug: "triceps", percentage: 30 },
    { muscleSlug: "hombros", percentage: 15 },
  ],
  Lagartijas: [
    { muscleSlug: "pecho", percentage: 55 },
    { muscleSlug: "triceps", percentage: 25 },
    { muscleSlug: "hombros", percentage: 20 },
  ],
  "Lagartijas Inclinadas": [
    { muscleSlug: "pecho", percentage: 55 },
    { muscleSlug: "triceps", percentage: 25 },
    { muscleSlug: "hombros", percentage: 20 },
  ],
  Dominadas: [
    { muscleSlug: "espalda", percentage: 55 },
    { muscleSlug: "biceps", percentage: 25 },
    { muscleSlug: "antebrazo", percentage: 20 },
  ],
  "Jalón al Pecho": [
    { muscleSlug: "espalda", percentage: 60 },
    { muscleSlug: "biceps", percentage: 25 },
    { muscleSlug: "antebrazo", percentage: 15 },
  ],
  "Remo con Barra": [
    { muscleSlug: "espalda", percentage: 55 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "biceps", percentage: 15 },
    { muscleSlug: "lumbar", percentage: 10 },
  ],
  "Remo con Mancuerna": [
    { muscleSlug: "espalda", percentage: 55 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "biceps", percentage: 15 },
    { muscleSlug: "lumbar", percentage: 10 },
  ],
  "Remo Sentado": [
    { muscleSlug: "espalda", percentage: 60 },
    { muscleSlug: "biceps", percentage: 20 },
    { muscleSlug: "trapecio", percentage: 20 },
  ],
  "Pull Over": [
    { muscleSlug: "espalda", percentage: 60 },
    { muscleSlug: "pecho", percentage: 20 },
    { muscleSlug: "triceps", percentage: 20 },
  ],
  "Peso Muerto": [
    { muscleSlug: "espalda", percentage: 25 },
    { muscleSlug: "lumbar", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 20 },
    { muscleSlug: "trapecio", percentage: 15 },
  ],
  "Press Militar": [
    { muscleSlug: "hombros", percentage: 65 },
    { muscleSlug: "triceps", percentage: 25 },
    { muscleSlug: "trapecio", percentage: 10 },
  ],
  "Elevaciones Laterales": [
    { muscleSlug: "hombros", percentage: 85 },
    { muscleSlug: "trapecio", percentage: 15 },
  ],
  "Elevaciones Frontales": [
    { muscleSlug: "hombros", percentage: 85 },
    { muscleSlug: "trapecio", percentage: 15 },
  ],
  Pájaros: [
    { muscleSlug: "hombros", percentage: 70 },
    { muscleSlug: "trapecio", percentage: 30 },
  ],
  "Arnold Press": [
    { muscleSlug: "hombros", percentage: 60 },
    { muscleSlug: "triceps", percentage: 25 },
    { muscleSlug: "trapecio", percentage: 15 },
  ],
  "Face Pull": [
    { muscleSlug: "hombros", percentage: 40 },
    { muscleSlug: "trapecio", percentage: 35 },
    { muscleSlug: "espalda", percentage: 25 },
  ],
  "Curl de Bíceps": [
    { muscleSlug: "biceps", percentage: 85 },
    { muscleSlug: "antebrazo", percentage: 15 },
  ],
  "Curl Martillo": [
    { muscleSlug: "biceps", percentage: 55 },
    { muscleSlug: "antebrazo", percentage: 45 },
  ],
  "Curl Inverso": [
    { muscleSlug: "antebrazo", percentage: 70 },
    { muscleSlug: "biceps", percentage: 30 },
  ],
  "Curl Concentrado": [
    { muscleSlug: "biceps", percentage: 85 },
    { muscleSlug: "antebrazo", percentage: 15 },
  ],
  "Curl Inclinado": [
    { muscleSlug: "biceps", percentage: 85 },
    { muscleSlug: "antebrazo", percentage: 15 },
  ],
  "Curl Predicador": [
    { muscleSlug: "biceps", percentage: 80 },
    { muscleSlug: "antebrazo", percentage: 20 },
  ],
  "Farmer Carry": [
    { muscleSlug: "antebrazo", percentage: 35 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "abdominales", percentage: 15 },
    { muscleSlug: "oblicuos", percentage: 10 },
    { muscleSlug: "gluteos", percentage: 10 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  "Press Francés": [
    { muscleSlug: "triceps", percentage: 90 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  "Extensión de Tríceps en Polea": [
    { muscleSlug: "triceps", percentage: 90 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  Rompecráneos: [
    { muscleSlug: "triceps", percentage: 90 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  "Fondos Tríceps": [
    { muscleSlug: "triceps", percentage: 70 },
    { muscleSlug: "pecho", percentage: 20 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  "Extensión por Encima de la Cabeza": [
    { muscleSlug: "triceps", percentage: 90 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  Sentadillas: [
    { muscleSlug: "cuadriceps", percentage: 45 },
    { muscleSlug: "gluteos", percentage: 25 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "aductores", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 5 },
  ],
  "Sentadilla Frontal": [
    { muscleSlug: "cuadriceps", percentage: 50 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "abdominales", percentage: 15 },
    { muscleSlug: "aductores", percentage: 10 },
    { muscleSlug: "isquiotibiales", percentage: 5 },
  ],
  Prensa: [
    { muscleSlug: "cuadriceps", percentage: 55 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "aductores", percentage: 10 },
  ],
  Zancadas: [
    { muscleSlug: "cuadriceps", percentage: 35 },
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "isquiotibiales", percentage: 20 },
    { muscleSlug: "aductores", percentage: 10 },
    { muscleSlug: "gemelos", percentage: 5 },
  ],
  "Bulgarian Split Squat": [
    { muscleSlug: "cuadriceps", percentage: 35 },
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "isquiotibiales", percentage: 20 },
    { muscleSlug: "aductores", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 5 },
  ],
  "Peso Muerto Rumano": [
    { muscleSlug: "isquiotibiales", percentage: 40 },
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "lumbar", percentage: 15 },
    { muscleSlug: "espalda", percentage: 10 },
    { muscleSlug: "antebrazo", percentage: 5 },
  ],
  "Hip Thrust": [
    { muscleSlug: "gluteos", percentage: 65 },
    { muscleSlug: "isquiotibiales", percentage: 20 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "cuadriceps", percentage: 5 },
  ],
  "Curl Femoral": [
    { muscleSlug: "isquiotibiales", percentage: 85 },
    { muscleSlug: "gemelos", percentage: 15 },
  ],
  "Extensión de Cuádriceps": [
    { muscleSlug: "cuadriceps", percentage: 90 },
    { muscleSlug: "aductores", percentage: 10 },
  ],
  "Elevación de Gemelos": [
    { muscleSlug: "gemelos", percentage: 90 },
    { muscleSlug: "isquiotibiales", percentage: 10 },
  ],
  "Step Ups": [
    { muscleSlug: "cuadriceps", percentage: 35 },
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "gemelos", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
  ],
  "Buenos Días": [
    { muscleSlug: "isquiotibiales", percentage: 35 },
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "lumbar", percentage: 20 },
    { muscleSlug: "espalda", percentage: 15 },
  ],
  Abdominales: [
    { muscleSlug: "abdominales", percentage: 80 },
    { muscleSlug: "oblicuos", percentage: 20 },
  ],
  Crunch: [
    { muscleSlug: "abdominales", percentage: 80 },
    { muscleSlug: "oblicuos", percentage: 20 },
  ],
  "Elevación de Piernas": [
    { muscleSlug: "abdominales", percentage: 65 },
    { muscleSlug: "oblicuos", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
  ],
  "Russian Twists": [
    { muscleSlug: "oblicuos", percentage: 55 },
    { muscleSlug: "abdominales", percentage: 35 },
    { muscleSlug: "antebrazo", percentage: 10 },
  ],
  "Ab Wheel": [
    { muscleSlug: "abdominales", percentage: 50 },
    { muscleSlug: "oblicuos", percentage: 20 },
    { muscleSlug: "lumbar", percentage: 15 },
    { muscleSlug: "hombros", percentage: 15 },
  ],
  "Dead Bug": [
    { muscleSlug: "abdominales", percentage: 55 },
    { muscleSlug: "oblicuos", percentage: 25 },
    { muscleSlug: "gluteos", percentage: 20 },
  ],
  "Mountain Climbers": [
    { muscleSlug: "abdominales", percentage: 35 },
    { muscleSlug: "oblicuos", percentage: 20 },
    { muscleSlug: "hombros", percentage: 15 },
    { muscleSlug: "cuadriceps", percentage: 15 },
    { muscleSlug: "pecho", percentage: 15 },
  ],
  Plancha: [
    { muscleSlug: "abdominales", percentage: 45 },
    { muscleSlug: "oblicuos", percentage: 20 },
    { muscleSlug: "hombros", percentage: 15 },
    { muscleSlug: "gluteos", percentage: 10 },
    { muscleSlug: "lumbar", percentage: 10 },
  ],
  "Plancha Lateral": [
    { muscleSlug: "oblicuos", percentage: 45 },
    { muscleSlug: "abdominales", percentage: 25 },
    { muscleSlug: "hombros", percentage: 15 },
    { muscleSlug: "gluteos", percentage: 10 },
    { muscleSlug: "lumbar", percentage: 5 },
  ],
  "Hollow Hold": [
    { muscleSlug: "abdominales", percentage: 55 },
    { muscleSlug: "oblicuos", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
    { muscleSlug: "lumbar", percentage: 10 },
  ],
  "Wall Sit": [
    { muscleSlug: "cuadriceps", percentage: 55 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 10 },
    { muscleSlug: "gemelos", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 5 },
  ],
  "Superman Hold": [
    { muscleSlug: "lumbar", percentage: 45 },
    { muscleSlug: "espalda", percentage: 25 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "trapecio", percentage: 10 },
  ],
  Correr: [
    { muscleSlug: "cuadriceps", percentage: 30 },
    { muscleSlug: "gemelos", percentage: 25 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 10 },
  ],
  "Trote en Cinta": [
    { muscleSlug: "cuadriceps", percentage: 30 },
    { muscleSlug: "gemelos", percentage: 25 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 10 },
  ],
  "Bicicleta Fija": [
    { muscleSlug: "cuadriceps", percentage: 35 },
    { muscleSlug: "gluteos", percentage: 25 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "gemelos", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 10 },
  ],
  Elíptico: [
    { muscleSlug: "cuadriceps", percentage: 25 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "gemelos", percentage: 10 },
    { muscleSlug: "hombros", percentage: 15 },
    { muscleSlug: "espalda", percentage: 15 },
  ],
  Soga: [
    { muscleSlug: "gemelos", percentage: 35 },
    { muscleSlug: "cuadriceps", percentage: 20 },
    { muscleSlug: "hombros", percentage: 15 },
    { muscleSlug: "antebrazo", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "gluteos", percentage: 10 },
  ],
  "Remo Ergométrico": [
    { muscleSlug: "espalda", percentage: 30 },
    { muscleSlug: "cuadriceps", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
    { muscleSlug: "biceps", percentage: 15 },
    { muscleSlug: "trapecio", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
  ],
  "Air Bike": [
    { muscleSlug: "cuadriceps", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
    { muscleSlug: "hombros", percentage: 20 },
    { muscleSlug: "pecho", percentage: 10 },
    { muscleSlug: "espalda", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "gemelos", percentage: 10 },
  ],
  "Caminata Inclinada": [
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "cuadriceps", percentage: 25 },
    { muscleSlug: "gemelos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 10 },
  ],
  Burpees: [
    { muscleSlug: "pecho", percentage: 15 },
    { muscleSlug: "hombros", percentage: 15 },
    { muscleSlug: "triceps", percentage: 10 },
    { muscleSlug: "cuadriceps", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 15 },
    { muscleSlug: "gemelos", percentage: 10 },
  ],
  "Jumping Jacks": [
    { muscleSlug: "gemelos", percentage: 25 },
    { muscleSlug: "cuadriceps", percentage: 20 },
    { muscleSlug: "hombros", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "trapecio", percentage: 10 },
  ],
  "Box Jumps": [
    { muscleSlug: "cuadriceps", percentage: 35 },
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "gemelos", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 5 },
  ],
  "Battle Ropes": [
    { muscleSlug: "hombros", percentage: 30 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "antebrazo", percentage: 20 },
    { muscleSlug: "abdominales", percentage: 15 },
    { muscleSlug: "espalda", percentage: 15 },
  ],
  "Kettlebell Swings": [
    { muscleSlug: "gluteos", percentage: 30 },
    { muscleSlug: "isquiotibiales", percentage: 25 },
    { muscleSlug: "lumbar", percentage: 15 },
    { muscleSlug: "hombros", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "antebrazo", percentage: 10 },
  ],
  "Movilidad de Cadera": [
    { muscleSlug: "gluteos", percentage: 35 },
    { muscleSlug: "aductores", percentage: 25 },
    { muscleSlug: "isquiotibiales", percentage: 20 },
    { muscleSlug: "cuadriceps", percentage: 20 },
  ],
  "Movilidad de Hombros": [
    { muscleSlug: "hombros", percentage: 60 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "espalda", percentage: 20 },
  ],
  "Movilidad de Tobillos": [
    { muscleSlug: "gemelos", percentage: 60 },
    { muscleSlug: "cuadriceps", percentage: 20 },
    { muscleSlug: "isquiotibiales", percentage: 20 },
  ],
  "Estiramiento de Isquios": [
    { muscleSlug: "isquiotibiales", percentage: 80 },
    { muscleSlug: "lumbar", percentage: 20 },
  ],
  "Estiramiento de Cuádriceps": [
    { muscleSlug: "cuadriceps", percentage: 85 },
    { muscleSlug: "aductores", percentage: 15 },
  ],
  "Movilidad Torácica": [
    { muscleSlug: "espalda", percentage: 45 },
    { muscleSlug: "trapecio", percentage: 25 },
    { muscleSlug: "hombros", percentage: 20 },
    { muscleSlug: "lumbar", percentage: 10 },
  ],
  Thrusters: [
    { muscleSlug: "cuadriceps", percentage: 25 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "hombros", percentage: 25 },
    { muscleSlug: "triceps", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "pecho", percentage: 10 },
  ],
  "Clean and Press": [
    { muscleSlug: "hombros", percentage: 20 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 15 },
    { muscleSlug: "cuadriceps", percentage: 15 },
    { muscleSlug: "espalda", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "antebrazo", percentage: 10 },
  ],
  "Snatch con Mancuerna": [
    { muscleSlug: "hombros", percentage: 20 },
    { muscleSlug: "trapecio", percentage: 20 },
    { muscleSlug: "gluteos", percentage: 20 },
    { muscleSlug: "cuadriceps", percentage: 15 },
    { muscleSlug: "espalda", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 10 },
    { muscleSlug: "antebrazo", percentage: 5 },
  ],
};


/** Upsert por slug. Si la fila existe con el slug temporal de la migración (`tmp-<id>`), la encuentra por nombre. */
export async function seedExercises(): Promise<number> {
  const slugs = new Set<string>();
  for (const e of exercises) {
    const slug = slugify(e.name);
    if (slugs.has(slug)) throw new Error(`Slug de ejercicio duplicado: ${slug}`);
    slugs.add(slug);
    const existing = await prisma.exercise.findFirst({
      where: { OR: [{ slug }, { name: e.name }] },
      select: { id: true },
    });
    if (existing) {
      await prisma.exercise.update({ where: { id: existing.id }, data: { slug, name: e.name, measureType: e.measureType } });
    } else {
      await prisma.exercise.create({ data: { slug, name: e.name, measureType: e.measureType, equipment: "other" } });
    }
  }
  await syncExerciseMuscles();
  return exercises.length;
}

async function syncExerciseMuscles() {
  const muscleBySlug = new Map((await prisma.muscle.findMany()).map((m) => [m.slug, m]));
  const exerciseByName = new Map((await prisma.exercise.findMany()).map((e) => [e.name, e]));

  for (const [exerciseName, mapping] of Object.entries(exerciseMappings)) {
    const exercise = exerciseByName.get(exerciseName);
    if (!exercise) throw new Error(`Ejercicio no encontrado para el mapeo muscular: ${exerciseName}`);

    const total = mapping.reduce((sum, item) => sum + item.percentage, 0);
    if (total !== 100) throw new Error(`El ejercicio "${exerciseName}" no suma 100. Total actual: ${total}`);

    const rows = mapping.map((item) => {
      const muscle = muscleBySlug.get(item.muscleSlug);
      if (!muscle) throw new Error(`No existe el músculo "${item.muscleSlug}" para el ejercicio "${exerciseName}"`);
      return { exerciseId: exercise.id, muscleId: muscle.id, percentage: item.percentage };
    });
    await prisma.$transaction([
      prisma.exerciseMuscle.deleteMany({ where: { exerciseId: exercise.id } }),
      prisma.exerciseMuscle.createMany({ data: rows }),
    ]);
  }
}
