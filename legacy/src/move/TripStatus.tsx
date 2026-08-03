import './move.css'

type TripStatusProps = {
  status: string
  note?: string
  driverName?: string
}

const TRIP_LABELS = {
  searching: 'Searching for a driver',
  'driver-assigned': 'Driver assigned',
  arriving: 'Driver is arriving',
  waiting: 'Driver is waiting for you',
  'in-trip': 'On the way',
  completed: 'Trip completed',
  cancelled: 'Trip cancelled'
}

export default function TripStatus({ status, note, driverName }: TripStatusProps) {
  var label = TRIP_LABELS[status]
  var dotClass = 'mv-trip__dot mv-trip__dot--' + status

  if (!label) {
    label = 'Updating trip'
    dotClass = 'mv-trip__dot mv-trip__dot--unknown'
  }

  if (driverName && status === 'driver-assigned') {
    label = driverName + ' is on the way'
  }

  return (
    <div className="mv-trip">
      <span className={dotClass}></span>
      <span className="mv-trip__label">{label}</span>
      {note ? <span className="mv-trip__note">{note}</span> : null}
    </div>
  )
}
