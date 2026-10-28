export type Horizon = {
  ratio_p10: number
  ratio_p50: number
  ratio_p90: number
  p10: number
  p50: number
  p90: number
  n: number
  n_up: number
  years: number
}

export type MarketPrice = { name: string; km: number; price: number; month: string }

export type CropForecast = {
  status: string
  price_now?: number
  price_month?: string
  price_date?: string
  stale_days?: number
  stale?: boolean
  price_pooled?: boolean
  own_price?: boolean
  pattern_last_year?: string
  horizons?: Record<string, Horizon>
  nearest_markets?: MarketPrice[]
}

export type Assumption = {
  id: string
  label: string
  option: string | null
  field: string
  value: number | null
  unit: string
  status: string
  source: string
  url?: string | null
}

export type NetStats = {
  n_decisions: number
  store_count: number
  mean_gain_rwf_per_tonne: number
  p10_gain_rwf_per_tonne: number
  p90_gain_rwf_per_tonne: number
  min_gain_rwf_per_tonne: number
  max_gain_rwf_per_tonne: number
  share_not_worse_than_selling: number
  losing_count: number
  mean_gain_when_stored_rwf_per_tonne: number | null
  share_stored_losing: number | null
  mean_store_4_when_sell_rwf_per_tonne: number | null
  share_store_4_losing_when_sell: number | null
  mean_always_store_4_rwf_per_tonne: number | null
  share_always_store_4_losing: number | null
  worst: { crop: string; district: string; season: string; year: number; gain_rwf_per_tonne: number }
}

export type ModelScore = {
  model: string
  rows_all: number
  coverage_all: number
  coverage_raw_all: number
  rows_compared: number
  pinball_mean: number | null
  coverage_compared: number | null
}

export type SupplyEntry = {
  year: number
  published_on: string
  maize_tonnes: number
  beans_tonnes: number
  maize_anomaly: number | null
  beans_anomaly: number | null
  history: { year: number; maize_tonnes: number; beans_tonnes: number }[]
}

export type Bundle = {
  forecasts: {
    decision_date: string
    decision_month: string
    inflation: number
    cpi: { index_month: string; published_on: string; trailing_12m_inflation: number }
    districts: Record<string, Record<string, CropForecast>>
  }
  assumptions: { items: Assumption[] }
  backtest: {
    lot_kg: number
    francs: string
    years: string | null
    sensitivity?: { case: string; label: string; option: string; n_decisions: number; store_count: number; mean_gain_rwf_per_tonne: number; share_not_worse_than_selling: number }[]
    headline: (NetStats & { model: string; option: string }) | null
    unpriced_options: string[]
    net: (NetStats & { model: string; option: string; n_compared: number; mean_gain_compared_rwf_per_tonne: number | null })[]
    net_by_crop: (NetStats & { model: string; option: string; crop: string })[]
    net_by_district: (NetStats & { model: string; option: string; district: string })[]
    seasons: { crop: string; season: string; year: number; gain_rwf_per_tonne: number }[]
    losing_seasons: { crop: string; district: string; season: string; year: number; horizon: number; gain_rwf_per_tonne: number }[]
    coverage: { crop: string; district: string; horizon: number; n: number; inside: number; share: number }[]
    models: ModelScore[]
  }
  supply: {
    first_anomaly_year: number | null
    districts: Record<string, { A: SupplyEntry | null; B: SupplyEntry | null }>
    rwanda: { A: SupplyEntry | null; B: SupplyEntry | null }
    rain_check: { crop: string; season: string; n: number; years: string; correlation: number }[]
    ahs?: {
      weighted_households: number
      sample_households: number
      median_harvest_kg: Record<string, Record<string, number>>
      cooperative_member: number
      cooperative_storage: number
      cooperative_markets: number
      loan_requested: number
      loan_for_food: number | null
    }
  }
}
