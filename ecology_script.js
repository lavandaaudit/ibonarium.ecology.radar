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
    // CartoDB - Light (Filtered to Grey)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(map);
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
    // 1. Землетруси (USGS Real-time)
    try {
        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        const data = await res.json();
        let markers = [];
        data.features.forEach(f => {
            const mag = f.properties.mag;
            const size = mag * 1.5;
            const marker = L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
                radius: size, color: '#fff', weight: 1, fillColor: '#ff3333', fillOpacity: 0.4
            }).bindPopup(`Магнітуда: ${mag}<br>${f.properties.place}`);
            markers.push(marker);
        });
        layers.quakes = L.layerGroup(markers).addTo(map);
    } catch (e) { console.error('Quake Error', e); }
    // 2. Пожежі (NASA GIBS WMS - Real-time Thermal Anomalies)
    try {
        layers.fires = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
            layers: 'MODIS_Terra_Thermal_Anomalies_All',
            format: 'image/png',
            transparent: true,
            opacity: 0.8
        });
    } catch (e) { console.error('Fire WMS Error', e); }
    // 3. Радіація (Safecast Tile Layer - Real Community Data)
    try {
        layers.rad = L.tileLayer('https://s3.amazonaws.com/te512.safecast.org/{z}/{x}/{y}.png', {
            opacity: 0.7,
            zIndex: 10
        });
    } catch (e) { console.error('Rad Error', e); }
    // 4. Повітря (Open-Meteo Air Quality - Real Live API)
    const capitals = [
        {lat: 50.45, lon: 30.52, name: 'Київ'}, {lat: 40.71, lon: -74.00, name: 'Нью-Йорк'},
        {lat: 35.67, lon: 139.65, name: 'Токіо'}, {lat: 51.50, lon: -0.12, name: 'Лондон'},
        {lat: 28.61, lon: 77.20, name: 'Нью-Делі'}, {lat: -33.86, lon: 151.20, name: 'Сідней'}
    ];
    
    let airMarkers = [];
    // Multiple Coordinate Fetch
    const lats = capitals.map(c => c.lat).join(',');
    const lons = capitals.map(c => c.lon).join(',');
    
    try {
        const airRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=european_aqi,pm2_5`);
        const airData = await airRes.json();
        
        const results = Array.isArray(airData) ? airData : [airData];
        
        results.forEach((res, i) => {
            if(!res.current) return;
            const aqi = res.current.european_aqi;
            const pm25 = res.current.pm2_5;
            const city = capitals[i];
            
            let color = '#00f3ff';
            if (aqi > 60) color = '#ffaa00';
            if (aqi > 80) color = '#ff3333';
            const marker = L.circleMarker([city.lat, city.lon], {
                radius: 6, color: color, fillColor: color, fillOpacity: 0.6
            }).bindPopup(`<b>${city.name}</b><br>AQI (EU): ${aqi}<br>PM2.5: ${pm25}`);
            airMarkers.push(marker);
        });
        layers.air = L.layerGroup(airMarkers);
    } catch (e) { console.error('Air fetching error', e); }
    
    statusMsg.innerText = "Всі системи в нормі. Дані актуальні.";
}
// --- Управління Шарами ---
window.toggleLayer = function (key) {
    layerStates[key] = !layerStates[key];
    const btn = document.getElementById('btn-' + key);
    if (layerStates[key]) {
        if(layers[key]) map.addLayer(layers[key]);
        btn.classList.add('active');
    } else {
        if(layers[key]) map.removeLayer(layers[key]);
        btn.classList.remove('active');
    }
}
window.onload = initMap;
