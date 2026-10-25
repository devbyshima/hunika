export type Horizon = {
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

export type Bundle = {
  forecasts: {
    decision_date: string
    cpi: { index_month: string; published_on: string; trailing_12m_inflation: number }
    districts: Record<string, Record<string, CropForecast>>
  }
  assumptions: { items: Assumption[] }
  backtest: {
    net_gain_rwf_per_tonne: number | null
    net_blocked_reason: string
    coverage: { crop: string; district: string; horizon: number; n: number; inside: number; share: number }[]
    price_only_before_storage_costs: {
      mean_real_follow_rwf_per_tonne: number | null
      losing_count: number
      losing_seasons: { crop: string; district: string; season: string; year: number; real_follow_rwf_per_tonne: number }[]
    } | null
  }
  supply: {
    anomaly_reason: string
    districts: Record<string, Record<string, { maize_tonnes: number; beans_tonnes: number }>>
  }
}
