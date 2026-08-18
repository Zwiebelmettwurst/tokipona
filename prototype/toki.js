// Offene Aufgaben: eine Frage auf toki pona, eine freie Antwort.
//
// Hier gibt es keine Musterlösung zum Abgleichen. Geprüft wird, was der
// Parser prüfen kann: Ist der Satz grammatisch, und trägt er das, wonach
// gefragt war — ein Objekt mit e, ein Ziel nach der Präposition, ein
// la-Vorfeld. Alles andere ist frei. Die Beispiele stehen erst danach da,
// als Vergleich, nicht als Vorgabe.
const TOKIPONA_TOKI = {
  // Beschriftung der geforderten Satzteile (die Rollen kommen aus dem Röntgen)
  needs: {
    object: { de: 'ein Objekt mit <b>e</b>', en: 'an object with <b>e</b>' },
    complement: { de: 'ein Ziel hinter der Präposition', en: 'a target after the preposition' },
    context: { de: 'ein Vorfeld mit <b>la</b>', en: 'a context with <b>la</b>' },
    subject: { de: 'ein Subjekt', en: 'a subject' },
    preverb: { de: 'ein Präverb wie <b>wile</b> oder <b>ken</b>', en: 'a preverb such as <b>wile</b> or <b>ken</b>' },
  },

  prompts: [
    { id: 'q01', stage: 1, tp: 'sina pona ala pona?',
      de: ['Geht es dir gut?'], en: ['Are you well?'], need: [],
      models: ['mi pona.', 'mi pona ala.', 'mi lape wile.'] },
    { id: 'q02', stage: 2, tp: 'sina jan seme?',
      de: ['Was für ein Mensch bist du?'], en: ['What kind of person are you?'], need: [],
      models: ['mi jan pona.', 'mi jan pi toki pona.', 'mi jan lili.'] },
    { id: 'q03', stage: 3, tp: 'sina moku e seme?',
      de: ['Was isst du?'], en: ['What do you eat?'], need: ['object'],
      models: ['mi moku e kili.', 'mi moku e telo.', 'mi moku e pan.'] },
    { id: 'q04', stage: 3, tp: 'sina lukin e seme?',
      de: ['Was siehst du?'], en: ['What do you see?'], need: ['object'],
      models: ['mi lukin e lipu.', 'mi lukin e soweli suli.'] },
    { id: 'q05', stage: 4, tp: 'sina pali e seme?',
      de: ['Was machst du?'], en: ['What are you making?'], need: ['object'],
      models: ['mi pali e tomo.', 'mi pali e moku pona.'] },
    { id: 'q06', stage: 5, tp: 'ijo seme li pona tawa sina?',
      de: ['Was magst du?'], en: ['What do you like?'], need: ['subject'],
      models: ['soweli li pona tawa mi.', 'kasi li pona tawa mi.', 'toki pona li pona tawa mi.'] },
    { id: 'q07', stage: 6, tp: 'sina lon seme?',
      de: ['Wo bist du?'], en: ['Where are you?'], need: ['complement'],
      models: ['mi lon tomo.', 'mi lon ma tomo.', 'mi lon poka pi jan pona mi.'] },
    { id: 'q08', stage: 6, tp: 'sina tawa seme?',
      de: ['Wohin gehst du?'], en: ['Where are you going?'], need: ['complement'],
      models: ['mi tawa tomo moku.', 'mi tawa ma ante.'] },
    { id: 'q09', stage: 7, tp: 'nimi sina li seme?',
      de: ['Wie heißt du?'], en: ['What is your name?'], need: [],
      models: ['mi jan Ana.', 'nimi mi li jan Mose.'] },
    { id: 'q10', stage: 7, tp: 'o toki e ijo pona!',
      de: ['Sag etwas Nettes!'], en: ['Say something kind!'], need: [],
      models: ['sina pona tawa mi.', 'tenpo sina li pona.'] },
    { id: 'q11', stage: 8, tp: 'kule seme li pona tawa sina?',
      de: ['Welche Farbe magst du?'], en: ['Which colour do you like?'], need: ['subject'],
      models: ['kule laso li pona tawa mi.', 'kule loje li pona tawa mi.'] },
    { id: 'q12', stage: 9, tp: 'tenpo pini la sina pali e seme?',
      de: ['Was hast du gemacht?'], en: ['What did you do?'], need: ['context', 'object'],
      models: ['tenpo pini la mi pali e lipu.', 'tenpo pini la mi moku e kili.'] },
    { id: 'q13', stage: 9, tp: 'sina jan pi pali seme?',
      de: ['Was für Arbeit machst du?'], en: ['What kind of work do you do?'], need: [],
      models: ['mi jan pi pali lipu.', 'mi jan pi pana sona.'] },
    { id: 'q14', stage: 10, tp: 'sina wile pali e seme?',
      de: ['Was willst du machen?'], en: ['What do you want to do?'], need: ['preverb', 'object'],
      models: ['mi wile pali e tomo.', 'mi wile moku e pan.'] },
    { id: 'q15', stage: 10, tp: 'tenpo kama la sina tawa seme?',
      de: ['Wohin gehst du demnächst?'], en: ['Where will you go?'], need: ['context', 'complement'],
      models: ['tenpo kama la mi tawa ma ante.', 'tenpo kama la mi tawa tomo pi jan pona mi.'] },
    { id: 'q16', stage: 11, tp: 'sina jo e ijo mute anu ijo lili?',
      de: ['Hast du viel oder wenig?'], en: ['Do you have much or little?'], need: ['object'],
      models: ['mi jo e ijo lili.', 'mi jo e lipu tu.'] },
  ],
};

if (typeof module !== 'undefined') { module.exports = TOKIPONA_TOKI; }
