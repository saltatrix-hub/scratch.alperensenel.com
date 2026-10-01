export type Difficulty = "easy" | "medium" | "hard" | "apocalypse" | "funny";

const EASY_SUBJECTS = [
  "kedi", "köpek", "balık", "kuş", "tavşan", "fil", "zürafa", "aslan", "ayı", "kaplumbağa",
  "balon", "şemsiye", "bisiklet", "otobüs", "tren", "uçak", "gemi", "roket", "robot", "bebek",
  "öğretmen", "doktor", "aşçı", "futbolcu", "palyaço", "dondurma", "pizza", "pasta", "elma", "karpuz",
  "güneş", "ay", "yıldız", "bulut", "gökkuşağı", "ev", "kale", "okul", "park", "deniz",
] as const;
const EASY_ACTIONS = [
  "uyuyor", "koşuyor", "zıplıyor", "gülüyor", "dans ediyor", "şarkı söylüyor", "yüzüyor", "uçuyor",
  "kitap okuyor", "top oynuyor", "resim çiziyor", "yemek yiyor", "saklanıyor", "el sallıyor", "kaykay sürüyor",
  "balon tutuyor", "fotoğraf çekiyor", "çiçek kokluyor", "yağmurdan kaçıyor", "piknik yapıyor", "pasta taşıyor",
  "kardan adam yapıyor", "kumdan kale yapıyor", "davul çalıyor", "uyanmaya çalışıyor",
] as const;
const EASY_PLACES = [
  "parkta", "evde", "okulda", "sahilde", "bahçede", "bulutların üstünde", "mutfakta", "otobüste",
  "ormanda", "karda", "yağmurda", "ay ışığında", "oyun alanında", "köprüde", "çatı katında",
] as const;

const MEDIUM_SUBJECTS = [
  "astronot", "dedektif", "korsan", "mucit", "sihirbaz", "arkeolog", "itfaiyeci", "heykeltıraş", "gezgin", "şef",
  "denizaltı", "zaman makinesi", "uçan halı", "perili ev", "hazine sandığı", "deniz feneri", "lunapark", "yanardağ",
  "bukalemun", "ahtapot", "penguen", "panda", "dinozor", "baykuş", "kirpi", "rakun", "deve", "koala",
  "satranç taşı", "mikroskop", "teleskop", "pusula", "gramofon", "daktilo", "çalar saat", "vantilatör", "vapur", "teleferik",
] as const;
const MEDIUM_ACTIONS = [
  "gizli harita arıyor", "köprü inşa ediyor", "fırtınayla savaşıyor", "yanlış kapıyı açıyor", "yarış kazanıyor",
  "laboratuvarda deney yapıyor", "hazineyi saklıyor", "kendi heykelini yapıyor", "gökyüzünü boyuyor", "robot tamir ediyor",
  "dev bir sandviç hazırlıyor", "gizemli mektup okuyor", "gölgesinden kaçıyor", "buzdan ev yapıyor", "uzaylıyla tanışıyor",
  "orkestra yönetiyor", "sihirli anahtar buluyor", "kaybolmuş treni durduruyor", "zamanı geri sarıyor", "hayaletle pazarlık yapıyor",
  "görünmez olmaya çalışıyor", "uçurtmayla yolculuk ediyor", "kayıp tacı buluyor", "rüyasında maraton koşuyor", "fenerle mağara geziyor",
] as const;
const MEDIUM_PLACES = [
  "terk edilmiş istasyonda", "uzay üssünde", "antik tapınakta", "buz mağarasında", "kalabalık pazarda", "denizin dibinde",
  "saat kulesinde", "gizli laboratuvarda", "uçan adada", "masal ormanında", "çölün ortasında", "müzenin çatısında",
  "fırtınalı limanda", "yeraltı şehrinde", "dev bir kütüphanede",
] as const;

