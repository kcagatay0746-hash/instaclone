# Instaclone

Instagram benzeri, **sıfır bağımlılıklı** bir sosyal ağ uygulaması. Hiçbir paket indirmen
gerekmez: sunucu yalnızca Node.js'in yerleşik modüllerini (`node:http`, `node:sqlite`,
`node:crypto`), arayüz de saf HTML + CSS + JavaScript (ES Modülleri) kullanır.

## Hızlı başlangıç

**En kolay yol — tek tıkla aç:** indirdiğin klasörde işletim sistemine göre şu dosyaya çift tıkla:

| İşletim sistemi | Açılacak dosya |
| --- | --- |
| Windows | **`BASLAT-Windows.bat`** |
| macOS | **`BASLAT-Mac.command`** (ilk seferde dosyaya **sağ tık → Aç**) |
| Linux | **`BASLAT-Linux.sh`** (çift tık veya terminalde `./BASLAT-Linux.sh`) |

Bu dosya sunucuyu başlatır ve tarayıcıyı otomatik olarak `http://localhost:3000` adresinde
açar. Açılan terminal/sunucu penceresini kapatma; uygulamayı durdurmak için o pencereyi kapat
(veya Ctrl+C).

**Terminalden:**

```bash
node server.js          # ya da: npm start
# → http://localhost:3000
```

> `public/index.html` dosyasına çift tıklayarak açmayın: uygulama API'si için sunucunun
> çalışıyor olması gerekir. Her zaman yukarıdaki başlatıcıyı veya `node server.js` kullan.

İlk çalıştırmada `data/app.db` (SQLite) oluşur ve içi demo içerikle doldurulur.

### Uygulama olarak çalıştır / kur

Bu proje bir web sitesi değil, **kurulabilir bir uygulama** olarak da çalışır:

**Masaüstü (kendi penceresi, tarayıcı sekmesi yok)**

```bash
npm run app
```

Sunucuyu başlatır ve Chrome/Edge/Brave varsa `--app` modunda ayrı bir uygulama
penceresinde açar (kendi görev çubuğu simgesiyle). Tarayıcı bulunamazsa varsayılan
tarayıcıya düşer.

**Telefon / masaüstü kurulumu (PWA)**

Uygulamayı açtıktan sonra:

- **Chrome/Edge (masaüstü):** adres çubuğunun sağındaki **Yükle** (⊕) simgesine bas.
- **Android Chrome:** menü → **Uygulamayı yükle / Ana ekrana ekle**.
- **iPhone/iPad (Safari):** Paylaş → **Ana Ekrana Ekle**.

Kurulduktan sonra ana ekranda kendi ikonuyla açılır, tam ekran (standalone) çalışır ve
service worker sayesinde çevrimdışıyken de kabuk + son görüntülenen içerik açılır.

> Not: Mağazaya yüklenecek gerçek bir `.exe` / `.apk` paketi için Electron veya Capacitor
> gibi bir paketleyici gerekir; bu proje “hiçbir şey indirmeden” çalışsın diye PWA +
> masaüstü başlatıcı yaklaşımını kullanır.

**Demo hesapları** (şifre hepsi için `demo1234`):

| kullanıcı | profil |
| --- | --- |
| `ayse` | fotoğraf / İstanbul |
| `mehmet` | dağ, kahve, kod |
| `zeynep` | tasarım & illüstrasyon |
| `can` | sokak lezzetleri |
| `elif` | koşu & gün doğumu |
| `deniz` | müzik & plaklar |

## Neler var?

- **Kimlik doğrulama** – kayıt, giriş, çıkış; scrypt ile şifre özeti, HttpOnly + SameSite
  çerezli oturumlar, IP bazlı hız sınırı.
- **Akış** – takip ettiğin kişilerin gönderileri, sonsuz kaydırma, çift dokunuşla beğeni,
  kalp animasyonu, yorum önizlemeleri.
- **Gönderi oluşturma** – sürükle-bırak veya dosya seçimi, kare kırpma, yakınlaştırma,
  10 fotoğraf filtresi, açıklama + konum, hashtag ve @bahsetme algılama.
