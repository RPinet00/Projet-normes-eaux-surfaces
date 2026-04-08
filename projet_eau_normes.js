// =============================================
// CONFIGURATION DES COUCHES ET CLASSIFICATIONS
// =============================================
const config = {
  nitrates: {
    label: 'Nitrates (NO₃⁻)',
    paramShort: 'Nitrates',
    file: 'stations_metropolitan_max_rana_nitrates_wgs84.geojson',
    unite: 'mg/L',
    classifications: {
      norme_eu: {
        label: 'Norme EU (50 mg/L)',
        seuil: 50,
        getColor: (v) =>
          v > 50 ? '#d73027' : v > 40 ? '#f46d43' : v > 30 ? '#fdae61' :
          v > 20 ? '#fee08b' : v > 10 ? '#d9ef8b' : '#1a9850',
        bins: [
          { max: 10,  label: '< 10',    color: '#1a9850' },
          { max: 20,  label: '10 – 20', color: '#d9ef8b' },
          { max: 30,  label: '20 – 30', color: '#fee08b' },
          { max: 40,  label: '30 – 40', color: '#fdae61' },
          { max: 50,  label: '40 – 50', color: '#f46d43' },
          { max: Infinity, label: '> 50', color: '#d73027' }
        ]
      },
      norme_ch: {
        label: 'Norme CH (25 mg/L)',
        seuil: 25,
        getColor: (v) =>
          v > 25 ? '#d73027' : v > 20 ? '#f46d43' : v > 15 ? '#fdae61' :
          v > 10 ? '#fee08b' : v >  5 ? '#d9ef8b' : '#1a9850',
        bins: [
          { max: 5,   label: '< 5',     color: '#1a9850' },
          { max: 10,  label: '5 – 10',  color: '#d9ef8b' },
          { max: 15,  label: '10 – 15', color: '#fee08b' },
          { max: 20,  label: '15 – 20', color: '#fdae61' },
          { max: 25,  label: '20 – 25', color: '#f46d43' },
          { max: Infinity, label: '> 25', color: '#d73027' }
        ]
      }
    }
  },
  phosphore: {
    label: 'Phosphore total (P)',
    paramShort: 'Phosphore',
    file: 'stations_metropolitan_max_rana_phosphores_wgs84.geojson',
    unite: 'mg(P)/L',
    classifications: {
      norme_eu: {
        label: 'Norme EU (0.2 mg/L)',
        seuil: 0.2,
        getColor: (v) =>
          v > 0.2  ? '#d73027' : v > 0.15 ? '#f46d43' : v > 0.1  ? '#fdae61' :
          v > 0.05 ? '#fee08b' : v > 0.02 ? '#d9ef8b' : '#1a9850',
        bins: [
          { max: 0.02,  label: '< 0.02',        color: '#1a9850' },
          { max: 0.05,  label: '0.02 – 0.05',   color: '#d9ef8b' },
          { max: 0.1,   label: '0.05 – 0.1',    color: '#fee08b' },
          { max: 0.15,  label: '0.1 – 0.15',    color: '#fdae61' },
          { max: 0.2,   label: '0.15 – 0.2',    color: '#f46d43' },
          { max: Infinity, label: '> 0.2',       color: '#d73027' }
        ]
      },
      norme_ch: {
        label: 'Norme CH (0.1 mg/L)',
        seuil: 0.1,
        getColor: (v) =>
          v > 0.1   ? '#d73027' : v > 0.08  ? '#f46d43' : v > 0.06  ? '#fdae61' :
          v > 0.04  ? '#fee08b' : v > 0.02  ? '#d9ef8b' : '#1a9850',
        bins: [
          { max: 0.02,  label: '< 0.02',        color: '#1a9850' },
          { max: 0.04,  label: '0.02 – 0.04',   color: '#d9ef8b' },
          { max: 0.06,  label: '0.04 – 0.06',   color: '#fee08b' },
          { max: 0.08,  label: '0.06 – 0.08',   color: '#fdae61' },
          { max: 0.1,   label: '0.08 – 0.1',    color: '#f46d43' },
          { max: Infinity, label: '> 0.1',       color: '#d73027' }
        ]
      }
    }
  }
};

