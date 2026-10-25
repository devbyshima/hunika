import { useEffect, useMemo, useState } from "react"
import { GeoJSON, MapContainer, useMap } from "react-leaflet"
import type { GeoJsonObject, FeatureCollection } from "geojson"
import "leaflet/dist/leaflet.css"
import type { Bundle } from "../types"

const DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]

function changeFor(bundle: Bundle, district: string, crop: "maize" | "beans") {
  const forecast = bundle.forecasts.districts[district]?.[crop]
  if (!forecast || forecast.status !== "ok" || forecast.price_now == null) return null
  const likely = forecast.horizons?.["3"]?.p50
  if (likely == null) return null
  return likely / forecast.price_now - 1
}

function fill(change: number | null) {
  if (change == null) return "#d6d3cb"
  if (change >= 0.1) return "#14532d"
  if (change >= 0) return "#4d7c54"
  if (change > -0.05) return "#c4a574"
  return "#9a3412"
}

function Fit({ data }: { data: FeatureCollection }) {
  const map = useMap()
  useEffect(() => {
    const bounds = (awaitBounds(data))
    if (bounds) map.fitBounds(bounds, { padding: [12, 12] })
  }, [data, map])
  return null
}

function awaitBounds(data: FeatureCollection): [[number, number], [number, number]] | null {
  let minLat = 90
  let maxLat = -90
  let minLon = 180
  let maxLon = -180
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const lon = coords[0]
      const lat = coords[1]
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLon = Math.min(minLon, lon)
      maxLon = Math.max(maxLon, lon)
      return
    }
    for (const child of coords) walk(child)
  }
  for (const feature of data.features) walk(feature.geometry)
  if (minLat > maxLat) return null
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ]
}

function tonnes(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
}

export default function Plan({
  bundle,
  t,
}: {
  bundle: Bundle
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const [crop, setCrop] = useState<"maize" | "beans">("maize")
  const [geo, setGeo] = useState<FeatureCollection | null>(null)
  const [selected, setSelected] = useState("Kayonza")

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/districts.geojson`)
      .then((response) => response.json())
      .then((data: FeatureCollection) => setGeo(data))
      .catch(() => setGeo(null))
  }, [])

  const change = changeFor(bundle, selected, crop)
  const forecast = bundle.forecasts.districts[selected]?.[crop]
  const supply = bundle.supply.districts[selected]
  const style = useMemo(
    () => (feature?: { properties?: { shapeName?: string } }) => {
      const name = feature?.properties?.shapeName || ""
      const active = name === selected
      return {
        color: active ? "#1c1915" : "#f4efe6",
        weight: active ? 2.5 : 1,
        fillColor: fill(changeFor(bundle, name, crop)),
        fillOpacity: 0.92,
      }
    },
    [bundle, crop, selected],
  )

  return (
    <div className="px-4 pt-5">
      <h1 className="ledger text-3xl text-[#14532d]">{t("plan.title")}</h1>
      <p className="mt-2 text-sm leading-snug">{t("plan.lead")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["maize", "beans"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-12 rounded-xl font-semibold ${crop === item ? "bg-[#14532d] text-white" : "bg-white"}`}
            onClick={() => setCrop(item)}
          >
            {t(`decide.${item}`)}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl">
        {geo ? (
          <MapContainer
            center={[-1.85, 30.45]}
            zoom={8}
            scrollWheelZoom={false}
            attributionControl={false}
            style={{ height: 320, width: "100%", background: "#e7e0d2" }}
          >
            <Fit data={geo} />
            <GeoJSON
              key={`${crop}-${selected}`}
              data={geo as GeoJsonObject}
              style={style}
              onEachFeature={(feature, layer) => {
                const name = feature.properties?.shapeName as string
                layer.on({ click: () => setSelected(name) })
              }}
            />
          </MapContainer>
        ) : (
          <p className="bg-white p-4">{t("plan.notEnough")}</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 bg-[#14532d]" /> +10%</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 bg-[#4d7c54]" /> 0–10%</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 bg-[#c4a574]" /> −5–0%</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 bg-[#9a3412]" /> −5%</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 bg-[#d6d3cb]" /> {t("plan.notEnough")}</span>
      </div>
      <section className="mt-4 rounded-3xl bg-white p-4">
        <h2 className="text-xl font-semibold">{selected}</h2>
        {change == null ? (
          <p className="mt-2">{t("plan.notEnough")}</p>
        ) : (
          <p className="ledger mt-2 text-3xl">{`${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`}</p>
        )}
        {forecast?.price_pooled ? <p className="mt-2 text-sm">{t("plan.province")}</p> : null}
        <h3 className="mt-4 text-sm font-semibold">{t("plan.supply")}</h3>
        {supply ? (
          <ul className="mt-1 text-sm leading-6">
            {(["A", "B"] as const).map((season) => (
              <li key={season}>
                {season} · {t("plan.maize", { amount: tonnes(supply[season]?.maize_tonnes ?? 0) })} · {t("plan.beans", { amount: tonnes(supply[season]?.beans_tonnes ?? 0) })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm">{t("plan.notEnough")}</p>
        )}
        <p className="mt-3 text-sm leading-snug">{t("plan.anomaly")}</p>
      </section>
      <div className="mt-3 flex flex-wrap gap-2">
        {DISTRICTS.map((name) => (
          <button key={name} type="button" className={`min-h-11 rounded-full px-3 text-sm ${selected === name ? "bg-[#14532d] text-white" : "bg-white"}`} onClick={() => setSelected(name)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
