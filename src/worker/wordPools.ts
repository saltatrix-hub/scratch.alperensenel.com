export type Difficulty = "easy" | "medium" | "hard" | "apocalypse" | "funny";

// All generated prompts contain exactly two whitespace-separated words.
// Hyphens keep familiar compound concepts such as "kara-delik" together.
const MODIFIERS = [
  "kırmızı", "mavi", "yeşil", "sarı", "mor", "turuncu", "pembe", "beyaz", "siyah", "gri",
  "altın", "gümüş", "bronz", "renkli", "parlak", "minik", "küçük", "büyük", "dev", "uzun",
  "kısa", "geniş", "dar", "yuvarlak", "kare", "üçgen", "eğri", "düz", "ince", "kalın",
  "hafif", "ağır", "hızlı", "yavaş", "hareketli", "durgun", "uçan", "yüzen", "zıplayan", "koşan",
  "dansçı", "şarkıcı", "uykulu", "neşeli", "üzgün", "şaşkın", "kızgın", "korkak", "cesur", "utangaç",
  "meraklı", "unutkan", "sakallı", "bıyıklı", "şapkalı", "gözlüklü", "pelerinli", "çizgili", "benekli", "tüylü",
  "dikenli", "kanatlı", "kuyruklu", "boynuzlu", "robotik", "mekanik", "elektrikli", "manyetik", "buzlu", "ateşli",
  "dumanlı", "köpüklü", "çamurlu", "karlı", "yağmurlu", "gölgeli", "ışıklı", "görünmez", "şeffaf", "ters",
  "kırık", "eriyen", "şişen", "kaçan", "kayıp", "gizemli", "sihirli", "perili", "uzaylı", "tarihî",
  "antik", "gelecekçi", "korsan", "kraliyet", "süper", "gizli", "yasaklı", "yalnız", "ikiz", "üçüz",
  "komik", "garip", "çılgın", "huysuz", "sevimli", "tehlikeli", "şanslı", "acemi", "usta", "efsanevi",
] as const;

const EASY_SUBJECTS = [
  "kedi", "köpek", "balık", "kuş", "tavşan", "fil", "zürafa", "aslan", "ayı", "kaplumbağa",
  "balon", "şemsiye", "bisiklet", "otobüs", "tren", "uçak", "gemi", "roket", "robot", "bebek",
  "öğretmen", "doktor", "aşçı", "futbolcu", "palyaço", "dondurma", "pizza", "pasta", "elma", "karpuz",
  "güneş", "ay", "yıldız", "bulut", "gökkuşağı", "ev", "kale", "okul", "park", "deniz",
  "araba", "kamyon", "traktör", "kayık", "helikopter", "sandalye", "masa", "yatak", "dolap", "lamba",
  "kitap", "kalem", "silgi", "çanta", "şişe", "bardak", "tabak", "kaşık", "çatal", "saat",
  "top", "uçurtma", "kaykay", "davul", "gitar", "piyano", "kamera", "telefon", "televizyon", "bilgisayar",
  "çiçek", "ağaç", "mantar", "dağ", "nehir", "göl", "köprü", "yol", "çadır", "bahçe",
  "arı", "kelebek", "ördek", "tavuk", "inek", "at", "koyun", "keçi", "maymun", "penguen",
  "şapka", "ayakkabı", "çorap", "ceket", "kazak", "taç", "anahtar", "merdiven", "kapı", "pencere",
] as const;