- **Hikayeler** – 24 saatlik hikayeler, ilerleme çubukları, dokun/basılı tut kontrolleri,
  hikayeye DM ile yanıt verme, kendi hikayeni silme.
- **Keşfet** – beğeni sayısına göre sıralanan grid, sonsuz kaydırma.
- **Arama** – kullanıcı adı/ad arama, hashtag sonuçları, son aramalar.
- **Profil** – takipçi/takip listeleri, takip et/bırak, mesaj gönderme, gönderi ızgarası,
  kaydedilenler sekmesi, profil düzenleme (avatar yükleme dahil).
- **Beğeni, yorum, kaydetme** – yorum silme yetkisi (yorum sahibi veya gönderi sahibi).
- **Bildirimler** – beğeni, yorum, takip, bahsetme; okundu işaretleme ve canlı rozetler.
- **Doğrudan mesajlar** – konuşma listesi, okundu bilgisi, canlı (SSE) mesaj akışı.
- **Reels / video** – MP4/WebM yükleme (en fazla 25 MB, 2 dk), videodan otomatik kapak
  karesi, tam ekran kaydırmalı Reels akışı (otomatik oynatma + ses düğmesi), görüntülenme
  sayacı, profil ve ızgaralarda ▶️ video rozeti.
- **Sesli & görüntülü arama** – gerçek WebRTC görüşmesi (medya uçtan uca akar, sunucu yalnızca
  SDP sinyalleşmesini yapar), gelen arama ekranı, yanıtla/reddet, mikrofon ve kamera kapatma,
  süre sayacı, arama geçmişi sohbet içinde kayıt olarak görünür.
- **Kişi ekle** – “Seni takip ediyor” listesinden tek dokunuşla geri takip, öneriler,
  kullanıcı arama.
- **Hashtag sayfaları**, **kaydedilenler**, **koyu/açık tema**, **klavye kısayolları**,
  mobil alt menü ve masaüstü kenar çubuğu.

### Arama nasıl denenir?

Sesli/görüntülü arama tarayıcıların kamera-mikrofon iznini ve `localhost` (veya HTTPS)
üzerinden açılmasını gerektirir.

1. Uygulamayı aç (`http://localhost:3000`).
2. Aynı bilgisayarda **iki ayrı tarayıcı penceresi/sekmesi** aç, birinde `ayse`, diğerinde
   `mehmet` ile giriş yap (ya da iki farklı profil).
3. Mesajlar → kişiyi seç → üstteki **📞** veya **🎥** düğmesine bas. Diğer pencerede gelen
   arama ekranı çıkar; **Yanıtla** dediğinde görüşme başlar.

Notlar:
- Aynı makinede/LAN’da çalışır. Farklı ağlardaki kullanıcılar için TURN sunucusu gerekir
  (`components/call.js` içindeki `RTC_CONFIG`e eklenebilir).
- Kamera/mikrofon izni reddedilirse görüşme başlamaz; tarayıcı adres çubuğundan izin ver.
- Arama sırasında sunucu kapalıysa zil sesi/sinyal iletilemez.

## Yapı

```
BASLAT-Windows.bat     Windows tek tık başlatıcı
BASLAT-Mac.command     macOS tek tık başlatıcı
BASLAT-Linux.sh        Linux başlatıcı
server.js              HTTP sunucusu, yönlendirme, statik dosyalar, güvenlik başlıkları
src/db.js              SQLite şeması (node:sqlite)
src/core.js            ortak yardımcılar: yönlendirme kaydı, SSE, görsel kaydetme, bildirim
src/routes-*.js        API uç noktaları (auth, feed, posts, comments, users, stories,
                       notifications, messages)
src/seed.js + seed-art.js   demo kullanıcılar, gönderiler, hikayeler, SVG görseller
src/http-util.js       gövde okuma, dosya sunumu, MIME/CSP başlıkları
public/index.html      SPA iskeleti
public/manifest.webmanifest  PWA manifesti (kurulabilir uygulama)
public/sw.js           service worker: uygulama kabuğu + çevrimdışı önbellek
public/img/icon-*.png  uygulama ikonları (tools/make-icons.js ile üretilir)
tools/launch-app.js    masaüstü başlatıcı (npm run app)
public/css/*.css       tema değişkenleri, bileşenler, görünümler
public/js/app.js       yönlendirici + oturum + canlı olaylar
public/js/views/*.js   ekranlar: akış, keşfet, arama, profil, gönderi, mesajlar, ...
public/js/components/*.js  yeniden kullanılan parçalar (post kartı, detay, grid, menü)
test/                  API entegrasyon testleri + DOM tabanlı arayüz testleri
```

