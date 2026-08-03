import './move.css'
import Fare from './Fare'

type RideCardProps = {
  vehicle: string
  rideType: string
  etaMinutes: number
  fare: number
  surcharge?: number
  seats: number
  selected?: boolean
  onSelect?: () => void
}

const RIDE_TYPE_LABELS = {
  economy: 'Economy',
  comfort: 'Comfort',
  xl: 'XL',
  electric: 'Electric'
}

export default function RideCard({
  vehicle,
  rideType,
  etaMinutes,
  fare,
  surcharge,
  seats,
  selected,
  onSelect
}: RideCardProps) {
  var className = 'mv-card'
  if (selected) {
    className = 'mv-card mv-card--selected'
  }

  var typeLabel = RIDE_TYPE_LABELS[rideType]
  if (!typeLabel) {
    typeLabel = rideType
  }

  var seatsText = seats + ' seats'
  if (seats === 1) {
    seatsText = '1 seat'
  }

  return (
    <div className={className} onClick={onSelect}>
      <div className="mv-card__top">
        {selected ? <span className="mv-card__check">Selected</span> : null}
        <span className="mv-card__vehicle">{vehicle}</span>
        <span className="mv-card__type">{typeLabel}</span>
      </div>
      <div className="mv-card__row">
        <span className="mv-card__eta">{etaMinutes + ' min away'}</span>
        <span className="mv-card__seats">{seatsText}</span>
      </div>
      <div className="mv-card__row">
        <Fare amount={fare} estimate={true} surcharge={surcharge} />
      </div>
      {surcharge ? <div className="mv-card__note">Higher demand in your area right now</div> : null}
    </div>
  )
}
