const STATE = {
    map: null,
    layers: {},
    activeStates: {
        quakes: true, fires: false, air: false, rad: false, anom: false,
        ozone: false, wind: false, water: false
    },
    stats: { quakes: [], air: [] },
    chart: null
};

// --- Initialization ---

window.onload = () => {
    initMap();
    initChart();
    loadCycle();
    startClock();
    setupListeners();
};

function initMap() {
    STATE.map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        center: [20, 0],
        zoom: 3,
        minZoom: 2.5
    });

    // Dark Matter Map Style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(STATE.map);

    // Initial position based on user IP (simulated)
    STATE.map.setView([50.4501, 30.5234], 4); // Views Europe/Ukraine initially
}

function initChart() {
    const ctx = document.getElementById('quakeChart').getContext('2d');
    STATE.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Minor', 'Moderate', 'Strong', 'Major'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#0072ff', '#39ff14', '#ffaa00', '#ff3333'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            cutout: '70%'
        }
    });
}

function setupListeners() {
    // Mouse coordinates tracker
    STATE.map.on('mousemove', (e) => {
        document.getElementById('lat').innerText = e.latlng.lat.toFixed(4);
        document.getElementById('lon').innerText = e.latlng.lng.toFixed(4);
    });
}

async function loadCycle() {
    updateStatus("Підключення до супутників...", "cyan");

    // Simulating loading sequence
    await new Promise(r => setTimeout(r, 800));

    updateStatus("Завантаження сейсмічних даних USGS...", "cyan");
    await setupQuakes();
    console.log('✅ Quakes loaded');

    updateStatus("Отримання термоточок FIRMS...", "orange");
    setupFires();
    console.log('✅ Fires loaded');

    updateStatus("Аналіз якості повітря Open-Meteo...", "green");
    await setupAirQuality();
    console.log('✅ Air Quality loaded');

    updateStatus("Завантаження радіаційного фону Safecast...", "yellow");
    setupRadiation();
    console.log('✅ Radiation loaded');

    updateStatus("Температурні аномалії NASA GIBS...", "red");
    setupAnomalies();
    console.log('✅ Anomalies loaded');

    updateStatus("Підключення озонового шару NASA...", "blue");
    setupOzone();
    console.log('✅ Ozone loaded');

    updateStatus("Моделювання вітрових потоків...", "cyan");
    setupWind();
    console.log('✅ Wind loaded');

    updateStatus("СИСТЕМА АКТИВНА", "green");
    document.getElementById('last-update').innerText = new Date().toLocaleTimeString();
}

// --- Layer Setup Functions (Real Data & APIs) ---

async function setupQuakes() {
    try {
        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        const data = await res.json();
        const quakes = data.features;

        const markers = L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup();

        let stats = { minor: 0, moderate: 0, strong: 0, major: 0, energy: 0 };

        quakes.forEach(q => {
            const mag = q.properties.mag;
            const coords = [q.geometry.coordinates[1], q.geometry.coordinates[0]];
            const depth = q.geometry.coordinates[2];

            // Stats
            if (mag < 4) stats.minor++;
            else if (mag < 5) stats.moderate++;
            else if (mag < 6) stats.strong++;
            else stats.major++;

            // Energy calculation (Approximate Joule conversion logE = 4.8 + 1.5M)
            stats.energy += Math.pow(10, 4.8 + 1.5 * mag);

            // Visuals
            let color = '#0072ff';
            if (mag >= 4) color = '#39ff14';
            if (mag >= 5) color = '#ffaa00';
            if (mag >= 6) color = '#ff3333';

            const radius = mag * 1.5; // Reduced size as requested

            const marker = L.circleMarker(coords, {
                radius: radius,
                fillColor: color,
                color: '#fff',
                weight: 0.5,
                opacity: 0.8,
                fillOpacity: 0.6
            }).bindPopup(`
                <div class="custom-popup">
                    <b style="color:${color}">SEISMIC EVENT</b>
                    <span>MAG: <b>${mag.toFixed(1)}</b></span>
                    <span>LOC: ${q.properties.place}</span>
                    <span>DEPTH: ${depth} km</span>
                    <span>TIME: ${new Date(q.properties.time).toLocaleTimeString()}</span>
                </div>
            `);

            markers.addLayer(marker);
        });

        STATE.layers.quakes = markers;
        STATE.map.addLayer(markers); // Active by default

        // Update Chart
        STATE.chart.data.datasets[0].data = [stats.minor, stats.moderate, stats.strong, stats.major];
        STATE.chart.update();

        // Update Threat Level
        const danger = Math.min(10, (stats.strong * 1 + stats.major * 3));
        const dangerPercent = (danger * 10).toFixed(0);
        document.getElementById('danger-value').innerText = `${danger.toFixed(1)}/10`;
        document.getElementById('danger-progress').style.width = `${dangerPercent}%`;

        if (danger > 7) {
            document.getElementById('danger-status').innerText = "CRITICAL";
            document.getElementById('danger-status').style.color = "var(--accent-red)";
        } else if (danger > 4) {
            document.getElementById('danger-status').innerText = "ELEVATED";
            document.getElementById('danger-status').style.color = "var(--accent-orange)";
        } else {
            document.getElementById('danger-status').innerText = "NORMAL";
            document.getElementById('danger-status').style.color = "var(--accent-green)";
        }

        // Total Energy in TJ (Simple visual number)
        // Check if element exists before setting
        const energyEl = document.getElementById('total-energy');
        if (energyEl) {
            energyEl.innerText = (stats.energy / 1000000000000).toFixed(2) + " TJ";
        }

    } catch (e) { console.error(e); }
}

