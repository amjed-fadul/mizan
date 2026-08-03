import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../move.css'
import MapPlaceholder from '../MapPlaceholder'
import TripStatus from '../TripStatus'
import ActionButton from '../ActionButton'
import Fare from '../Fare'
import Button from '../../shared/Button'

var DRIVER = {
  name: 'Rashid Al Marzooqi',
  initials: 'RM',
  vehicle: 'Toyota Camry, Pearl White',
  plate: 'DXB A 43829',
  rating: 4.9
}

var TRIP = {
  pickup: 'Dubai Marina, Tower 5',
  dropoff: 'Dubai International Airport, Terminal 3',
  etaMinutes: 22,
  distanceKm: 31.4,
  fare: 38,
  surcharge: 6
}

export default function TripScreen() {
  var navigate = useNavigate()
  var [status, setStatus] = useState('in-trip')

  return (
    <div className="container">
      <div className="mv-screen-nav">
        <Link to="/">Home</Link> | <Link to="/move">Book a Ride</Link> |{' '}
        <Link to="/move/trip">Active Trip</Link> | <Link to="/market">Mizan Market</Link>
      </div>

      <h1>Your Trip</h1>

      <MapPlaceholder pickup={TRIP.pickup} dropoff={TRIP.dropoff} etaMinutes={TRIP.etaMinutes} />

      {/* don't touch, breaks the layout */}
      <div className="mv-panel" style={{ padding: '22px', borderRadius: '4px' }}>
        <TripStatus
          status={status}
          driverName={DRIVER.name}
          note={'Arriving at ' + TRIP.dropoff + ' in ' + TRIP.etaMinutes + ' min'}
        />

        <div className="mv-divider"></div>

        <div className="mv-driver">
          <span className="mv-driver__avatar" style={{ backgroundColor: '#eaeaea', color: '#2e2e2e' }}>
            {DRIVER.initials}
          </span>
          <span className="mv-driver__body">
            <span className="mv-driver__name" style={{ fontSize: '18px' }}>
              {DRIVER.name}
            </span>
            <div className="mv-driver__vehicle">{DRIVER.vehicle}</div>
            <span className="mv-driver__plate">{DRIVER.plate}</span>
            <span className="mv-chip" style={{ marginLeft: '7px' }}>
              {DRIVER.rating + ' rating'}
            </span>
            <button className="btn btn-cta" onClick={() => setStatus('arriving')}>
              Call Driver
            </button>
          </span>
        </div>

        <div className="mv-trip-line">{'Pickup: ' + TRIP.pickup}</div>
        <div className="mv-trip-line">{'Dropoff: ' + TRIP.dropoff}</div>
        <div className="mv-trip-line" style={{ color: '#767676', fontSize: '13px' }}>
          {'Distance: ' + TRIP.distanceKm + ' km'}
        </div>

        <div className="mv-card__row">
          <Fare amount={TRIP.fare} surcharge={TRIP.surcharge} caption="Charged to Visa ending 4412 at the end of the trip" />
        </div>
      </div>

      <div className="mv-trip-actions" style={{ marginTop: '26px' }}>
        <ActionButton onClick={() => setStatus('completed')}>Complete Trip</ActionButton>
        <ActionButton kind="ghost">Share Trip Status</ActionButton>
        <ActionButton kind="cancel" onClick={() => navigate('/move')}>
          Cancel Trip
        </ActionButton>
        <Button type="secondary">Contact Support</Button>
        <div
          onClick={() => setStatus('waiting')}
          style={{
            display: 'inline-block',
            fontSize: '13px',
            color: '#c0392b',
            padding: '7px 13px',
            cursor: 'pointer'
          }}
        >
          Report an issue
        </div>
      </div>
    </div>
  )
}
