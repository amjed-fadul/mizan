import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../move.css'
import MapPlaceholder from '../MapPlaceholder'
import RideCard from '../RideCard'
import ActionButton from '../ActionButton'
import Fare from '../Fare'
import PrimaryButton from '../../market/PrimaryButton'

var RIDE_OPTIONS = [
  {
    id: 'economy',
    vehicle: 'Toyota Yaris',
    rideType: 'economy',
    etaMinutes: 3,
    fare: 24,
    seats: 4
  },
  {
    id: 'comfort',
    vehicle: 'Toyota Camry',
    rideType: 'comfort',
    etaMinutes: 5,
    fare: 38,
    surcharge: 6,
    seats: 4
  },
  {
    id: 'xl',
    vehicle: 'Hyundai Staria',
    rideType: 'xl',
    etaMinutes: 9,
    fare: 57,
    seats: 6
  },
  {
    id: 'electric',
    vehicle: 'Tesla Model 3',
    rideType: 'electric',
    etaMinutes: 7,
    fare: 45,
    seats: 4
  }
]

var PICKUP = 'Dubai Marina, Tower 5'
var DROPOFF = 'Dubai International Airport, Terminal 3'

export default function BookingScreen() {
  var navigate = useNavigate()
  var [selectedId, setSelectedId] = useState('economy')

  var selected = RIDE_OPTIONS[0]
  RIDE_OPTIONS.forEach(function (option) {
    if (option.id === selectedId) {
      selected = option
    }
  })

  return (
    <div className="container">
      <div className="mv-screen-nav">
        <Link to="/">Home</Link> | <Link to="/move">Book a Ride</Link> |{' '}
        <Link to="/move/trip">Active Trip</Link> | <Link to="/market">Mizan Market</Link>
      </div>

      <h1>Book a Ride</h1>

      <MapPlaceholder pickup={PICKUP} dropoff={DROPOFF} etaMinutes={selected.etaMinutes} />

      <div className="mv-field">
        <span className="mv-field__label">Pickup</span>
        <span className="mv-field__value">{PICKUP}</span>
      </div>

      <div className="mv-field">
        <span className="mv-field__label">Dropoff</span>
        <span className="mv-field__value">{DROPOFF}</span>
      </div>

      <div className="mv-section-title" style={{ fontSize: '18px', marginBottom: '7px' }}>
        Choose a ride
      </div>

      <div className="mv-option-list">
        {RIDE_OPTIONS.map(function (option) {
          return (
            <RideCard
              key={option.id}
              vehicle={option.vehicle}
              rideType={option.rideType}
              etaMinutes={option.etaMinutes}
              fare={option.fare}
              surcharge={option.surcharge}
              seats={option.seats}
              selected={option.id === selectedId}
              onSelect={() => setSelectedId(option.id)}
            />
          )
        })}
      </div>

      <div className="mv-summary">
        <div className="mv-summary__row">
          <span className="mv-summary__label">Ride</span>
          <span>{selected.vehicle}</span>
        </div>
        <div className="mv-summary__row">
          <span className="mv-summary__label">Payment</span>
          <span style={{ color: '#2e2e2e' }}>Visa ending 4412</span>
          <div
            onClick={() => setSelectedId('economy')}
            style={{
              display: 'inline-block',
              fontSize: '13px',
              color: '#767676',
              marginLeft: '13px',
              cursor: 'pointer'
            }}
          >
            Reset
          </div>
        </div>
        <div className="mv-summary__row">
          <span className="mv-summary__label">Estimated fare</span>
          <Fare
            amount={selected.fare}
            surcharge={selected.surcharge}
            caption="Toll and parking charges are added at the end of the trip"
          />
        </div>
      </div>

      <ActionButton onClick={() => navigate('/move/trip')}>
        {'Confirm ' + selected.vehicle}
      </ActionButton>
      <ActionButton kind="ghost">Change Payment Method</ActionButton>
      <PrimaryButton variant="secondary" size="md">
        Schedule for Later
      </PrimaryButton>
      <div style={{ marginTop: '26px', fontSize: '13px', color: '#767676' }}>
        Fares are estimates and may change with traffic.
      </div>
    </div>
  )
}