function setupFires() {
    STATE.layers.fires = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
        layers: 'MODIS_Terra_Thermal_Anomalies_All',
        format: 'image/png', transparent: true, opacity: 0.7
    });
}

// --- Helper Functions ---
function getAQIColor(pm25) {
    if (pm25 <= 12) return '#39ff14';      // Good (Green)
    if (pm25 <= 35.4) return '#ffff00';    // Moderate (Yellow)
    if (pm25 <= 55.4) return '#ffaa00';    // Unhealthy for Sensitive (Orange)
    if (pm25 <= 150.4) return '#ff3333';   // Unhealthy (Red)
    if (pm25 <= 250.4) return '#99004c';   // Very Unhealthy (Purple)
    return '#7e0023';                      // Hazardous (Maroon)
}

function getAQIDescription(pm25) {
    if (pm25 <= 12) return 'Добре';
    if (pm25 <= 35.4) return 'Помірно';
    if (pm25 <= 55.4) return 'Шкідливо для чутливих';
    if (pm25 <= 150.4) return 'Шкідливо';
    if (pm25 <= 250.4) return 'Дуже шкідливо';
    return 'Небезпечно';
}

// --- Data Fetching ---

async function fetchOpenMeteoData(lat, lon, type) {
    // type: 'air_quality' or 'weather'
    try {
        let url = '';
        if (type === 'air_quality') {
            url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,ozone&timezone=auto`;
        } else if (type === 'weather') {
            url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&timezone=auto`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (e) {
        console.warn(`OpenMeteo ${type} failed for ${lat},${lon}`, e);
        return null;
    }
}

async function setupAirQuality() {
    const cities = [
        { name: "Kyiv", lat: 50.4501, lon: 30.5234 },
        { name: "London", lat: 51.5074, lon: -0.1278 },
        { name: "Paris", lat: 48.8566, lon: 2.3522 },
        { name: "New York", lat: 40.7128, lon: -74.0060 },
        { name: "Beijing", lat: 39.9042, lon: 116.4074 },
        { name: "Delhi", lat: 28.7041, lon: 77.1025 },
        { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
        { name: "Sydney", lat: -33.8688, lon: 151.2093 },
        { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
        { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
        { name: "Moscow", lat: 55.7558, lon: 37.6173 },
        { name: "Berlin", lat: 52.5200, lon: 13.4050 },
        { name: "Toronto", lat: 43.6532, lon: -79.3832 },
        { name: "Singapore", lat: 1.3521, lon: 103.8198 },
        { name: "Dubai", lat: 25.2048, lon: 55.2708 },
        { name: "Mexico City", lat: 19.4326, lon: -99.1332 },
        { name: "Sao Paulo", lat: -23.5505, lon: -46.6333 },
        { name: "Cairo", lat: 30.0444, lon: 31.2357 },
        { name: "Seoul", lat: 37.5665, lon: 126.9780 },
        { name: "Istanbul", lat: 41.0082, lon: 28.9784 }
    ];

    const markers = [];

    // Fetch data concurrently
    const promises = cities.map(city => fetchOpenMeteoData(city.lat, city.lon, 'air_quality').then(data => ({ ...city, data })));
    const results = await Promise.all(promises);

    results.forEach(item => {
        if (item.data && item.data.current) {
            const pm25 = item.data.current.pm2_5;
            const color = getAQIColor(pm25);
            const desc = getAQIDescription(pm25);

            markers.push(L.circleMarker([item.lat, item.lon], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 1.5,
                fillOpacity: 0.8
            }).bindPopup(`
                <b>🔹 ${item.name}</b><br>
                PM2.5: <b>${pm25}</b> µg/m³<br>
                Статус: <b style="color:${color}">${desc}</b><br>
                <span style="font-size:0.8em; opacity:0.7">Джерело: Open-Meteo (Real-Time)</span>
            `));
        }
    });

    STATE.layers.air = L.layerGroup(markers);
    console.log(`✅ Air Quality: Loaded ${markers.length} stations from Open-Meteo`);
}


async function setupOzone() {
    // Using same Open-Meteo API but focusing on Ozone
    // We'll peek at a few key locations for Ozone specifically
    const locations = [
        { name: "Antarctica (Research)", lat: -75.250973, lon: -0.071389 }, // Near Halley
        { name: "Arctic Circle", lat: 66.56, lon: 20.00 },
        { name: "Australia (Ozone Hole Watch)", lat: -42.88, lon: 147.32 }, // Tasmania
        { name: "South America (Patagonia)", lat: -51.62, lon: -69.22 },
        { name: "Equator (Reference)", lat: 0, lon: 0 },
        { name: "North Europe", lat: 60, lon: 10 }
    ];

    const markers = [];
    const promises = locations.map(loc => fetchOpenMeteoData(loc.lat, loc.lon, 'air_quality').then(data => ({ ...loc, data })));
    const results = await Promise.all(promises);

    results.forEach(item => {
        if (item.data && item.data.current) {
            const ozone = item.data.current.ozone; // µg/m³
            // Ozone conversion: 1 DU approx 2.687e16 molecules/cm2... simplifying for UI visualization
            // Typical background ~ 60-100 µg/m3 near surface. Stratospheric is different but this API gives surface.
            // Let's visualize surface ozone concentration.
            // High surface ozone is bad.

            let color = '#00ccff'; // Normal/Low
            if (ozone > 100) color = '#ffaa00'; // Moderate
            if (ozone > 180) color = '#ff3333'; // High

            markers.push(L.circleMarker([item.lat, item.lon], {
                radius: 7,
                fillColor: color,
                color: '#fff',
                weight: 1,
                fillOpacity: 0.6
            }).bindPopup(`
                <b>🛡️ ${item.name}</b><br>
                Ozone (Surface): <b>${ozone}</b> µg/m³<br>
                <span style="font-size:0.8em; opacity:0.7">Джерело: Open-Meteo</span>
            `));
        }
    });

    STATE.layers.ozone = L.layerGroup(markers);
    console.log(`✅ Ozone Layer: Loaded ${markers.length} stations`);
}


async function setupWind() {
    const locations = [
        { name: "Atlantic Ocean", lat: 35, lon: -40 },
        { name: "Pacific Ocean", lat: 20, lon: -160 },
        { name: "Indian Ocean", lat: -10, lon: 75 },
        { name: "Southern Ocean", lat: -55, lon: 0 },
        { name: "North Sea", lat: 56, lon: 3 },
        { name: "Caribbean", lat: 15, lon: -75 },
        { name: "Cape Horn", lat: -55.9, lon: -67.2 },
        { name: "Kyiv", lat: 50.45, lon: 30.52 },
        { name: "New York", lat: 40.71, lon: -74.00 }
    ];

    const markers = [];
    const promises = locations.map(loc => fetchOpenMeteoData(loc.lat, loc.lon, 'weather').then(data => ({ ...loc, data })));
    const results = await Promise.all(promises);

    results.forEach(item => {
        if (item.data && item.data.current) {
            const speed = item.data.current.wind_speed_10m; // km/h
            const dir = item.data.current.wind_direction_10m; // degrees

            const color = speed > 60 ? '#ff3333' : (speed > 30 ? '#ffaa00' : '#66ccff');

            const arrowSvg = `
                <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                    <g transform="rotate(${dir} 15 15)">
                        <path d="M15 5 L15 25 M15 5 L10 10 M15 5 L20 10" 
                              stroke="${color}" stroke-width="2" fill="none"/>
                    </g>
                </svg>
            `;

            const icon = L.divIcon({
                html: arrowSvg,
                className: 'wind-arrow',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            markers.push(L.marker([item.lat, item.lon], { icon }).bindPopup(`
                <b>🌬️ ${item.name}</b><br>
                Швидкість: <b>${speed}</b> km/h<br>
                Напрямок: ${dir}°<br>
                <span style="font-size:0.8em; opacity:0.7">Джерело: Open-Meteo</span>
            `));
        }
    });

    STATE.layers.wind = L.layerGroup(markers);
    console.log(`✅ Wind Layer: Loaded ${markers.length} stations`);
}

function setupRadiation() {
    STATE.layers.rad = L.tileLayer('https://s3.amazonaws.com/te512.safecast.org/{z}/{x}/{y}.png', {
        opacity: 0.6,
        zIndex: 10
    });
}

function setupAnomalies() {
    STATE.layers.anom = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
        layers: 'MODIS_Terra_L3_Land_Surface_Temp_Daily_Day',
        format: 'image/png',
        transparent: true,
        opacity: 0.4,
        zIndex: 2
    });
}

function toggleLayer(key) {
    console.log(`Toggling layer: ${key}`, STATE.layers[key]);

    if (!STATE.layers[key]) {
        console.warn(`Layer ${key} not initialized yet`);
        return;
    }

    STATE.activeStates[key] = !STATE.activeStates[key];
    const btn = document.getElementById('btn-' + key);

    if (STATE.activeStates[key]) {
        STATE.map.addLayer(STATE.layers[key]);
        btn.classList.add('active');
        console.log(`Layer ${key} activated`);
    } else {
        STATE.map.removeLayer(STATE.layers[key]);
        btn.classList.remove('active');
        console.log(`Layer ${key} deactivated`);
    }
}

function updateStatus(msg, color) {
    document.getElementById('status-detailed').innerHTML = `<span style="color:var(--accent-${color})">${msg}</span>`;
}

function startClock() {
    setInterval(() => {
        document.getElementById('last-update').innerText = new Date().toLocaleTimeString();
    }, 60000);
}
