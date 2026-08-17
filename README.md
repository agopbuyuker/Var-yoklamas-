# VAR Yoklaması

Türkiye'de her hafta futbol maçlarındaki tartışmalı pozisyonlar (penaltı, kırmızı kart, ofsayt, VAR kararları vb.) için halkın "Doğru" / "Yanlış" oyu verdiği bir oylama sitesi.

## Öne çıkan özellikler

- **Herkese açık oylama sayfası** — pozisyonlar haftaya göre gruplanır, her biri için canlı sonuç yüzdeleri gösterilir.
- **Tekrar oy vermeyi engelleme** — her ziyaretçiye tarayıcıda gizli bir kimlik (cookie) atanır; aynı pozisyona ikinci kez oy verilemez.
- **Şifre korumalı yönetim paneli** — pozisyon ekleme, düzenleme, silme; görsel (fotoğraf/GIF) yükleme.
- **Sıfır dış bağımlılık** — proje sadece Node.js'in kendi özellikleriyle (yerleşik `node:sqlite` veritabanı, yerleşik `fetch`/`FormData` ile dosya yükleme ayrıştırma) yazıldı. `npm install` çalıştırmanıza bile gerek yok. Bu, güvenlik yüzeyini küçültür, kurulumu basitleştirir ve neredeyse her ortamda (VPS, Docker, Render, Railway, Fly.io) sorunsuz çalışmasını sağlar.
- **Mobil uyumlu, koyu temalı arayüz.**

## Neden bu mimari?

Bu projeyi build ettiğim ortamda `npm` paket kayıt sunucusuna (registry.npmjs.org) erişim engelliydi, bu yüzden Next.js/React/Prisma gibi bir kurulum yerine Node.js'in (v22+) yerleşik özellikleriyle çalışan, hiç harici pakete ihtiyaç duymayan bir uygulama yazdım. Bunun sonucunda ortaya daha basit, daha az bakım gerektiren ve hemen her yerde çalışan bir sistem çıktı — isterseniz ileride React/Next.js gibi bir arayüze de taşınabilir, ama mevcut haliyle üretime almak için hiçbir ekstra kuruluma gerek yok.

## Gereksinimler

- **Node.js 22.5 veya üzeri** (yerleşik `node:sqlite` modülü için gerekli). `node -v` ile kontrol edin.

## Yerel çalıştırma

```bash
cd var-yoklamasi
cp .env.example .env
# .env dosyasını açıp ADMIN_PASSWORD ve SESSION_SECRET değerlerini değiştirin
node server.js
```

Sonra tarayıcıda `http://localhost:3000` adresini açın. Yönetim paneli: `http://localhost:3000/admin`.

Geliştirme sırasında dosya değişikliklerinde otomatik yeniden başlatma için:

```bash
npm run dev
```

## Ortam değişkenleri (.env)

| Değişken | Açıklama |
|---|---|
| `ADMIN_PASSWORD` | Yönetim paneline giriş şifresi. **Mutlaka güçlü bir şifre belirleyin.** |
| `SESSION_SECRET` | Uzun, rastgele bir metin. IP adreslerini geri döndürülemez şekilde karmalamak (hash) için kullanılır. |
| `PORT` | Sunucunun dinleyeceği port (varsayılan 3000). |
| `TRUST_HTTPS` | Uygulama HTTPS arkasında çalışıyorsa (Render, Railway, Fly.io gibi neredeyse tüm barındırma servislerinde durum budur) `true` yapın; böylece çerezler `Secure` işaretlenir. |
| `DATA_DIR` | Veritabanı ve görsellerin yazılacağı klasör. Boş bırakılırsa proje içindeki `./data` kullanılır. Render'daki kalıcı disk gibi belirli bir yola bağlamak isterseniz bu değişkeni kullanın (`render.yaml` içinde zaten `/var/data` olarak ayarlı). |

## Canlıya alma (deployment)