const HARD_SUBJECTS = [
  "paradoks", "yerçekimi", "metamorfoz", "hologram", "labirent", "güneş tutulması", "rönesans", "demokrasi", "enflasyon", "arkeoloji",
  "biyolüminesans", "kara delik", "kuantum bilgisayarı", "yapay zekâ", "sismograf", "ekosistem", "fotosentez", "DNA sarmalı", "buzul çağı", "meteor yağmuru",
  "Truva atı", "İpek Yolu", "Rosetta Taşı", "Ayasofya", "Göbeklitepe", "Mona Lisa", "matruşka", "origami", "kaleydoskop", "metronom",
  "satranç matı", "domino etkisi", "bumerang", "gölge oyunu", "optik illüzyon", "pusula gülü", "zaman kapsülü", "şifre makinesi", "rüzgâr türbini", "denizaltı volkanı",
] as const;
const HARD_ACTIONS = [
  "neden-sonuç ilişkisini bozuyor", "iki farklı zamanı birleştiriyor", "kendi kopyasıyla tartışıyor", "imkânsız bir köprü kuruyor",
  "görünmeyen bir kuvveti ölçüyor", "tarihi yeniden yazıyor", "ışığı kavanoza hapsediyor", "ses dalgalarıyla kapı açıyor",
  "bir medeniyeti keşfediyor", "hafızasını haritaya dönüştürüyor", "gezegenlerin yerini değiştiriyor", "rüyaları arşivliyor",
  "gelecekten mesaj alıyor", "sonsuz merdiveni çıkıyor", "zaman döngüsünü kırıyor", "gölgesine yön tarif ediyor",
  "fırtınayı matematikle durduruyor", "kaybolan rengi arıyor", "yerçekimini tersine çeviriyor", "haritadaki ülkeyi katlıyor",
  "aynı anda iki yerde bulunuyor", "sıfırdan bir alfabe kuruyor", "duyguları terazide tartıyor", "geçmişe fotoğraf gönderiyor", "sessizliği kaydediyor",
] as const;
const HARD_CONTEXTS = [
  "tek çizgi kullanarak", "ayna görüntüsüyle", "kuş bakışı", "yalnızca geometrik şekillerle", "zaman tükenirken",
  "ters perspektifte", "minyatür bir dünyada", "devlerin gözünden", "bir gazete manşeti gibi", "antik bir duvar resmi olarak",
  "bilim kurgu afişinde", "müze vitrini içinde", "rüya ile gerçek arasında", "harita biçiminde", "siluet halinde",
] as const;

const APOCALYPSE_SUBJECTS = [
  "son çalışan tost makinesi", "Mars'taki belediye başkanı", "zombi muhasebeciler", "robot dinozor sürüsü", "kıyamet sonrası kargo görevlisi",
  "Ay'ı çalan dev kedi", "zamanda kaybolan dolmuş", "uzaylı apartman yöneticisi", "volkanın içindeki market", "dünyanın son çaycısı",
  "meteor avcısı penguen", "kara deliğe park eden minibüs", "nükleer kışta dondurmacı", "şehir büyüklüğünde ördek", "alarm veren piramit",
  "gezegen yiyen elektrik süpürgesi", "mutant çiçek ordusu", "güneşi şarj eden teknisyen", "zombi düğün konvoyu", "son internet paketini arayan astronot",
  "lav üstünde kamp yapan aile", "kıyamet sireni çalan horoz", "yerçekimsiz pazarcı", "dünyayı sırtlayan kaplumbağa", "meteor yağmurunda piknikçi",
  "buz çağında klima satıcısı", "uzay boşluğunda simitçi", "kaçan yapay zekâ", "Ay'a taşınan mahalle", "dinozorlarla toplantı yapan patron",
  "gezegeni tamir eden çocuk", "zaman makinesini kaçıran yolcu", "kıyamet gününde sınava giren öğrenci", "robotların son orkestrası", "gökdelen taşıyan karınca",
  "yanardağda çay demleyen ejderha", "uyduları kovalayan köpek", "son ağacı koruyan şövalye", "dünyanın fişini çeken bebek", "uzaylı istilasında trafik polisi",
] as const;
const APOCALYPSE_ACTIONS = [
  "insanlığı kurtarmaya çalışıyor", "yanlış düğmeye basıyor", "son bileti kapmaya çalışıyor", "acil durum toplantısı yapıyor", "kaçış planını kaybediyor",
  "gezegeni bantla onarıyor", "meteorla pazarlık ediyor", "zamanı beş dakika erteliyor", "son pizzayı paylaşıyor", "gizli sığınağı arıyor",
  "uzay gemisini iterek çalıştırıyor", "kıyameti canlı yayınlıyor", "robotlara halay öğretiyor", "Ay'a merdiven dayıyor", "yanardağı söndürmeye üflüyor",
  "dünyayı yeniden başlatıyor", "son şarj aletini koruyor", "geleceğe kargo gönderiyor", "meteorları raketle geri yolluyor", "uzaylılara yol tarifi veriyor",
  "zombilere CV hazırlıyor", "kara deliği tıkıyor", "gezegeni yanlış adrese teslim ediyor", "son otobüsü kaçırıyor", "kıyameti takvime yanlış yazıyor",
] as const;
const APOCALYPSE_CONTEXTS = [
  "sireni çalarken", "son on saniyede", "şehir tahliye edilirken", "Ay ikiye bölünmüşken", "elektrikler kesilmişken",
  "robotlar isyan etmişken", "yerçekimi durmuşken", "okyanuslar yükselirken", "gökyüzü yeşile dönmüşken", "zaman geriye akarken",
  "herkes donmuşken", "gezegen küçülürken", "uydular düşerken", "güneş sönerken", "haritalar değişirken",
] as const;

