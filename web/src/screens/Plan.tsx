import { useEffect, useMemo, useState } from "react"
import { GeoJSON, MapContainer, useMap } from "react-leaflet"
import type { GeoJsonObject, FeatureCollection } from "geojson"
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import "leaflet/dist/leaflet.css"
import { money, monthLabel } from "../lib/format"
import type { Bundle, SupplyEntry } from "../types"

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
  { key: "up", color: "#6cc057", label: "0 to +10%" },
  { key: "down", color: "#c9c9c3", label: "0 to -5%" },
  { key: "down5", color: "#525252", label: "-5%" },
]
const NONE = "#ececea"

function fill(change: number | null) {
  if (change == null) return NONE
  if (change >= 0.1) return SCALE[0].color
  if (change >= 0) return SCALE[1].color
  if (change > -0.05) return SCALE[2].color
  return SCALE[3].color
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
  return Math.round(value).toLocaleString("en-US")
}

function shift(value: number | null) {
  if (value == null) return null
  const change = Math.exp(value) - 1
  return `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change * 100))}%`
}

function SupplyLine({ season, entry, crop, t }: { season: string; entry: SupplyEntry | null; crop: "maize" | "beans"; t: (key: string, vars?: Record<string, string | number>) => string }) {
  if (!entry) return <li className="text-muted">{t("plan.notEnough")}</li>
  const amount = crop === "maize" ? entry.maize_tonnes : entry.beans_tonnes
  const change = shift(crop === "maize" ? entry.maize_anomaly : entry.beans_anomaly)
  return (
    <li className="num border-b border-hair py-1.5 last:border-0">
      {t("plan.supplyLine", { season, year: entry.year, amount: tonnes(amount) })}
      {change ? <span className={change.startsWith("+") ? "font-semibold text-grass-700" : "font-semibold text-loss"}> {t("plan.vsAverage", { change })}</span> : null}
    </li>
  )
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
  const path = forecast?.status === "ok" && forecast.price_now != null
    ? [
        { name: t("decide.now"), p50: forecast.price_now, band: [forecast.price_now, forecast.price_now] as [number, number] },
        ...Object.entries(forecast.horizons ?? {}).map(([key, item]) => ({
          name: t("decide.plusMonths", { months: key }),
          p50: Math.round(item.p50),
          band: [Math.round(item.p10), Math.round(item.p90)] as [number, number],
        })),
      ]
    : []
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
    <div className="px-4 pt-8">
      <h1 className="display px-1 text-[34px] leading-[1.02] tracking-[-0.02em]">
        {t("plan.title")}
        <span className="mt-1.5 block text-[24px] leading-[1.08] text-ghost">{t("plan.lead")}</span>
      </h1>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {(["maize", "beans"] as const).map((item) => (
          <button key={item} type="button" aria-pressed={crop === item} className="chip w-full" onClick={() => setCrop(item)}>
            {t(`decide.${item}`)}
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
            style={{ height: 300, width: "100%", borderRadius: 12, background: "#f1f8ec" }}
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
          <p className="p-4">{t("plan.notEnough")}</p>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 px-1 text-xs text-muted">
        {SCALE.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-[2px]" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[2px] border border-line" style={{ background: NONE }} />
          {t("plan.notEnough")}
        </span>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {DISTRICTS.map((name) => (
          <button key={name} type="button" aria-pressed={selected === name} className="chip shrink-0" onClick={() => setSelected(name)}>
            {name}
          </button>
        ))}
      </div>

      <section key={`${selected}-${crop}`} className="card rise-in mt-3 p-5">
        <p className="eyebrow">{t(`decide.${crop}`)} · {selected}</p>
        {change == null ? (
          <p className="mt-2 text-muted">{t("plan.notEnough")}</p>
        ) : (
          <p className={`display mt-2 text-[44px] leading-none ${change >= 0 ? "text-grass-700" : "text-ink"}`}>{`${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change * 100))}%`}</p>
        )}
        {forecast?.price_pooled ? <p className="mt-2 text-xs text-faint">{t("plan.province")}</p> : null}
        {path.length ? (
          <>
            <p className="eyebrow mt-5">{t("plan.path")}</p>
            <div className="mt-2 h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={path} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#737373" }} axisLine={{ stroke: "rgba(23,23,23,0.13)" }} tickLine={false} />
                  <YAxis width={40} tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip formatter={(value) => (Array.isArray(value) ? `${money(Number(value[0]))} to ${money(Number(value[1]))}` : money(Number(value)))} />
                  <Area dataKey="band" stroke="none" fill="#bfe3ae" fillOpacity={0.7} isAnimationActive={false} />
                  <Line dataKey="p50" stroke="#276b1f" strokeWidth={2.5} dot={{ r: 3, fill: "#276b1f" }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs leading-snug text-faint">{t("plan.pathNote", { month: monthLabel(forecast?.price_month ?? "") })}</p>
          </>
        ) : null}
        <p className="eyebrow mt-5">{t("plan.supply")}</p>
        {supply ? (
          <ul className="mt-1 text-sm">
            <SupplyLine season="A" entry={supply.A} crop={crop} t={t} />
            <SupplyLine season="B" entry={supply.B} crop={crop} t={t} />
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">{t("plan.notEnough")}</p>
        )}
        <p className="mt-3 text-xs leading-snug text-faint">{t("plan.anomaly")}</p>
      </section>
    </div>
  )
}