// =============================================
// SOUS-ÉCHANTILLONNAGE ADAPTATIF PAR ZOOM
// =============================================
function getMaxPoints(zoom) {
  if (zoom >= 12) return Infinity;
  if (zoom >= 10) return 2000;
  if (zoom >= 8)  return 800;
  if (zoom >= 6)  return 300;
  return 150;
}

function filterFeatures(features) {
  const bounds = map.getBounds();
  const zoom   = map.getZoom();
  const maxPts = getMaxPoints(zoom);
  const inView = features.filter(f => {
    const [lng, lat] = f.geometry.coordinates;
    return bounds.contains(L.latLng(lat, lng));
  });
  if (inView.length <= maxPts) return inView;
  const step = Math.ceil(inView.length / maxPts);
  return inView.filter((_, i) => i % step === 0);
}

// =============================================
// INITIALISATION CARTE
// =============================================
const map = L.map('map', { zoomControl: false }).setView([46.5, 2.5], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO', maxZoom: 19
}).addTo(map);
L.control.zoom({ position: 'topleft' }).addTo(map);

// =============================================
// ÉTAT GLOBAL
// =============================================
let currentLayer   = 'nitrates';
let currentClassif = 'norme_eu';
let geojsonLayer   = null;
let allData        = null;
let renderTimeout  = null;

// =============================================
// STYLE DES POINTS
// =============================================
function getStyle(value) {
  return {
    radius: map.getZoom() >= 10 ? 7 : 5,
    fillColor: config[currentLayer].classifications[currentClassif].getColor(value),
    color: 'rgba(255,255,255,0.6)',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.88
  };
}

// =============================================
// RENDU DE LA COUCHE
// =============================================
function renderLayer() {
  if (!allData) return;
  if (geojsonLayer) { map.removeLayer(geojsonLayer); geojsonLayer = null; }

  const filtered = filterFeatures(allData.features);
  const layerKey = currentLayer;

  geojsonLayer = L.geoJSON({ type: 'FeatureCollection', features: filtered }, {
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, getStyle(feature.properties.RsAna)),
    onEachFeature: (feature, layer) => {
      layer.on({
        mouseover: (e) => e.target.setStyle({ weight: 2.5, color: '#004655', fillOpacity: 1, radius: (map.getZoom() >= 10 ? 9 : 7) }),
        mouseout:  (e) => geojsonLayer && geojsonLayer.resetStyle(e.target)
      });
      if (feature.properties) {
        const unite = config[layerKey].unite;
        const val   = feature.properties.RsAna;
        const color = config[layerKey].classifications[currentClassif].getColor(val);
        layer.bindPopup(`
          <div class="custom-popup">
            <div class="popup-header">${feature.properties.LbStationMesureEauxSurface || 'Station'}</div>
            <div class="popup-row">
              <span class="popup-label">${feature.properties.LbLongParamètre || layerKey}</span>
              <span class="popup-value" style="color:${color}">${val} ${unite}</span>
            </div>
            ${feature.properties.NomCoursdEau ? `<div class="popup-river">🌊 ${feature.properties.NomCoursdEau}</div>` : ''}
            ${feature.properties.LbCommune    ? `<div class="popup-commune">📍 ${feature.properties.LbCommune}</div>` : ''}
          </div>
        `);
      }
    }
  }).addTo(map);

  updateStats(filtered);
  updateHistogram(filtered);
  updatePointCounter(filtered.length, allData.features.length);
}

function scheduleRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(renderLayer, 150);
}