const MEDIUM_SUBJECTS = [
  "astronot", "dedektif", "korsan", "mucit", "sihirbaz", "arkeolog", "itfaiyeci", "heykeltıraş", "gezgin", "şef",
  "denizaltı", "zeplin", "teleferik", "vapur", "lokomotif", "ambulans", "buldozer", "karavan", "gondol", "planör",
  "bukalemun", "ahtapot", "panda", "dinozor", "baykuş", "kirpi", "rakun", "deve", "koala", "flamingo",
  "mikroskop", "teleskop", "pusula", "gramofon", "daktilo", "vantilatör", "dürbün", "megafon", "projektör", "jeneratör",
  "labirent", "yanardağ", "şelale", "buzdağı", "mağara", "vaha", "tapınak", "piramit", "deniz-feneri", "saat-kulesi",
  "hazine-sandığı", "zaman-makinesi", "uçan-halı", "perili-ev", "satranç-taşı", "müzik-kutusu", "kar-küresi", "oyuncak-tren", "rüzgâr-gülü", "asma-köprü",
  "akrobat", "balet", "cambaz", "marangoz", "terzi", "kaptan", "pilot", "dalgıç", "madenci", "çiftçi",
  "denizatı", "kılıçbalığı", "ornitorenk", "karınca", "yusufçuk", "papağan", "pelikan", "kanguru", "goril", "gergedan",
  "mancınık", "yel-değirmeni", "kum-saati", "ateş-kulesi", "göktaşı", "uydu", "kapsül", "paraşüt", "hamak", "salıncak",
  "orkestra", "lunapark", "karnaval", "tiyatro", "stadyum", "kütüphane", "müze", "laboratuvar", "gözlemevi", "tersane",
] as const;

const HARD_SUBJECTS = [
  "paradoks", "yerçekimi", "metamorfoz", "hologram", "rönesans", "demokrasi", "enflasyon", "arkeoloji", "biyolüminesans", "ekosistem",
  "fotosentez", "sismograf", "matruşka", "origami", "kaleydoskop", "metronom", "bumerang", "perspektif", "simetri", "yansıma",
  "kara-delik", "kuantum-bilgisayarı", "yapay-zekâ", "DNA-sarmalı", "buzul-çağı", "meteor-yağmuru", "güneş-tutulması", "domino-etkisi", "optik-illüzyon", "zaman-kapsülü",
  "Truva-atı", "İpek-Yolu", "Rosetta-Taşı", "Mona-Lisa", "Göbeklitepe", "Ayasofya", "Babil-Kulesi", "Tac-Mahal", "Stonehenge", "Kolezyum",
  "şifre-makinesi", "rüzgâr-türbini", "denizaltı-volkanı", "pusula-gülü", "gölge-oyunu", "satranç-matı", "sonsuz-merdiven", "Mobius-şeridi", "ses-dalgası", "ışık-prizması",
  "galaksi", "takımyıldız", "nebula", "yörünge", "atmosfer", "kromozom", "molekül", "atom", "fosil", "manyetizma",
  "adalet", "özgürlük", "sabır", "hafıza", "vicdan", "hayal", "zaman", "sessizlik", "tesadüf", "denge",
  "mimari", "astronomi", "mitoloji", "felsefe", "geometri", "kronoloji", "topoğrafya", "koreografi", "orkestrasyon", "kriptografi",
  "mühür", "parşömen", "obelisk", "mozaik", "fresk", "heykel", "amfitiyatro", "rasathane", "takvim", "harita",
  "solucan-deliği", "zaman-döngüsü", "paralel-evren", "kayıp-kıta", "yüzen-şehir", "yeraltı-şehri", "uzay-istasyonu", "antik-makine", "enerji-kalkanı", "robot-ordusu",
] as const;

const APOCALYPSE_SUBJECTS = [
  "zombi", "meteor", "yanardağ", "kıyamet", "sığınak", "mutant", "uzaylı", "robot", "dinozor", "ejderha",
  "kara-delik", "nükleer-kış", "meteor-yağmuru", "zombi-ordusu", "robot-sürüsü", "uzaylı-filotu", "lav-nehri", "kum-fırtınası", "buz-çağı", "güneş-patlaması",
  "tost-makinesi", "belediye-başkanı", "kargo-görevlisi", "apartman-yöneticisi", "trafik-polisi", "klima-satıcısı", "internet-paketi", "şarj-aleti", "kaçış-planı", "acil-toplantı",
  "uzay-gemisi", "zaman-makinesi", "son-otobüs", "son-pizza", "son-ağaç", "son-çaycı", "son-dondurmacı", "son-simitçi", "son-orkestra", "son-market",
  "dev-kedi", "dev-ördek", "dev-karınca", "dev-kaplumbağa", "dev-süpürge", "mutant-çiçek", "zombi-muhasebeci", "robot-penguen", "astronot-öğrenci", "ejderha-teknisyen",
  "uydu", "gezegen", "dünya", "Mars", "Ay", "Güneş", "roket", "kapsül", "istasyon", "koloni",
  "alarm", "siren", "jeneratör", "barikat", "gaz-maskesi", "konserve", "telsiz", "harita", "pusula", "meşale",
  "enkaz", "krater", "buzul", "çöl", "bataklık", "laboratuvar", "fabrika", "gökdelen", "köprü", "tünel",
  "kahraman", "kaçak", "mühendis", "tamirci", "pilot", "doktor", "kurye", "pazarcı", "çaycı", "piknikçi",
  "zaman-kapısı", "enerji-kalkanı", "savunma-kulesi", "yeraltı-sığınağı", "uçan-mahalle", "kayıp-uydu", "kaçan-yapay-zekâ", "gezegen-motoru", "kıyamet-takvimi", "dünya-fişi",
] as const;

