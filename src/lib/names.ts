// Culturally authentic name pools for Filipino and Fil-Am male players
// Large arrays are dynamically and deterministically generated to guarantee at least 1000 unique entries each.

const BASE_FILIPINO_FIRST = [
  "Junmar", "Kiefer", "Jayson", "Thirdy", "Aldrin", "Calvin", "CJ", "Gabe",
  "Paul", "Robert", "Marc", "LA", "Chris", "Stanley", "Japeth", "Raymond",
  "Terrence", "Beau", "Alex", "Scottie", "Arwind", "Roger", "Baser", "Jio",
  "Matthew", "Von", "Kevin", "Jericho", "Shaun", "Rey", "Mark", "Vic",
  "Poy", "Troy", "Jerick", "Allein", "Mac", "Ramon", "Nonoy", "Mike",
  "Rhenz", "Kai", "Dwight", "Carl", "Justine", "Gelo", "Aljun", "Abu",
  "Jeron", "Jeric", "Almond", "Simon", "Ryan", "Arthur", "Ken", "Clint",
  "Dave", "Kyle", "Keanu", "Harvey", "Joaqui", "Ivan", "Anton", "Renzo",
  "Prince", "Kenji", "Jolo", "Kyt", "Ricci", "Encho", "Yancy", "Reynel",
  "Yousef", "Barkley", "Nard", "Gryann", "Raffy", "Larry", "Bryan", "JR",
  "Ronald", "Don", "Glenn", "JC", "Samboy", "Allan", "Benjie", "Jerry",
  "Alvin", "Nelson", "Bal", "Dondon", "Lordy", "Olsen", "Ronnie", "Hector",
  "Bogs", "Atoy", "Vergel", "Reynaldo", "Eduardo", "Danilo", "Rene", "Renato",
  "Marlon", "Elmer", "Noli", "Bong", "Chito", "Gerry", "Boyet", "Jojo",
  "Tito", "Vicente", "Dante", "Mon", "Pido", "Ariel", "Leo", "Franz", "Dindo",
  "Boy", "Roel", "Rudy", "Jimmy", "Manny", "Bongbong", "Ronaldo", "Wilfredo",
  "Alfredo", "Ernesto", "Romeo", "Jesus", "Joseph", "Michael", "John",
  "David", "James", "Peter", "Philip", "Stephen", "Andrew", "Jonathan",
  "Emmanuel", "Gabriel", "Rafael", "Joshua", "Daniel", "Rommel", "Joaquin",
  "Christian", "Adrian", "Angelo", "Francis", "Gerald", "Jeff", "Cyrus",
  "Jared", "Vince", "Paolo", "Patrick", "Gino", "Juan", "Pedro", "Manuel"
];

const FILIPINO_SECOND_NAMES_BASE = [
  "Paul", "John", "Mark", "Chris", "Dave", "James", "Jayson", "Marc", "Kevin", 
  "Christian", "Angelo", "Francis", "Gerald", "Jeff", "Jared", "Vince", "Paolo", 
  "Patrick", "Gino", "Juan", "Pedro", "Manuel", "Robert", "Stanley", "Japeth", 
  "Raymond", "Terrence", "Alex", "Scottie", "Arwind", "Roger", "Baser", "Jio", 
  "Matthew", "Von", "Kevin", "Jericho", "Shaun", "Rey", "Mark", "Vic", "Poy", 
  "Troy", "Jerick", "Allein", "Mac", "Ramon", "Nonoy", "Mike", "Antonio", "Miguel",
  "Luis", "Jose", "Gabriel", "Rafael", "Lucas", "Mateo", "Zachary", "Ethan"
];

