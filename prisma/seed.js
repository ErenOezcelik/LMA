import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rules = [
  // Tradion rules
  {
    bucket: "tradion",
    ruleText: "E-Mails mit Bezug auf Wellpappe, Kartonagen, Verpackungen, Faltschachteln gehören zu Tradion",
    priority: 10,
  },
  {
    bucket: "tradion",
    ruleText: "Bestellungen und Anfragen für Papierverpackungen, Displays, Versandkartons gehören zu Tradion",
    priority: 10,
  },
  {
    bucket: "tradion",
    ruleText: "E-Mails von Kunden und Lieferanten die explizit den Verpackungsbereich betreffen",
    priority: 5,
  },

  // Staubfilter rules
  {
    bucket: "staubfilter",
    ruleText: "E-Mails mit Bezug auf Staubsaugerbeutel, Filterbeutel, Staubfilter, Mikrofiltervlies gehören zu Staubfilter",
    priority: 10,
  },
  {
    bucket: "staubfilter",
    ruleText: "Bestellungen und Anfragen für Staubsauger-Zubehör, Ersatzfilter, Haushaltsfilter gehören zu Staubfilter",
    priority: 10,
  },
  {
    bucket: "staubfilter",
    ruleText: "E-Mails die Staubsauger-Marken wie Miele, Bosch, Siemens im Kontext von Beuteln/Filtern erwähnen",
    priority: 5,
  },

  // Rest rules
  {
    bucket: "rest",
    ruleText: "Newsletter, Werbe-E-Mails, automatische Benachrichtigungen gehören zu Rest",
    priority: 5,
  },
  {
    bucket: "rest",
    ruleText: "Interne E-Mails zu HR, IT, Buchhaltung ohne direkten Geschäftsbezug gehören zu Rest",
    priority: 5,
  },
  {
    bucket: "rest",
    ruleText: "Wenn eine E-Mail beide Bereiche (Tradion und Staubfilter) betrifft, klassifiziere nach dem Hauptthema der E-Mail",
    priority: 15,
  },
];

async function seed() {
  console.log("Seeding classification rules...");

  for (const rule of rules) {
    await prisma.classificationRule.create({ data: rule });
  }

  // Ensure SyncStatus singleton exists
  await prisma.syncStatus.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log(`Seeded ${rules.length} classification rules`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
