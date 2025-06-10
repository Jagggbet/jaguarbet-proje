// analytics.js - JaguarBet API İstek Dedektifi

const JaguarAnalytics = {
    // Tüm istekleri ve sayımlarını burada saklayacağız.
    requestsLog: [],
    requestCounts: {},

    // Endpoint'e göre isteğin türünü belirleyen fonksiyon.
    getRequestType: function(endpoint) {
        if (endpoint.includes('/fixtures?live=all')) return 'Canlı Maç Listesi';
        if (endpoint.includes('/fixtures?date=')) return 'Tarihli Maç Listesi';
        if (endpoint.includes('/fixture-details')) return 'Maç Detayı (Modal)';
        if (endpoint.includes('/h2h')) return 'H2H (Modal)';
        if (endpoint.includes('/standings')) return 'Puan Durumu';
        if (endpoint.includes('/leagues')) return 'Lig Listesi';
        if (endpoint.includes('/seasons')) return 'Sezon Listesi';
        if (endpoint.includes('/get-favorites')) return 'Favorileri Yükle';
        if (endpoint.includes('/set-favorites')) return 'Favorileri Kaydet';
        if (endpoint.includes('/subscribe')) return 'Bildirim Abone Ol';
        if (endpoint.includes('/unsubscribe')) return 'Bildirim Abonelik İptal';
        if (endpoint.includes('/config')) return 'Yapılandırma (VAPID)';
        return 'Diğer/Bilinmeyen';
    },

    // Her API isteği yapıldığında bu fonksiyon çağrılacak.
    logRequest: function(endpoint) {
        const timestamp = new Date();
        const type = this.getRequestType(endpoint);

        // İsteği detaylı log'a ekle.
        this.requestsLog.push({
            'Zaman': timestamp.toLocaleTimeString('tr-TR', { hour12: false }),
            'İstek Türü': type,
            'Endpoint': endpoint
        });

        // Sayacı artır.
        if (this.requestCounts[type]) {
            this.requestCounts[type]++;
        } else {
            this.requestCounts[type] = 1;
        }

        // Raporu konsolda göster.
        this.displaySummary();
    },

    // Raporu konsola güzel bir formatta basan fonksiyon.
    displaySummary: function() {
        // Her seferinde konsolu temizleyerek en güncel raporu gösterir.
        console.clear();

        const totalRequests = this.requestsLog.length;
        
        console.log('%c📊 JaguarBet API Analiz Raporu 📊', 'color: #D32F2F; font-size: 1.5em; font-weight: bold; padding: 5px;');
        console.log(`%cTOPLAM İSTEK SAYISI: ${totalRequests}`, `color: #ffc107; font-size: 1.2em; font-weight: bold;`);
        
        // İstekleri türüne göre tablo halinde göster.
        console.log('%cİsteklerin Türüne Göre Dağılımı:', 'font-weight: bold; margin-top: 10px;');
        console.table(this.requestCounts);

        // Tüm isteklerin detaylı listesini göster.
        console.log('%cTüm İsteklerin Zaman Tüneli:', 'font-weight: bold; margin-top: 10px;');
        console.table(this.requestsLog);
        
        if (totalRequests >= 100) {
             console.log('%c🚨 UYARI! Ücretsiz planın (100) günlük limitine ulaştınız veya aştınız!', 'color: red; font-size: 1.3em; font-weight: bold; border: 2px solid red; padding: 5px;');
        }
    }
};

// Başlangıçta boş bir rapor göster.
JaguarAnalytics.displaySummary();