const statusMsg = document.getElementById('status-message');
const lastUpdate = document.getElementById('last-update');
let map;
let layers = {};
let layerStates = {
    quakes: true,
    fires: false,
    rad: false,
    air: false,
    anom: false
};

// --- ініціалізація Мапи ---
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.5
    }).setView([20, 0], 2.5);

    // CartoDB Dark Matter - ідеальна темна мапа з чіткими кордонами
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(map);

    // Додаємо окремо шар лейблів щоб вони були читабельні (або ні, мінімалізм)
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png').addTo(map);

    loadData();
    updateClock();
}

function updateClock() {
    const now = new Date();
    lastUpdate.innerText = now.toLocaleTimeString('uk-UA');
}

// --- Завантаження Даних ---

async function loadData() {
    statusMsg.innerText = "Встановлення з'єднання...";

    // 1. Землетруси (USGS)
    try {
        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        const data = await res.json();

        let markers = [];
        data.features.forEach(f => {
            const mag = f.properties.mag;
            const size = mag * 1.5; // Менший радіус для мінімалізму
            const marker = L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
                radius: size,
                color: '#fff',
                weight: 1,
                fillColor: '#ff3333',
                fillOpacity: 0.4
            }).bindPopup(`Магнітуда: ${mag}<br>${f.properties.place}`);
            markers.push(marker);
        });

        layers.quakes = L.layerGroup(markers).addTo(map);
        statusMsg.innerText = `Сейсмодані отримано: ${data.features.length} подій`;
    } catch (e) {
        statusMsg.innerText = "Помилка отримання сейсмоданих";
    }

    // 2. Пожежі (Імітація)
    const fireZones = [
        { lat: -3.4, lon: -62.2, name: 'Амазонія' },
        { lat: 1.6, lon: 15.6, name: 'Центральна Африка' },
        { lat: -25.2, lon: 133.7, name: 'Австралія' },
        { lat: 38.5, lon: -121.4, name: 'Каліфорнія' }
    ];
    let fireMarkers = [];
    fireZones.forEach(z => {
        for (let i = 0; i < 15; i++) {
            fireMarkers.push(L.circleMarker([z.lat + (Math.random() - 0.5) * 10, z.lon + (Math.random() - 0.5) * 10], {
                radius: 1.5, color: '#ff5500', fillOpacity: 0.9, stroke: false
            }));
        }
    });
    layers.fires = L.layerGroup(fireMarkers);

    // 3. Радіація
    layers.rad = L.layerGroup([
        L.marker([51.389, 30.099]).bindPopup('Чорнобильська зона<br>Рівень: Підвищений'),
        L.marker([37.421, 141.033]).bindPopup('Фукусіма<br>Рівень: Середній'),
        L.circle([51.389, 30.099], { radius: 50000, color: '#39ff14', fill: false, dashArray: '5, 10' })
    ]);

    // 4. Повітря
    const cities = [
        { lat: 50.45, lon: 30.52, aqi: 65, name: 'Київ' },
        { lat: 39.9, lon: 116.4, aqi: 160, name: 'Пекін' },
        { lat: 40.7, lon: -74.0, aqi: 45, name: 'Нью-Йорк' }
    ];
    let airMarkers = [];
    cities.forEach(c => {
        let col = c.aqi > 100 ? '#ff3333' : '#00f3ff';
        airMarkers.push(L.circleMarker([c.lat, c.lon], {
            radius: 5, color: col, fillColor: col, fillOpacity: 0.5
        }).bindPopup(`AQI ${c.name}: ${c.aqi}`));
    });
    layers.air = L.layerGroup(airMarkers);

    // 5. Аномалії
    layers.anom = L.layerGroup([
        L.marker([-15, -175]).bindPopup('Попередження цунамі<br>Тихий Океан'),
        L.marker([25, -70]).bindPopup('Бермудська аномалія<br>Магнітне відхилення')
    ]);
}

// --- Управління Шарами ---
window.toggleLayer = function (key) {
    layerStates[key] = !layerStates[key];
    const btn = document.getElementById('btn-' + key);

    if (layerStates[key]) {
        map.addLayer(layers[key]);
        btn.classList.add('active');
    } else {
        map.removeLayer(layers[key]);
        btn.classList.remove('active');
    }
}

window.onload = initMap;
