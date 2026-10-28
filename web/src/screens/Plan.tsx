import { useEffect, useMemo, useState } from "react"
import { GeoJSON, MapContainer, useMap } from "react-leaflet"
import type { GeoJsonObject, FeatureCollection } from "geojson"
import "leaflet/dist/leaflet.css"
import { ChangeBar, Spark } from "../components/Charts"
import { BeansPic, MaizePic } from "../components/Illustrations"
import type { Bundle, SupplyEntry } from "../types"

type T = (key: string, vars?: Record<string, string | number>) => string

const DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]

function changeFor(bundle: Bundle, district: string, crop: "maize" | "beans") {
  const forecast = bundle.forecasts.districts[district]?.[crop]
  if (!forecast || forecast.status !== "ok" || forecast.price_now == null) return null
  const likely = forecast.horizons?.["3"]?.p50
  if (likely == null) return null
  return likely / forecast.price_now - 1
}

// Rises in grass green, falls in greys.
const SCALE = [
  { key: "up10", color: "#276b1f", label: "+10%" },
  { key: "up", color: "#6cc057", label: "+" },
  { key: "down", color: "#c9c9c3", label: "−" },
  { key: "down5", color: "#525252", label: "−5%" },
]
const NONE = "#ececea"

function fill(change: number | null) {
  if (change == null) return NONE
  if (change >= 0.1) return SCALE[0].color
  if (change >= 0) return SCALE[1].color
  if (change > -0.05) return SCALE[2].color
  return SCALE[3].color
}

function percent(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value * 100))}%`
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

function Harvest({ season, entry, crop }: { season: string; entry: SupplyEntry | null; crop: "maize" | "beans" }) {
  const anomaly = entry ? (crop === "maize" ? entry.maize_anomaly : entry.beans_anomaly) : null
  if (!entry || anomaly == null) return null
  const change = Math.exp(anomaly) - 1
  return (
    <div className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-[13px]">
      <span className="text-muted">
        {season} {entry.year}
      </span>
      <ChangeBar value={change} />
      <span className={`num text-right font-semibold ${change >= 0 ? "text-grass-700" : "text-muted"}`}>{percent(change)}</span>
    </div>
  )
}

export default function Plan({ bundle, t }: { bundle: Bundle; t: T }) {
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
        color: active ? "#171717" : "#ffffff",
        weight: active ? 2.5 : 1.25,
        fillColor: fill(changeFor(bundle, name, crop)),
        fillOpacity: 0.92,
      }
    },
    [bundle, crop, selected],
  )

  return (
    <div className="px-4 pt-7 pb-3">
      <h1 className="display px-1 text-[30px] leading-[1.05]">{t("plan.title")}</h1>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {([["maize", MaizePic], ["beans", BeansPic]] as const).map(([id, Pic]) => (
          <button key={id} type="button" aria-pressed={crop === id} className="chip w-full" onClick={() => setCrop(id)}>
            <Pic className="size-5" />
            {t(`decide.${id}`)}
          </button>
        ))}
      </div>

      <div className="card mt-3 overflow-hidden p-1.5">
        {geo ? (
          <MapContainer
            center={[-1.85, 30.45]}
            zoom={8}
            scrollWheelZoom={false}
            attributionControl={false}
            zoomControl={false}
            style={{ height: 280, width: "100%", borderRadius: 12, background: "#f1f8ec" }}
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
          <p className="font-body p-4 text-muted">{t("plan.notEnough")}</p>
        )}
        <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[11px] text-faint">
          <span>{t("plan.legend")}</span>
          <span className="flex items-center gap-1">
            {[...SCALE].reverse().map((item) => (
              <span key={item.key} className="flex flex-col items-center gap-0.5">
                <i className="block h-2 w-7 rounded-sm" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </span>
        </div>
      </div>

      <p className="font-body mt-4 px-1 text-[13px] text-muted">{t("plan.tap")}</p>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {DISTRICTS.map((name) => (
          <button key={name} type="button" aria-pressed={selected === name} className="chip shrink-0" onClick={() => setSelected(name)}>
            {name}
          </button>
        ))}
      </div>

      <section key={`${selected}-${crop}`} className="card rise-in mt-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[17px] font-semibold">{selected}</p>
          {change == null ? (
            <p className="font-body text-muted">{t("plan.notEnough")}</p>
          ) : (
            <p className={`display num text-[34px] leading-none ${change >= 0 ? "text-grass-700" : "text-ink"}`}>{percent(change)}</p>
          )}
        </div>
        <p className="font-body mt-1 text-right text-[11px] text-faint">{t("plan.lead")}</p>

        {forecast?.status === "ok" && forecast.price_now != null ? (
          <div className="mt-2">
            <Spark
              mark={3}
              points={[
                { label: t("decide.now"), p10: forecast.price_now, p50: forecast.price_now, p90: forecast.price_now },
                ...Object.entries(forecast.horizons ?? {}).map(([key, item]) => ({ label: t("decide.plusMonths", { months: key }), p10: item.p10, p50: item.p50, p90: item.p90 })),
              ]}
            />
          </div>
        ) : null}

        {supply && (supply.A || supply.B) ? (
          <>
            <p className="eyebrow mt-5">{t("plan.supply")}</p>
            <div className="mt-2 grid gap-2">
              <Harvest season="A" entry={supply.A} crop={crop} />
              <Harvest season="B" entry={supply.B} crop={crop} />
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