const FUNNY_SUBJECTS = [
  "köpek balığı", "zürafa", "penguen", "kapibara", "ahtapot", "tavuk", "inek", "keçi", "panda", "rakun",
  "huysuz kedi", "şaşkın köpek", "dansçı fil", "uykulu aslan", "gözlüklü kurbağa", "bıyıklı balık", "kravatlı lama", "pelerinli tavşan", "şapkalı timsah", "patenci ördek",
  "emekli korsan", "unutkan sihirbaz", "acemi astronot", "neşeli vampir", "vegan zombi", "utangaç ejderha", "kibar dev", "aceleci şövalye", "rapçi dede", "oyuncu nine",
  "konuşan tost", "kaçan terlik", "sinirli çaydanlık", "romantik buzdolabı", "dedikoducu telefon", "dans eden masa", "üzgün lamba", "meraklı çorap", "kahraman patates", "şarkıcı soğan",
] as const;
const FUNNY_ACTIONS = [
  "süpürge tutuyor", "selfie çekiyor", "halay çekiyor", "trafik cezası yazıyor", "pilates yapıyor", "dondurma satıyor", "kaykay sürüyor",
  "internetten yemek söylüyor", "saçını tarıyor", "çorap arıyor", "iş görüşmesine gidiyor", "düğünde pasta kaçırıyor", "gizlice dans ediyor",
  "yanlış otobüse biniyor", "mikrofonda türkü söylüyor", "kahvaltı hazırlıyor", "uçurtmaya tutunuyor", "komşudan şeker istiyor",
  "asansörde kalıyor", "pazar çantası taşıyor", "çamaşır asıyor", "yoga yapıyor", "pizza kuryeliği yapıyor", "sınavda kopya çekiyor",
  "sakız balonu şişiriyor", "uzaylıya çay ikram ediyor", "kardan adama güneş kremi sürüyor", "balık tutarken balığa yakalanıyor",
  "robotla tavla oynuyor", "gölgesine kızıyor", "dişçiden kaçıyor", "şemsiye yerine makarna açıyor", "telefonda annesiyle konuşuyor",
  "gizli ajan gibi yürüyor", "market arabasıyla yarışıyor", "kendi heykeline poz veriyor", "yanlışlıkla belediye başkanı oluyor",
  "pastanın içine saklanıyor", "davul çalarken uyuyor", "kediye matematik öğretiyor",
] as const;
const FUNNY_CONTEXTS = [
  "düğünde", "uzayda", "otobüs durağında", "banyoda", "müdür odasında", "Ay'ın üstünde", "süpermarkette", "trafikte",
  "lunaparkta", "aile toplantısında", "canlı yayında", "sınav salonunda", "spor salonunda", "dondurucuda", "apartman toplantısında",
] as const;

const CONFIG = {
  easy: [EASY_SUBJECTS, EASY_ACTIONS, EASY_PLACES],
  medium: [MEDIUM_SUBJECTS, MEDIUM_ACTIONS, MEDIUM_PLACES],
  hard: [HARD_SUBJECTS, HARD_ACTIONS, HARD_CONTEXTS],
  apocalypse: [APOCALYPSE_SUBJECTS, APOCALYPSE_ACTIONS, APOCALYPSE_CONTEXTS],
  funny: [FUNNY_SUBJECTS, FUNNY_ACTIONS, FUNNY_CONTEXTS],
} as const;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Kolay", medium: "Orta", hard: "Zor", apocalypse: "Kıyamet", funny: "Komik",
};

export function wordPoolSize(difficulty: Difficulty): number {
  const [subjects, actions, contexts] = CONFIG[difficulty];
  return subjects.length * actions.length * contexts.length;
}

export function wordAt(difficulty: Difficulty, index: number): string {
  const [subjects, actions, contexts] = CONFIG[difficulty];
  const safe = ((index % wordPoolSize(difficulty)) + wordPoolSize(difficulty)) % wordPoolSize(difficulty);
  const subject = subjects[safe % subjects.length];
  const action = actions[Math.floor(safe / subjects.length) % actions.length];
  const context = contexts[Math.floor(safe / (subjects.length * actions.length)) % contexts.length];
  return `${subject} ${action} ${context}`;
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
