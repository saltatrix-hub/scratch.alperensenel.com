# SCRATCH!

10 kişiye kadar gerçek zamanlı çizim ve tahmin oyunu. Cloudflare Workers, Durable Objects, WebSocket ve React ile geliştirilmiştir.

## Tur akışı

Solo ve takım modunda ilk doğru tahmin turu bitirir. Doğru bilen oyuncu ve çizen oyuncu birer puan kazanır. Hedef puana ulaşılmadıysa kelime 2,2 saniye gösterilir; ardından çizim sırası oyuncu listesindeki sıradaki kişiye geçer. Son oyuncudan sonra sıra başa döner. Yeni turda tahta ve tahmin durumları temizlenir, süre yenilenir ve yeni kelime yalnızca çizen oyuncuya gönderilir. Hedef puana ulaşıldığında sonuç ekranı açılır.

Solo ve takım modundaki bütün cevaplar tam iki kelimedir. Her zorlukta 11.000 özgün birleşim bulunur ve aynı oyun içinde aynı cevap yeniden seçilmez. Cevabın bir parçası bulunursa o parça anında açılır; tek parçayı bulmak puan vermez, iki parça tamamlandığında normal doğru cevap puanı uygulanır.

Kargaşa, kulaktan kulağa çizim akışıdır: ilk turda herkes kendi cümlesini yazar; sonraki turlarda zincir sağdaki oyuncuya geçer ve oyuncular yalnızca önlerindeki cümleyi çizer veya önlerindeki çizimi tahmin eder. Tur sayısı oyuncu sayısına eşittir. Oyun boyunca hiçbir zincir aynı oyuncuda üst üste kalmaz ve finalde her başlangıç cümlesinin bütün yazı/çizim serüveni albümde gösterilir.

## Geliştirme

```bash
npm install
npm run dev
```

## Doğrulama

`npm run build` TypeScript ve üretim derlemesini kontrol eder. Geliştirme sunucusu açıkken `SCRATCH_URL` ortam değişkenini sunucunun adresine ayarlayıp `npm run smoke` çalıştırın. Testler beş seviyedeki bütün ifadelerin iki kelime ve mükerrersiz olduğunu; solo/takım tur akışını; özel kelime iletimini; puanları; tahta temizliğini; odadan ayrılmayı ve Kargaşa modunun round-robin yazı/çizim/tahmin albümünü doğrular.

## Yayınlama

Cloudflare hesabı bağlandıktan sonra:

```bash
npm run deploy
```