## API (özet)

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| POST | `/api/register` · `/api/login` · `/api/logout` | oturum işlemleri |
| GET | `/api/me` | oturum + okunmamış sayıları |
| PATCH | `/api/me` | ad, biyografi, avatar |
| GET | `/api/feed?before=` | akış (imleç tabanlı) |
| GET | `/api/explore?offset=` | keşfet |
| GET | `/api/reels?offset=` | tam ekran Reels akışı |
| POST | `/api/posts/:id/view` | tekil görüntülenme sayacı |
| GET | `/api/people/follows-me` | seni takip edenler (geri takip) |
| GET | `/api/saved` | kaydedilenler |
| GET | `/api/search?q=` | kullanıcı + hashtag arama |
| GET | `/api/tags/:tag` | hashtag gönderileri |
| GET | `/api/suggestions` | takip önerileri |
| POST/GET/DELETE | `/api/posts[/:id]` | gönderi oluştur/oku/sil |
| POST/DELETE | `/api/posts/:id/like` · `/save` | beğeni ve kaydetme |
| GET/POST | `/api/posts/:id/comments` | yorumlar |
| DELETE | `/api/comments/:id` | yorum sil |
| GET | `/api/users/:username` · `/posts` · `/followers` · `/following` | profil |
| POST/DELETE | `/api/users/:username/follow` | takip |
| GET/POST | `/api/stories` · `/api/stories/:id/view` · DELETE `/api/stories/:id` | hikayeler |
| GET/POST | `/api/notifications` · `/api/notifications/read` | bildirimler |
| GET/POST | `/api/messages[/:username]` | DM |
| GET | `/api/events` | SSE: canlı bildirim + mesaj + arama sinyalleri |
| POST | `/api/calls` · `/:id/answer` · `/:id/decline` · `/:id/end` | WebRTC sinyalleşmesi |
| GET | `/api/calls/history` | arama geçmişi |

## Testler

```bash
npm test        # API entegrasyon testleri + arayüz (DOM) testleri
```

- `test/api.test.js` gerçek sunucuyu geçici bir veritabanıyla ayağa kaldırıp tüm akışları
  dener: giriş, gönderi, beğeni, yorum, takip, hikaye, DM, **video yükleme**, **Reels**,
  **görüntülenme sayacı**, **HTTP Range (video akışı)**, **arama sinyalleşmesi**
  (teklif/yanıt/reddetme/meşgul) ve güvenlik kontrolleri.
- `test/ui.test.mjs` tarayıcısız bir DOM simülatöründe gerçek SPA'yı çalıştırır ve tüm ana
  rotaların (Reels dahil) hata vermeden render edildiğini, video oynatıcıların, arama
  düğmelerinin ve sohbet içi arama kayıtlarının oluştuğunu doğrular.

## Yapılandırma

| değişken | varsayılan | açıklama |
| --- | --- | --- |
| `PORT` | `3000` | dinlenecek port |
| `HOST` | `0.0.0.0` | dinlenecek adres |
| `DATA_DIR` | `./data` | veritabanı + yüklenen görseller |
| `DB_PATH` | `$DATA_DIR/app.db` | SQLite dosyası |
| `SEED` | – | `0` verilirse demo verisi oluşturulmaz |

## Notlar / sınırlar

- Uygulama tek süreçlidir; SQLite dosyası tek sunucu için uygundur.
- Görseller istemcide 1080 px'e küçültülüp JPEG olarak yüklenir (en fazla 8 MB).
- Demo verisi ilk açılışta üretilir; `data/` klasörünü silerek sıfırlayabilirsin.
- Bu bir demo projedir; üretimde HTTPS, e-posta doğrulama, moderasyon ve yedekleme eklenmelidir.