// Line pictures for crops, storage and the steps of the method, drawn on a
// 24 grid with a 1.75 stroke so they sit with the nav icons.

type Props = { className?: string }

function Pic({ className = "size-7", children }: Props & { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  )
}

export const MaizePic = (props: Props) => (
  <Pic {...props}>
    <path d="M12 3c2.6 0 4.2 3.5 4.2 8S14.6 20 12 20s-4.2-4.5-4.2-9S9.4 3 12 3z" />
    <path d="M12 4.5v14M8.4 8h7.2M8 12h8M8.4 16h7.2" />
    <path d="M7.8 13.5C5.6 14.4 4.6 17 5 21c1.8-.8 3.2-2.2 3.8-4M16.2 13.5c2.2.9 3.2 3.5 2.8 7.5-1.8-.8-3.2-2.2-3.8-4" />
  </Pic>
)

export const BeansPic = (props: Props) => (
  <Pic {...props}>
    <ellipse cx="8.5" cy="8.5" rx="4.6" ry="3.1" transform="rotate(-28 8.5 8.5)" />
    <ellipse cx="15.8" cy="12.2" rx="4.6" ry="3.1" transform="rotate(22 15.8 12.2)" />
    <ellipse cx="9.2" cy="16.6" rx="4.2" ry="2.8" transform="rotate(-8 9.2 16.6)" />
    <path d="M7.6 8.9c.6-.3 1.2-.7 1.6-1.3M15 11.9c.6.2 1.3.6 1.7 1.1M8.4 16.9c.6 0 1.3-.2 1.8-.5" />
  </Pic>
)

export const SackPic = (props: Props) => (
  <Pic {...props}>
    <path d="M9 3.5h6l-1.2 3h-3.6L9 3.5z" />
    <path d="M10.2 6.5C6.5 8.4 4.5 12 4.5 15.5c0 3.2 2.8 5 7.5 5s7.5-1.8 7.5-5c0-3.5-2-7.1-5.7-9" />
  </Pic>
)

export const SealedSackPic = (props: Props) => (
  <Pic {...props}>
    <path d="M9 3.5h6l-1.2 3h-3.6L9 3.5z" />
    <path d="M10.2 6.5C6.5 8.4 4.5 12 4.5 15.5c0 3.2 2.8 5 7.5 5s7.5-1.8 7.5-5c0-3.5-2-7.1-5.7-9" />
    <rect x="9.25" y="13" width="5.5" height="4.5" rx="1" />
    <path d="M10.5 13v-1.2a1.5 1.5 0 0 1 3 0V13" />
  </Pic>
)

export const WarehousePic = (props: Props) => (
  <Pic {...props}>
    <path d="M3 10 12 4l9 6v10H3V10z" />
    <path d="M8.5 20v-6h7v6M8.5 16.5h7" />
  </Pic>
)

export const PricesPic = (props: Props) => (
  <Pic {...props}>
    <path d="M4 19h16" />
    <path d="M5 15l4-4 3 2.5L19 7" />
    <path d="M15 7h4v4" />
  </Pic>
)

export const CostsPic = (props: Props) => (
  <Pic {...props}>
    <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" />
    <path d="M5.5 6.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5M5.5 11.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
  </Pic>
)

export const AnswerPic = (props: Props) => (
  <Pic {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.2 12.3l2.5 2.5 5.1-5.3" />
  </Pic>
)

export const BackPic = (props: Props) => (
  <Pic {...props}>
    <path d="M14.5 6 8.5 12l6 6" />
  </Pic>
)