const FUNNY_SUBJECTS = [
  "köpekbalığı", "zürafa", "penguen", "kapibara", "ahtapot", "tavuk", "inek", "keçi", "panda", "rakun",
  "kedi", "köpek", "fil", "aslan", "kurbağa", "balık", "lama", "tavşan", "timsah", "ördek",
  "korsan", "sihirbaz", "astronot", "vampir", "zombi", "ejderha", "dev", "şövalye", "dede", "nine",
  "tost", "terlik", "çaydanlık", "buzdolabı", "telefon", "masa", "lamba", "çorap", "patates", "soğan",
  "süpürge", "makarna", "turşu", "mayonez", "kavun", "lahana", "simit", "köfte", "mantı", "baklava",
  "belediye-başkanı", "trafik-polisi", "pizza-kuryesi", "matematik-öğretmeni", "düğün-fotoğrafçısı", "apartman-görevlisi", "otobüs-şoförü", "haber-spikeri", "mahalle-muhtarı", "internet-fenomeni",
  "market-arabası", "pazar-çantası", "sakız-balonu", "güneş-kremi", "çamaşır-makinesi", "asansör", "davul", "mikrofon", "uçurtma", "kaykay",
  "tavla", "selfie", "pilates", "halay", "karaoke", "piknik", "düğün", "sınav", "toplantı", "tatil",
  "uzaylı", "hayalet", "mumya", "tekboynuz", "denizkızı", "cüce", "peri", "canavar", "robot", "dinozor",
  "dişçi", "berber", "kasiyer", "hakem", "garson", "müdür", "komşu", "turist", "dedektif", "bodyguard",
] as const;

const SUBJECTS: Record<Difficulty, readonly string[]> = {
  easy: EASY_SUBJECTS,
  medium: MEDIUM_SUBJECTS,
  hard: HARD_SUBJECTS,
  apocalypse: APOCALYPSE_SUBJECTS,
  funny: FUNNY_SUBJECTS,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Kolay", medium: "Orta", hard: "Zor", apocalypse: "Kıyamet", funny: "Komik",
};

function validateTokens(label: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length || values.some((value) => !value || /\s/.test(value))) {
    throw new Error(`${label} havuzunda boşluk, boş değer veya mükerrer kayıt var.`);
  }
}

validateTokens("Niteleyici", MODIFIERS);
for (const difficulty of Object.keys(SUBJECTS) as Difficulty[]) validateTokens(DIFFICULTY_LABELS[difficulty], SUBJECTS[difficulty]);

export function wordPoolSize(difficulty: Difficulty): number {
  return MODIFIERS.length * SUBJECTS[difficulty].length;
}

export function wordAt(difficulty: Difficulty, index: number): string {
  const subjects = SUBJECTS[difficulty];
  const size = wordPoolSize(difficulty);
  const safe = ((index % size) + size) % size;
  const modifier = MODIFIERS[safe % MODIFIERS.length];
  const subject = subjects[Math.floor(safe / MODIFIERS.length) % subjects.length];
  return `${modifier} ${subject}`;
}

export function pickUniqueWord(difficulty: Difficulty, used: string[]): string {
  const size = wordPoolSize(difficulty);
  const usedSet = new Set(used);
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % size;
  for (let offset = 0; offset < size; offset += 1) {
    const candidate = wordAt(difficulty, random + offset);
    if (!usedSet.has(candidate)) return candidate;
  }
  throw new Error(`${DIFFICULTY_LABELS[difficulty]} kelime havuzu tükendi.`);
}
