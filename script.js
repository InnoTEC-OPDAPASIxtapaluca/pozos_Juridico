// ============================
// CONFIGURACIÓN MAPA
// ============================
const map = L.map("map", { zoomControl: false }).setView(
  [19.32, -98.93],
  13,
);
L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "© OpenStreetMap",
  },
).addTo(map);

// ============================
// ICONO PUNTOS
// ============================
const iconoPunto = L.icon({
  iconUrl: "./imagenes/iconopozos.png",
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -28],
});
// ============================
// ICONOS DINÁMICOS (por columna Icono)
// ============================
const iconos = {};

function obtenerIcono(nombreIcono) {
  if (!nombreIcono) nombreIcono = "default";

  if (!iconos[nombreIcono]) {
    iconos[nombreIcono] = L.icon({
      iconUrl: `./imagenes/${nombreIcono}.png`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -28],
    });
  }
  return iconos[nombreIcono];
}

// ============================
// CONTENEDORES GLOBALES
// ============================
const layersConPopupAbierto = [];

const lista = document.getElementById("lista");
const capas = {}; // Apartado -> Bloque -> NomCort -> LayerGroup
const capasGlobales = []; // Todos los layers individuales
const controlesApartados = {}; // Botones de cada apartado

// ============================
// TOGGLE PANEL (DESKTOP + MÓVIL)
// ============================
function esMovil() {
  return window.innerWidth <= 768;
}
function cerrarPanel() {
  const panel = document.getElementById("panel");
  panel.classList.add("oculto");
}
// ============================
window.togglePanel = function () {
  const panel = document.getElementById("panel");
  panel.classList.toggle("oculto");
};

// ============================
// CERRAR PANEL AUTOMÁTICO EN MÓVIL
// ============================
function cerrarPanelEnMovil() {
  if (!esMovil()) return;

  const panel = document.getElementById("panel");
  const btn = document.querySelector(".btn-panel");

  panel.classList.add("oculto");
  btn.style.left = "10px";
}

// ============================
// PARSER WKT
// ============================
function parseWKT(wkt) {
  if (!wkt) return null;

  if (wkt.startsWith("POINT")) {
    const [lng, lat] = wkt
      .replace("POINT (", "")
      .replace(")", "")
      .split(" ")
      .map(Number);
    return {
      type: "POINT",
      coords: [lat, lng],
      iconoPunto: iconos,
    };
  }

  if (wkt.startsWith("LINESTRING")) {
    const coords = wkt
      .replace("LINESTRING (", "")
      .replace(")", "")
      .split(",")
      .map((p) => {
        const [lng, lat] = p.trim().split(" ").map(Number);
        return [lat, lng];
      });
    return { type: "LINESTRING", coords };
  }

  if (wkt.startsWith("POLYGON")) {
    const coords = wkt
      .replace("POLYGON ((", "")
      .replace("))", "")
      .split(",")
      .map((p) => {
        const [lng, lat] = p.trim().split(" ").map(Number);
        return [lat, lng];
      });
    return { type: "POLYGON", coords };
  }

  return null;
}

// ============================
// CARGA CSV
// ============================
Papa.parse("datos.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (results) {
    results.data.forEach((row) => {
      const wkt = row.WKT?.trim();
      const apartado = row.Apartado?.trim() || "Otros";
      const bloque = row.Bloque?.trim() || "Sin bloque";
      const NomCort = row.NomCort?.trim() || "Sin nombre corto";
      const nombreIcono = row.Icono?.trim() || "default";

      if (!wkt) return;
      const geom = parseWKT(wkt);
      if (!geom) return;

      if (!capas[apartado]) capas[apartado] = {};
if (!capas[apartado][bloque]) capas[apartado][bloque] = {};
if (!capas[apartado][bloque][NomCort])
  capas[apartado][bloque][NomCort] = L.layerGroup().addTo(map);

      let layer;
      if (geom.type === "POINT") {
        layer = L.marker(geom.coords, {
          icon: obtenerIcono(nombreIcono),
        }).bindPopup(
          `<b>${row.Nombre || ""}</b><br>${row.Descripción || ""}`,
        );
      }

      if (geom.type === "LINESTRING") {
  const colorLinea = nombreIcono || "#1f21b4ff"; // color por defecto

  layer = L.polyline(geom.coords, {
    color: colorLinea,
    weight: 4,
  }).bindPopup(`<b>${row.Nombre || ""}</b>`);
}


      if (geom.type === "POLYGON") {
  const colorPoligono = nombreIcono || "#ff9900"; // color base

  layer = L.polygon(geom.coords, {
    color: colorPoligono,          // borde
    fillColor: colorPoligono,      // relleno
    fillOpacity: 0.5,
    weight: 2,
  }).bindPopup(
    `<b>${row.Nombre || ""}</b><br>${row.Descripción || ""}`,
  );
}


      if (layer) {
        aplicarHover(layer, row); //
        layer.addTo(capas[apartado][bloque][NomCort]);
        capasGlobales.push(layer);
      }
    });

    construirLista();
    zoomAutomatico();
  },
});

