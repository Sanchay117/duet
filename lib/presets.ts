import type { Person } from "./types";

export type Preset = Omit<Person, "id" | "createdAt"> & { key: string; tagline: string; photoHue: string };

/** Fictional families, so judges can see Duet work in one click. */
export const PRESETS: Preset[] = [
  {
    key: "kamla",
    name: "Kamla",
    birthYear: 1951,
    hometown: "Lucknow, India",
    pronoun: "she",
    about:
      "She sang Mohammed Rafi songs while cooking and still hums them. Her favourite film was Guide. She was a school teacher for 30 years and made the best kheer at Diwali.",
    family: { loves: "Arijit Singh, Yeh Jawaani Hai Deewani, Zindagi Na Milegi Dobara", birthYear: 2001 },
    tagline: "Rafi in the kitchen, Guide at the cinema",
    photoHue: "#b4532a",
  },
  {
    key: "dorothy",
    name: "Dorothy",
    birthYear: 1942,
    hometown: "Memphis, Tennessee",
    pronoun: "she",
    about:
      "Dorothy sang in the church choir and loved Patsy Cline. She saw Roman Holiday three times at the picture house downtown. Worked as a telephone operator and loved to dance on Saturday nights.",
    family: { loves: "Taylor Swift, La La Land, Gilmore Girls", birthYear: 1997 },
    tagline: "Church choir, Patsy Cline, Saturday dances",
    photoHue: "#4d6a86",
  },
  {
    key: "ramon",
    name: "Ramón",
    birthYear: 1946,
    hometown: "Guadalajara, Mexico",
    pronoun: "he",
    about:
      "Ramón loved Pedro Infante films and played guitar at family parties. He still lights up at mariachi. He was a bus driver and a big football fan.",
    family: { loves: "Christian Nodal, Natalia Lafourcade, Luis Miguel: The Series", birthYear: 2004 },
    tagline: "Pedro Infante, mariachi, football",
    photoHue: "#5f7358",
  },
];
