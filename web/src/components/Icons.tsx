// Line icons for the nav, drawn on a 24 grid with a 1.75 stroke.

type Props = { className?: string }

function Icon({ className = "size-5", children }: Props & { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  )
}

export const DecideIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M12 4v16M7 20h10M5 8h14" />
    <path d="M5 8l-2.5 6a3 3 0 0 0 5 0L5 8zM19 8l-2.5 6a3 3 0 0 0 5 0L19 8z" />
  </Icon>
)

export const ShareIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
    <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Icon>
)

export const PlanIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z" />
    <path d="M9 4v14M15 6v14" />
  </Icon>
)

export const ProofIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 20h16" />
    <path d="M7 16v-4M12 16V7M17 16v-6" />
  </Icon>
)

export const AboutIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
)

export const Dot = ({ tone }: { tone: "good" | "bad" | "warn" | "neutral" }) => {
  const color = tone === "good" ? "bg-grass-500" : tone === "bad" ? "bg-loss" : tone === "warn" ? "bg-warn" : "bg-ghost"
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-[2px] ${color}`} />
}