function aplicarHover(layer, row) {
  const lat =
    row.Latitud ||
    layer.getLatLng?.()?.lat ||
    (layer.getBounds
      ? layer.getBounds().getCenter().lat
      : 0);

  const lng =
    row.Longitud ||
    layer.getLatLng?.()?.lng ||
    (layer.getBounds
      ? layer.getBounds().getCenter().lng
      : 0);

  // 🔹 Contenido COMPLETO (solo para click)
  const contenidoCompleto = `
    <div class="popup-contenido">
      <b>${row.Nombre || "Sin nombre"}</b><br>
      ${row.Descripción || ""}<br><br>
      <button class="btn-direcciones" onclick="abrirGoogleMaps(${lat}, ${lng})">
        🚗 Cómo llegar
      </button>
    </div>
  `;

  let popupFijado = false;

  // =========================
  // HOVER (popup simple)
  // =========================
  layer.on("mouseover", function () {
    if (!popupFijado) {
      if (layer.setStyle)
        layer.setStyle({ weight: 5, fillOpacity: 0.7 });
      this.openPopup();
    }
  });

  layer.on("mouseout", function () {
    if (!popupFijado) {
      if (layer.setStyle)
        layer.setStyle({ weight: 2, fillOpacity: 0.5 });
      this.closePopup();
    }
  });

  // =========================
  // CLICK (popup completo)
  // =========================
  layer.on("click", function () {
    popupFijado = true;

    // 🔹 Reemplazar contenido SOLO al hacer click
    this.setPopupContent(contenidoCompleto);

    if (layer.setStyle)
      layer.setStyle({ weight: 5, fillOpacity: 0.7 });
    this.openPopup();
  });

  // =========================
  // AL CERRAR → volver a simple
  // =========================
  layer.on("popupclose", function () {
    popupFijado = false;

    // Volver al contenido simple original
    this.setPopupContent(
      `<b>${row.Nombre || ""}</b><br>${row.Descripción || ""}`,
    );

    if (layer.setStyle)
      layer.setStyle({ weight: 2, fillOpacity: 0.5 });
  });

  // =========================
  // PANEL LATERAL (temporal)
  // =========================
  layer.abrirTemporal = function () {
    popupFijado = false;

    this.setPopupContent(contenidoCompleto);
    this.openPopup();

    const fg = L.featureGroup([layer]);
    map.fitBounds(fg.getBounds(), {
      padding: [40, 40],
      maxZoom: 17,
    });
  };
}

function abrirGoogleMaps(lat, lng) {
  if (!lat || !lng) {
    console.error("Coordenadas inválidas:", lat, lng);
    return;
  }

  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url, "_blank");
}