const BASE_FILIPINO_SURNAMES = [
  "Reyes", "Santos", "Garcia", "Fajardo", "De Leon", "Castro", "Ravena", "Pogoy",
  "Erram", "Tenorio", "Aguilar", "Barroca", "Lassiter", "Cabagnot", "Standhardinger",
  "Thompson", "Norwood", "Yap", "Pingris", "Almazan", "Lee", "Pringle", "Wright",
  "Abueva", "Cruz", "Banchero", "Newsome", "Belo", "Tolentino", "Rosario", "Malonzo",
  "Oftana", "Perez", "Sangalang", "Jalalon", "David", "Pascual", "Guanzon", "Santiago",
  "Mendoza", "Flores", "Villanueva", "Bautista", "Ramos", "Aquino", "Torres",
  "Sarmiento", "Del Rosario", "Salazar", "Valenzuela", "Belmonte", "Dela Cruz",
  "Soriano", "Guerrero", "Castillo", "Pineda", "Dizon", "Mercado", "Alvarez",
  "Fernandez", "Gonzales", "Hernandez", "Lopez", "Rivera", "Valdez", "Gomez",
  "Bernardo", "Manalo", "Villamor", "Capinpin", "Lim", "Tan", "Chua", "Go",
  "Uy", "Co", "Sy", "Ong", "Dee", "Ang", "Dy", "Tiu", "Cojuangco", "Gaisano",
  "Gotianun", "Consunji", "Pangilinan", "Razon", "Sia", "Lucio", "Angara",
  "Cayetano", "Defensor", "Drilon", "Enrile", "Estrada", "Guingona", "Honasan",
  "Lacson", "Lapid", "Legarda", "Marcos", "Osmeña", "Pimentel", "Poe", "Recto",
  "Revilla", "Roxas", "Salonga", "Sotto", "Tañada", "Trillanes", "Villar",
  "Zubiri", "Cabahug", "Codinera", "Distrito", "Espino", "Gozum", "Hubalde",
  "Loyzaga", "Magsanoc", "Patrimonio", "Pumaren", "Realubit", "Saldana",
  "Saldaña", "Tangkay", "Vanguardia", "Vicente", "Abarrientos", "Acuna",
  "Adornado", "Arana", "Arellano", "Asistio", "Austria", "Bagio", "Bernabe",
  "Bugia", "Bulawan", "Calaguio", "Cardona", "Carino", "Cariaso", "Codinera",
  "Coquia", "Dalupan", "Dela Rosa", "Dillinger", "Duremdes", "Feihl", "Ferriols",
  "Gaco", "Helterbrand", "Hontiveros", "Ildefonso", "Intal", "Lanete", "Locsin",
  "Mamaril", "Meneses", "Paras", "Quirimit", "Ritualo", "Seigle", "Tallo"
];

const BASE_FILAM_FIRST = [
  "Jordan", "Christian", "Green", "Washington", "Clarkson", "Gabe", "Matthew",
  "Chris", "Alex", "Bobby", "Moala", "Sean", "Maverick", "Cliff", "Taylor",
  "DeAndre", "Tyler", "Justin", "Brandon", "Ethan", "Jeremy", "Zachary",
  "Remy", "Kamaka", "Sedrick", "Lawrence", "Jalen", "Malik", "Devin", "Klay",
  "Kaleb", "Draymond", "Marcus", "Kyrie", "Damian", "LaMelo", "Lonzo", "LiAngelo",
  "Austin", "Cole", "Donovan", "Aaron", "Jarrett", "Miles", "Jared", "Spencer",
  "Corey", "Derrick", "Terrence", "Reggie", "Andre", "Dwight", "Trevor", "DeMar",
  "Kyle", "Fred", "Pascal", "Serge", "OG", "Malachi", "Gary", "RJ", "Immanuel",
  "Julius", "Obi", "Mitchell", "Evan", "Darius", "Isaac", "Dean", "Cedi", "Caris",
  "Lamar", "Kevin", "Seth", "Joe", "Bruce", "Nic", "Cam", "Patty", "James",
  "Tyrese", "Buddy", "Myles", "Oshae", "Goga", "Terry", "Gordon", "Kelly",
  "Mason", "PJ", "Cody", "Bouknight", "Kai", "JT", "Nick", "Ish", "Zach",
  "Nikola", "Coby", "Patrick", "Javonte", "Ayo", "Tony", "Troy", "Matt", "Jason",
  "Ryan", "Luke", "Dylan", "Logan", "Connor", "Caleb", "Tre", "Trey", "Gavin",
  "Wyatt", "Colin", "Blake", "Chase", "Cole", "Hunter", "Brody", "Colton", "Cooper"
];

const AMERICAN_SECOND_NAMES_BASE = [
  "James", "Tyler", "Lee", "Michael", "Wayne", "Jordan", "Allen", "Ray", "Dean",
  "Scott", "Cole", "Hunter", "Austin", "Jaden", "Taylor", "Jayden", "Carter", "Chase",
  "Blake", "Grant", "Alexander", "Christopher", "Thomas", "Paul", "Matthew", "John"
];

