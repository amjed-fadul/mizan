import './move.css'

type MapPlaceholderProps = {
  pickup?: string
  dropoff?: string
  etaMinutes?: number
}

export default function MapPlaceholder({ pickup, dropoff, etaMinutes }: MapPlaceholderProps) {
  return (
    <div className="mv-map" style={{ height: '260px' }}>
      <div className="mv-map__badge">{etaMinutes ? etaMinutes + ' min' : 'Live'}</div>
      <div className="mv-map__recenter">Recenter</div>
      <div className="mv-map__pin"></div>
      <div className="mv-map__label">Map</div>
      <div className="mv-map__footer">
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '5px' }}>
          {'Pickup: ' + (pickup ? pickup : 'Current location')}
        </div>
        <div>{'Dropoff: ' + (dropoff ? dropoff : 'Set a destination')}</div>
      </div>
    </div>
  )
}