// ============================
// CONSTRUIR LISTA CON APARTADOS Y BLOQUES
// ============================
function construirLista() {
  lista.innerHTML = "";

  Object.keys(capas).forEach((apartado) => {
    const divApartado = document.createElement("div");
    divApartado.className = "bloque";

    const hApartado = document.createElement("h4");
    hApartado.textContent = apartado;
    divApartado.appendChild(hApartado);

    // 🔘 BOTÓN APARTADO
    const btnApartado = document.createElement("button");
    btnApartado.textContent = "Apagar todo";
    btnApartado.style.margin = "5px";
    divApartado.appendChild(btnApartado);

    btnApartado.addEventListener("click", () => {
      const apagar = btnApartado.textContent === "Apagar todo";

      Object.keys(capas[apartado]).forEach((bloque) => {
        Object.keys(capas[apartado][bloque]).forEach((sub) => {
          const grupo = capas[apartado][bloque][sub];

          if (apagar) {
            map.removeLayer(grupo);
          } else {
            grupo.addTo(map);
          }
        });
      });

      // actualizar checkboxes
      divApartado.querySelectorAll("input").forEach((chk) => {
        chk.checked = !apagar;
      });

      btnApartado.textContent = apagar
        ? "Encender todo"
        : "Apagar todo";
    });

    // 🔽 BLOQUES
    Object.keys(capas[apartado]).forEach((bloque) => {
      const divBloque = document.createElement("div");
      divBloque.className = "item";

      const labelBloque = document.createElement("span");
      labelBloque.textContent = bloque;
      labelBloque.style.fontWeight = "bold";

      divBloque.appendChild(labelBloque);

      // 🔽 SUBLISTA
      const subLista = document.createElement("div");
      subLista.style.marginLeft = "15px";

      Object.keys(capas[apartado][bloque]).forEach((sub) => {
        const grupo = capas[apartado][bloque][sub];

        const divSub = document.createElement("div");
        divSub.className = "item";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = true;

        chk.addEventListener("change", () => {
          chk.checked
            ? grupo.addTo(map)
            : map.removeLayer(grupo);
        });

        const label = document.createElement("span");
        label.textContent = sub;
        label.style.cursor = "pointer";

        // 🎯 CLICK → ZOOM + POPUP
        label.addEventListener("click", () => {
          const features = [];
          grupo.eachLayer((layer) => features.push(layer));

          if (!features.length) return;

          if (!map.hasLayer(grupo)) {
            grupo.addTo(map);
            chk.checked = true;
          }

          const fg = L.featureGroup(features);
          map.fitBounds(fg.getBounds(), {
            padding: [40, 40],
            maxZoom: 17,
          });

          if (features[0].abrirTemporal) {
            features[0].abrirTemporal();
          }

          if (window.innerWidth <= 768) cerrarPanel();
        });

        divSub.appendChild(chk);
        divSub.appendChild(label);
        subLista.appendChild(divSub);
      });

      divBloque.appendChild(subLista);
      divApartado.appendChild(divBloque);
    });

    lista.appendChild(divApartado);
  });
}
// ============================
// BOTÓN GENERAL (HTML)
// ============================
const btnGeneral = document.getElementById("btnGeneral");
btnGeneral.addEventListener("click", () => {
  const apagar =
    btnGeneral.textContent === "Apagar todo el mapa";

  Object.keys(capas).forEach((apartado) => {
    Object.keys(capas[apartado]).forEach((bloque) => {
      const grupo = capas[apartado][bloque];
      if (apagar) map.removeLayer(grupo);
      else grupo.addTo(map);

      const divItem = Array.from(
        document.querySelectorAll(".item"),
      ).find(
        (d) =>
          d.querySelector("span").textContent === bloque,
      );
      if (divItem)
        divItem.querySelector("input").checked = !apagar;
    });

    const btnApartado = controlesApartados[apartado];
    if (btnApartado)
      btnApartado.textContent = apagar
        ? "Encender todo"
        : "Apagar todo";
  });

  btnGeneral.textContent = apagar
    ? "Encender todo el mapa"
    : "Apagar todo el mapa";
});

// ============================
// ZOOM AUTOMÁTICO AL CARGAR
// ============================
function zoomAutomatico() {
  if (!capasGlobales.length) return;
  const grupo = L.featureGroup(capasGlobales);
  map.fitBounds(grupo.getBounds(), { padding: [30, 30] });
}
// ============================
// 🟦 Polígono del municipio de Ixtapaluca
// ============================

fetch("poligono_ixtapaluca.json")
  .then((res) => res.json())
  .then((geojson) => {
    const poligonoIxtapaluca = L.geoJSON(geojson, {
      style: {
        color: "#9D2449", // borde
        weight: 3,
        fillColor: "#9D2449", // relleno
        fillOpacity: 0.18,
      },
    }).addTo(map);

    // Enviar el polígono al fondo
    poligonoIxtapaluca.bringToBack();

    // Ajustar vista al polígono
    map.fitBounds(poligonoIxtapaluca.getBounds());
  })
  .catch((err) =>
    console.error(
      "Error cargando poligono_ixtapaluca.geojson:",
      err,
    ),
  );

function esMovil() {
  return window.innerWidth <= 768;
}
window.togglePanel = function () {
  const panel = document.getElementById("panel");
  panel.classList.toggle("oculto");
};

const panel = document.getElementById("panel");

panel.addEventListener("scroll", () => {
  const scroll = panel.scrollTop;
  const alpha = Math.min(0.85, 0.45 + scroll / 600);

  panel.style.background = `rgba(90, 20, 31, ${alpha})`;
});
btnGeneral.classList.add("boton-fijo");

const btnCentro = document.getElementById("btnCentroMapa");
btnCentro.addEventListener("click", () => {
  map.setView([19.35369, -98.79454], 12); // vuelve a la vista inicial
});