const BASE_FILAM_SURNAMES = [
  "Clarkson", "Washington", "Standhardinger", "Banchero", "Newsome", "Wright",
  "Lassiter", "Pringle", "Holt", "Perkins", "Hodge", "Adams", "Croft", "Moore",
  "Green", "Tautuaa", "Ellis", "Harris", "Parks", "Williams", "Smith", "Johnson",
  "Brown", "Davis", "Jones", "Miller", "Wilson", "Taylor", "Thomas", "Anderson",
  "Jackson", "White", "Martin", "Lee", "Thompson", "Young", "King", "Scott",
  "Baker", "Nelson", "Hill", "Ramirez", "Campbell", "Mitchell", "Roberts",
  "Carter", "Phillips", "Evans", "Turner", "Parker", "Collins", "Edwards",
  "Stewart", "Morris", "Nguyen", "Murphy", "Rivera", "Cook", "Rogers", "Morgan",
  "Peterson", "Cooper", "Reed", "Bailey", "Bell", "Gomez", "Kelly", "Howard",
  "Ward", "Cox", "Diaz", "Richardson", "Wood", "Watson", "Brooks", "Bennett",
  "Gray", "James", "Hughes", "Price", "Myers", "Long", "Foster", "Sanders",
  "Ross", "Morales", "Powell", "Sullivan", "Russell", "Ortiz", "Jenkins",
  "Gutierrez", "Perry", "Butler", "Barnes", "Fisher", "Graham", "Griffin",
  "Hayes", "Henderson", "Hunter", "Jordan", "Kennedy", "Marshall", "Mason",
  "McDonald", "Murray", "O'Connor", "Olson", "Patterson", "Payne", "Pierce",
  "Porter", "Reynolds", "Rice", "Robinson", "Simmons", "Stone"
];

// Generates exactly limit distinct names deterministically
function generateUniqueNames(primary: string[], secondary: string[], limit: number = 1000): string[] {
  const set = new Set<string>(primary);
  
  if (set.size >= limit) {
    return Array.from(set).slice(0, limit);
  }

  // Combine primary + secondary
  for (const p of primary) {
    for (const s of secondary) {
      if (p !== s) {
        set.add(`${p} ${s}`);
        if (set.size >= limit) {
          return Array.from(set);
        }
      }
    }
  }

  // Suffix fallback
  for (const p of primary) {
    set.add(`${p} Jr.`);
    set.add(`${p} III`);
    if (set.size >= limit) {
      return Array.from(set);
    }
  }

  return Array.from(set);
}

// Generates exactly limit distinct surnames deterministically
function generateUniqueSurnames(primary: string[], limit: number = 1000): string[] {
  const set = new Set<string>(primary);

  // Add prefix particles to base surnames
  const prefixes = ["De", "Del", "San", "De Castro", "De la", "De los"];
  for (const pref of prefixes) {
    for (const p of primary) {
      if (!p.startsWith("De") && !p.startsWith("Del") && !p.startsWith("San")) {
        set.add(`${pref} ${p}`);
        if (set.size >= limit) {
          return Array.from(set);
        }
      }
    }
  }

  // Add hyphenated surnames
  for (let i = 0; i < primary.length; i++) {
    for (let j = 0; j < primary.length; j++) {
      if (i !== j) {
        set.add(`${primary[i]}-${primary[j]}`);
        if (set.size >= limit) {
          return Array.from(set);
        }
      }
    }
  }

  return Array.from(set);
}

export const FILIPINO_FIRST_NAMES = generateUniqueNames(BASE_FILIPINO_FIRST, FILIPINO_SECOND_NAMES_BASE, 1000);
export const FILIPINO_SECOND_NAMES = generateUniqueNames(FILIPINO_SECOND_NAMES_BASE, BASE_FILIPINO_FIRST, 1000);
export const FILIPINO_SURNAMES = generateUniqueSurnames(BASE_FILIPINO_SURNAMES, 1000);

export const FILAM_FIRST_NAMES = generateUniqueNames(BASE_FILAM_FIRST, AMERICAN_SECOND_NAMES_BASE, 1000);
export const AMERICAN_SECOND_NAMES = generateUniqueNames(AMERICAN_SECOND_NAMES_BASE, BASE_FILAM_FIRST, 1000);
export const FILAM_SURNAMES = generateUniqueSurnames(BASE_FILAM_SURNAMES, 1000);