// =============================================
// LÉGENDE & BOUTON
// =============================================
function updateLegend() {
  const items = config[currentLayer].classifications[currentClassif].legend || [];
  const container = document.getElementById('legend-items');
  container.innerHTML = '';
  // Reconstruire depuis bins
  const bins = config[currentLayer].classifications[currentClassif].bins;
  bins.slice().reverse().forEach(bin => {
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `<span class="legend-dot" style="background:${bin.color}"></span><span>${bin.label} mg/L</span>`;
    container.appendChild(div);
  });
}

function updateToggleBtn() {
  const autre = currentClassif === 'norme_eu' ? 'norme_ch' : 'norme_eu';
  const autreLabel = config[currentLayer].classifications[autre].label;
  document.getElementById('toggle-classif').innerHTML = `<span class="btn-icon">⇄</span> ${autreLabel}`;
}

// =============================================
// STATISTIQUES
// =============================================
function updateStats(visibleFeatures) {
  if (!visibleFeatures || visibleFeatures.length === 0) {
    ['stat-count','stat-avg','stat-max','stat-min'].forEach(id =>
      document.getElementById(id).textContent = '–');
    return;
  }
  const unite  = config[currentLayer].unite;
  const values = visibleFeatures.map(f => f.properties.RsAna).filter(v => v != null);
  const avg    = values.reduce((a, b) => a + b, 0) / values.length;
  const max    = Math.max(...values);
  const min    = Math.min(...values);
  document.getElementById('stat-count').textContent = values.length;
  document.getElementById('stat-avg').textContent   = `${parseFloat(avg.toFixed(3))} ${unite}`;
  document.getElementById('stat-max').textContent   = `${parseFloat(max.toFixed(3))} ${unite}`;
  document.getElementById('stat-min').textContent   = `${parseFloat(min.toFixed(3))} ${unite}`;
}

function updatePointCounter(shown, total) {
  const el = document.getElementById('point-counter');
  if (!el) return;
  el.textContent = shown < total
    ? `${shown.toLocaleString()} / ${total.toLocaleString()} stations affichées`
    : `${shown.toLocaleString()} stations affichées`;
  el.style.display = 'block';
}

// =============================================
// HISTOGRAMME DE DISTRIBUTION
// =============================================
function updateHistogram(features) {
  const canvas = document.getElementById('histogram-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const bins = config[currentLayer].classifications[currentClassif].bins;
  const values = (features || []).map(f => f.properties.RsAna).filter(v => v != null);

  // Compter par bin
  const counts = bins.map(bin => {
    const prev = bins[bins.indexOf(bin) - 1];
    const lo   = prev ? prev.max : -Infinity;
    return values.filter(v => v > lo && v <= bin.max).length;
  });

  const maxCount = Math.max(...counts, 1);
  const W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
  const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;

  ctx.clearRect(0, 0, w, h);

  const padL = 40, padR = 10, padT = 12, padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const barW   = chartW / bins.length;
  const gap    = 4;

  // Axe Y
  ctx.strokeStyle = '#dde3ea';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + chartH); ctx.stroke();

  // Grille horizontale
  const ticks = 4;
  ctx.fillStyle   = '#6f797c';
  ctx.font        = `${10 * window.devicePixelRatio / window.devicePixelRatio}px Inter, sans-serif`;
  ctx.textAlign   = 'right';
  for (let i = 0; i <= ticks; i++) {
    const y   = padT + chartH - (i / ticks) * chartH;
    const val = Math.round((i / ticks) * maxCount);
    ctx.fillStyle   = '#6f797c';
    ctx.fillText(val, padL - 4, y + 3);
    ctx.strokeStyle = '#eceef0';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
  }

  // Barres
  bins.forEach((bin, i) => {
    const x      = padL + i * barW + gap / 2;
    const bw     = barW - gap;
    const bh     = (counts[i] / maxCount) * chartH;
    const y      = padT + chartH - bh;

    // Barre
    ctx.fillStyle = bin.color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, bw, bh, [3, 3, 0, 0]) : ctx.rect(x, y, bw, bh);
    ctx.fill();

    // Valeur au-dessus
    if (counts[i] > 0) {
      ctx.fillStyle  = '#3f484c';
      ctx.textAlign  = 'center';
      ctx.font       = '9px Inter, sans-serif';
      ctx.fillText(counts[i], x + bw / 2, y - 3);
    }

    // Label axe X
    ctx.fillStyle = '#6f797c';
    ctx.font      = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bin.label, x + bw / 2, padT + chartH + 14);
  });
}

