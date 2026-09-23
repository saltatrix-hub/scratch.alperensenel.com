# SCRATCH!

10 kişiye kadar gerçek zamanlı çizim ve tahmin oyunu. Cloudflare Workers, Durable Objects, WebSocket ve React ile geliştirilmiştir.

## Tur akışı

Solo ve takım modunda ilk doğru tahmin turu bitirir. Doğru bilen oyuncu ve çizen oyuncu birer puan kazanır. Hedef puana ulaşılmadıysa kelime 2,2 saniye gösterilir; ardından çizim sırası oyuncu listesindeki sıradaki kişiye geçer. Son oyuncudan sonra sıra başa döner. Yeni turda tahta ve tahmin durumları temizlenir, süre yenilenir ve yeni kelime yalnızca çizen oyuncuya gönderilir. Hedef puana ulaşıldığında sonuç ekranı açılır.

## Geliştirme

```bash
npm install
npm run dev
```

## Doğrulama

`npm run build` TypeScript ve üretim derlemesini kontrol eder. Geliştirme sunucusu açıkken `SCRATCH_URL` ortam değişkenini sunucunun adresine ayarlayıp `npm run smoke` çalıştırın. Testler iki ve üç oyunculu solo odaları ile üç oyunculu takım odasında ilk doğru tahminle tur bitişini, tüm oyuncular arasında çizim sırasını, özel kelime iletimini, puanları, tahta temizliğini ve odadan ayrılmayı gerçek WebSocket bağlantılarıyla doğrular.

## Yayınlama

Cloudflare hesabı bağlandıktan sonra:

```bash
npm run deploy
```
