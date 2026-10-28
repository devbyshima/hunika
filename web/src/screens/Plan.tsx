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
  return Math.round(value).toLocaleString("en-US")
}

function shift(value: number | null) {
  if (value == null) return null
  const change = Math.exp(value) - 1
  return `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change * 100))}%`
}

function SupplyLine({ season, entry, crop, t }: { season: string; entry: SupplyEntry | null; crop: "maize" | "beans"; t: (key: string, vars?: Record<string, string | number>) => string }) {
  if (!entry) return <li>{t("plan.notEnough")}</li>
  const amount = crop === "maize" ? entry.maize_tonnes : entry.beans_tonnes
  const change = shift(crop === "maize" ? entry.maize_anomaly : entry.beans_anomaly)
  return (
    <li>
      {t("plan.supplyLine", { season, year: entry.year, amount: tonnes(amount) })}
      {change ? <span className={change.startsWith("+") ? "text-[#14532d]" : "text-[#9a3412]"}> {t("plan.vsAverage", { change })}</span> : null}
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
        {path.length ? (
          <>
            <h3 className="mt-4 text-sm font-semibold">{t("plan.path")}</h3>
            <div className="mt-1 h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={path} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis width={40} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip formatter={(value) => (Array.isArray(value) ? `${money(Number(value[0]))}–${money(Number(value[1]))}` : money(Number(value)))} />
                  <Area dataKey="band" stroke="none" fill="#c4a574" fillOpacity={0.45} isAnimationActive={false} />
                  <Line dataKey="p50" stroke="#14532d" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs leading-snug text-[#5c564c]">{t("plan.pathNote", { month: monthLabel(forecast?.price_month ?? "") })}</p>
          </>
        ) : null}
        <h3 className="mt-4 text-sm font-semibold">{t("plan.supply")}</h3>
        {supply ? (
          <ul className="mt-1 text-sm leading-6">
            <SupplyLine season="A" entry={supply.A} crop={crop} t={t} />
            <SupplyLine season="B" entry={supply.B} crop={crop} t={t} />
          </ul>
        ) : (
          <p className="mt-1 text-sm">{t("plan.notEnough")}</p>
        )}
        <p className="mt-2 text-xs leading-snug text-[#5c564c]">{t("plan.anomaly")}</p>
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