// =============================================
// CHARGEMENT D'UNE COUCHE
// =============================================
function loadLayer(layerKey) {
  currentLayer   = layerKey;
  currentClassif = 'norme_eu';

  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('current-param').textContent = config[layerKey].paramShort;

  if (geojsonLayer) { map.removeLayer(geojsonLayer); geojsonLayer = null; }
  allData = null;

  ['stat-count','stat-avg','stat-max','stat-min'].forEach(id =>
    document.getElementById(id).textContent = '…');

  document.getElementById('loading-indicator').style.display = 'flex';

  fetch(config[layerKey].file)
    .then(r => r.json())
    .then(data => {
      allData = data;
      document.getElementById('loading-indicator').style.display = 'none';
      updateLegend();
      updateToggleBtn();
      renderLayer();
      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    })
    .catch(err => {
      console.error('Erreur de chargement :', err);
      document.getElementById('loading-indicator').style.display = 'none';
    });
}

// =============================================
// ÉVÉNEMENTS
// =============================================
document.getElementById('layer-select').addEventListener('change', (e) => loadLayer(e.target.value));

document.getElementById('toggle-classif').addEventListener('click', () => {
  currentClassif = currentClassif === 'norme_eu' ? 'norme_ch' : 'norme_eu';
  if (geojsonLayer) {
    geojsonLayer.eachLayer(layer => layer.setStyle(getStyle(layer.feature.properties.RsAna)));
  }
  updateLegend();
  updateToggleBtn();
  if (allData) {
    const filtered = filterFeatures(allData.features);
    updateHistogram(filtered);
  }
});

map.on('moveend', scheduleRender);
map.on('zoomend', scheduleRender);
window.addEventListener('resize', () => {
  if (allData) updateHistogram(filterFeatures(allData.features));
});

// =============================================
// RECHERCHE
// =============================================
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = '';
  if (!allData || query.length < 2) { searchResults.style.display = 'none'; return; }

  const matches = allData.features.filter(f =>
    f.properties.LbStationMesureEauxSurface &&
    f.properties.LbStationMesureEauxSurface.toLowerCase().includes(query)
  ).slice(0, 8);

  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="sr-item sr-empty">Aucune station trouvée</div>';
    searchResults.style.display = 'block';
    return;
  }
  matches.forEach(f => {
    const item = document.createElement('div');
    item.className = 'sr-item';
    item.innerHTML = `
      <span class="sr-name">${f.properties.LbStationMesureEauxSurface}</span>
      ${f.properties.NomCoursdEau ? `<span class="sr-sub">${f.properties.NomCoursdEau}</span>` : ''}
    `;
    item.addEventListener('click', () => {
      const [lng, lat] = f.geometry.coordinates;
      map.setView(L.latLng(lat, lng), 13);
      scheduleRender();
      setTimeout(() => {
        if (!geojsonLayer) return;
        geojsonLayer.eachLayer(layer => {
          if (layer.feature &&
              layer.feature.properties.CdStationMesureEauxSurface === f.properties.CdStationMesureEauxSurface)
            layer.openPopup();
        });
      }, 400);
      searchResults.style.display = 'none';
      searchInput.value = f.properties.LbStationMesureEauxSurface;
    });
    searchResults.appendChild(item);
  });
  searchResults.style.display = 'block';
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#search-wrapper')) searchResults.style.display = 'none';
});

// =============================================
// DÉMARRAGE
// =============================================
loadLayer('nitrates');