Uygulama görselleri ve veritabanını yerel diske (`data/` klasörü) yazar. Bu yüzden **kalıcı disk (persistent volume) destekleyen** bir barındırma servisi gerekir. Vercel/Netlify gibi "serverless" platformlar dosya sistemini her istekte sıfırladığı için **uygun değildir**.

### Seçenek A — Render.com (önerilen, ücretsiz katman mevcut, telefon tarayıcısından bile yapılabilir)

Projeye zaten bir `render.yaml` (Blueprint) dosyası eklendi; bu sayede Render tüm ayarları (başlatma komutu, kalıcı disk, ortam değişkenleri) otomatik okur, siz sadece şifreyi girip onaylarsınız.

**Adım 1 — Kodu GitHub'a yükleyin (komut satırı gerekmez):**
1. [github.com](https://github.com) adresinde ücretsiz bir hesap açın (yoksa) ve giriş yapın.
2. Sağ üstten "+" → "New repository" ile yeni, **Public veya Private** bir repo oluşturun (örn. `var-yoklamasi`). "Initialize with README" kutusunu **işaretlemeyin**.
3. Oluşan boş repo sayfasında "uploading an existing file" bağlantısına tıklayın.
4. Bu zip dosyasını telefonunuzda/bilgisayarınızda açın (unzip) ve içindeki **tüm dosya ve klasörleri** (server.js, lib/, public/, render.yaml, package.json, README.md, Dockerfile, .env.example, .gitignore, data/ klasörü içindeki .gitkeep) sürükleyip bırakın veya seçip yükleyin.
5. Alt kısımdaki "Commit changes" butonuna basın.

**Adım 2 — Render'da Blueprint ile deploy edin:**
1. [render.com](https://render.com) adresinde ücretsiz hesap açın, "GitHub ile devam et" seçeneğiyle giriş yapmanız en hızlısı.
2. Panelde "New +" → "Blueprint" seçin.
3. Az önce oluşturduğunuz `var-yoklamasi` reposunu seçin/bağlayın. Render, repodaki `render.yaml` dosyasını otomatik algılayacak.
4. Karşınıza çıkan formda sadece **`ADMIN_PASSWORD`** alanına güçlü bir şifre yazmanız yeterli — diğer her şey (kalıcı disk, gizli anahtar, HTTPS ayarı) otomatik ayarlanmış durumda.
5. "Apply" / "Deploy Blueprint" butonuna basın. 2-3 dakika içinde siteniz `https://var-yoklamasi-xxxx.onrender.com` gibi bir adreste yayında olur — bu linki WhatsApp'tan doğrudan paylaşabilirsiniz.

> Not: Render ücretsiz katmanda bir süre kullanılmayan servisler "uyku" moduna geçer ve ilk ziyarette birkaç saniye açılma gecikmesi olabilir. Bu, oylama deneyimini etkilemez, sadece ilk açılış biraz yavaş olur.

### Seçenek B — Railway / Fly.io

Aynı mantık geçerli: Node.js çalıştırın (`node server.js`), ortam değişkenlerini tanımlayın, `data/` klasörü için kalıcı bir volume bağlayın.

### Seçenek C — Kendi VPS'iniz + Docker

```bash
docker build -t var-yoklamasi .
docker run -d \
  --name var-yoklamasi \
  -p 3000:3000 \
  -e ADMIN_PASSWORD="guclu-sifre" \
  -e SESSION_SECRET="uzun-rastgele-metin" \
  -e TRUST_HTTPS="true" \
  -v var-yoklamasi-data:/app/data \
  --restart unless-stopped \
  var-yoklamasi
```

Domaininizi bağlamak ve HTTPS almak için önüne Nginx/Caddy ile bir ters proxy (reverse proxy) koymanız önerilir (örn. Caddy tek satırda otomatik HTTPS sağlar).

### Kendi alan adınızı bağlama

Render/Railway/Fly.io panelinden "Custom Domain" ekleyip DNS sağlayıcınızda CNAME kaydını yönlendirmeniz yeterli.

## Yönetim paneli kullanımı

1. `/admin` adresine gidin, `.env` dosyasındaki `ADMIN_PASSWORD` ile giriş yapın.
2. "Yeni Pozisyon Ekle" formunu doldurun:
   - **Başlık** — kısa özet (örn. "65. dakika penaltı beklentisi")
   - **Açıklama** — pozisyonun anlatımı
   - **Maç Bilgisi** — takımlar ve tarih
   - **Kategori** — Penaltı, Kırmızı Kart, Sarı Kart, Ofsayt, Faul, VAR Kararı, Diğer
   - **Hafta Etiketi** — pozisyonları gruplamak için (örn. "3. Hafta (14-17 Ağustos)"); aynı etiketi kullanan pozisyonlar anasayfada birlikte gösterilir
   - **Görsel** — isteğe bağlı, JPG/PNG/GIF/WEBP, maksimum 8MB
3. Mevcut pozisyonları aynı sayfanın altındaki tablodan düzenleyebilir veya silebilirsiniz.

## Oylama ve çoklu oy engelleme nasıl çalışır?

- İlk ziyarette tarayıcıya gizli, rastgele bir `voter_id` çerezi (cookie) atanır (1 yıl geçerli, sadece sunucu tarafından okunur).
- Bir pozisyona oy verildiğinde bu kimlik veritabanına kaydedilir; aynı kimlik aynı pozisyona ikinci kez oy veremez.
- Bu yöntem çoğu kullanıcı için yeterlidir, ancak **mükemmel bir sahtecilik engeli değildir** — biri tarayıcı verilerini (çerezleri) temizleyip tekrar oy verebilir. Daha güçlü bir koruma isterseniz (örn. telefon numarası doğrulama, e-posta ile tek seferlik giriş) ek bir kimlik doğrulama katmanı eklenmesi gerekir; bu, mevcut mimariye sonradan eklenebilir bir geliştirmedir.
- IP adresleri ham haliyle hiçbir yerde saklanmaz; sadece geri döndürülemez şekilde karmalanmış (hashed) hali kayıtlarda tutulur (ileride kötüye kullanım tespiti için).

## Veri yedekleme

Tüm veriler `data/app.db` (SQLite) dosyasında, görseller `data/uploads/` klasöründedir. Düzenli olarak bu `data/` klasörünü yedeklemeniz önerilir (örn. barındırma servisinizin sağladığı disk anlık görüntüsü/snapshot özelliğiyle, ya da basitçe dosyaları periyodik olarak indirerek).

## Özelleştirme fikirleri (ileride eklenebilir)

- Kategorileri değiştirmek için `lib/db.js` içindeki `CATEGORY_LABELS` nesnesini düzenleyin.
- Renkleri değiştirmek için `public/style.css` dosyasının en üstündeki `:root` değişkenlerini düzenleyin.
- Yorum/tartışma alanı, sosyal medyada paylaşım butonu, e-posta bültenine kayıt gibi özellikler eklenebilir.
- Çok sayıda eş zamanlı admin kullanıcısı gerekirse basit tek şifreli sistem yerine kullanıcı adı/şifre tablosu eklenebilir.

## Klasör yapısı

Proje bilinçli olarak **tek düz klasör** (alt klasörsüz) halinde tutuldu — GitHub'ın mobil tarayıcı yükleme ekranı klasör yapısını her zaman koruyamıyor; düz yapı bu yüzden telefondan yükleme yaparken sorun çıkarmıyor.

```
var-yoklamasi/
├── server.js       # Ana HTTP sunucusu ve tüm yönlendirmeler (routes)
├── db.js           # node:sqlite ile veritabanı katmanı
├── auth.js         # Yönetici oturum yönetimi
├── render.js       # Sunucu tarafında HTML üretimi
├── utils.js        # Cookie, hash, dosya adı yardımcıları
├── style.css       # Tüm görsel tasarım
├── app.js          # Oy verme için istemci tarafı JavaScript
├── data/           # Çalışma zamanında oluşur: veritabanı + yüklenen görseller
├── render.yaml      # Render Blueprint (otomatik deploy ayarları)
├── Dockerfile
├── .env.example
└── package.json
```
