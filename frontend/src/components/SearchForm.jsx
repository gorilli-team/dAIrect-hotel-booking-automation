import React, { useState, useEffect } from 'react'
import { Calendar, Users, Search, Hotel, MapPin } from 'lucide-react'
import moment from 'moment'

// Hotel configuration
const HOTELS = [
  {
    id: 'palazzo-vitturi',
    name: 'Palazzo Vitturi',
    location: 'Venezia',
    emoji: '🏛️',
    baseUrl: 'https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR',
    description: 'Elegante palazzo storico nel cuore di Venezia'
  },
  {
    id: 'hotel-niccolo-v',
    name: 'Hotel Niccolò V 4S - Terme dei Papi',
    location: 'Viterbo',
    emoji: '🌿',
    baseUrl: 'https://www.simplebooking.it/ibe2/hotel/7304?lang=IT&cur=EUR',
    description: 'Hotel 4 stelle superiore con centro benessere termale'
  },
  {
    id: 'castello-san-marco',
    name: 'Castello San Marco Charming Hotel & SPA',
    location: 'Calatabiano (CT)',
    emoji: '🏰',
    baseUrl: 'https://www.simplebooking.it/ibe2/hotel/10118?lang=IT&cur=EUR',
    description: 'Resort di charme con SPA ai piedi dell\'Etna'
  }
];

const SearchForm = ({ onSearch, loading, initialData }) => {
  const [formData, setFormData] = useState({
    hotel: HOTELS[0], // Default to first hotel
    checkinDate: '',
    checkoutDate: '',
    adults: 2,
    children: 0
  })

  const [errors, setErrors] = useState({})

  // Set default dates on mount
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      // Use preset test dates for faster testing
      setFormData(prev => ({
        ...prev,
        checkinDate: '2026-02-06',
        checkoutDate: '2026-02-08'
      }))
    }
  }, [initialData])

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.checkinDate) {
      newErrors.checkinDate = 'Data check-in richiesta'
    }
    
    if (!formData.checkoutDate) {
      newErrors.checkoutDate = 'Data check-out richiesta'
    }
    
    if (formData.checkinDate && formData.checkoutDate) {
      const checkin = moment(formData.checkinDate)
      const checkout = moment(formData.checkoutDate)
      
      if (checkin.isBefore(moment(), 'day')) {
        newErrors.checkinDate = 'La data di check-in non può essere nel passato'
      }
      
      if (checkout.isSameOrBefore(checkin)) {
        newErrors.checkoutDate = 'La data di check-out deve essere successiva al check-in'
      }
    }
    
    if (formData.adults < 1 || formData.adults > 6) {
      newErrors.adults = 'Numero adulti deve essere tra 1 e 6'
    }
    
    if (formData.children < 0 || formData.children > 4) {
      newErrors.children = 'Numero bambini deve essere tra 0 e 4'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (validateForm() && !loading) {
      onSearch(formData)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const getDaysDifference = () => {
    if (formData.checkinDate && formData.checkoutDate) {
      const checkin = moment(formData.checkinDate)
      const checkout = moment(formData.checkoutDate)
      return checkout.diff(checkin, 'days')
    }
    return 0
  }

  return (
    <div className="card">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {formData.hotel.emoji} {formData.hotel.name}
        </h2>
        <p className="text-gray-600 flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4" />
          {formData.hotel.location} • Automazione SimpleBooking avanzata
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hotel Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            <Hotel className="inline h-4 w-4 mr-1" />
            Seleziona Hotel
          </label>
          <div className="grid gap-3">
            {HOTELS.map((hotel) => (
              <div
                key={hotel.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.hotel.id === hotel.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleChange('hotel', hotel)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{hotel.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{hotel.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {hotel.location}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">{hotel.description}</p>
                  </div>
                  {formData.hotel.id === hotel.id && (
                    <div className="text-blue-500">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Date Section */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Check-in
            </label>
            <input
              type="date"
              className={`input-field ${errors.checkinDate ? 'border-red-500' : ''}`}
              value={formData.checkinDate}
              onChange={(e) => handleChange('checkinDate', e.target.value)}
              min={moment().format('YYYY-MM-DD')}
            />
            {errors.checkinDate && (
              <p className="text-red-500 text-sm mt-1">{errors.checkinDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Check-out
            </label>
            <input
              type="date"
              className={`input-field ${errors.checkoutDate ? 'border-red-500' : ''}`}
              value={formData.checkoutDate}
              onChange={(e) => handleChange('checkoutDate', e.target.value)}
              min={formData.checkinDate || moment().format('YYYY-MM-DD')}
            />
            {errors.checkoutDate && (
              <p className="text-red-500 text-sm mt-1">{errors.checkoutDate}</p>
            )}
          </div>
        </div>

        {/* Guests Section */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Adulti
            </label>
            <select
              className={`input-field ${errors.adults ? 'border-red-500' : ''}`}
              value={formData.adults}
              onChange={(e) => handleChange('adults', parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num} adult{num > 1 ? 'i' : 'o'}</option>
              ))}
            </select>
            {errors.adults && (
              <p className="text-red-500 text-sm mt-1">{errors.adults}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Bambini
            </label>
            <select
              className={`input-field ${errors.children ? 'border-red-500' : ''}`}
              value={formData.children}
              onChange={(e) => handleChange('children', parseInt(e.target.value))}
            >
              {[0, 1, 2, 3, 4].map(num => (
                <option key={num} value={num}>
                  {num === 0 ? 'Nessuno' : `${num} bambin${num > 1 ? 'i' : 'o'}`}
                </option>
              ))}
            </select>
            {errors.children && (
              <p className="text-red-500 text-sm mt-1">{errors.children}</p>
            )}
          </div>
        </div>

        {/* Summary */}
        {getDaysDifference() > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Riepilogo:</strong> {getDaysDifference()} nott{getDaysDifference() > 1 ? 'i' : 'e'} per{' '}
              {formData.adults + formData.children} person{formData.adults + formData.children > 1 ? 'e' : 'a'}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center space-x-2"
        >
          <Search className="h-5 w-5" />
          <span>{loading ? 'Ricerca in corso...' : 'Avvia Automazione'}</span>
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">Come funziona:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>🎯 <strong>Playwright</strong> automatizza la navigazione</li>
          <li>📊 Estrae camere disponibili e prezzi</li>
          <li>💳 Simula la prenotazione (carta di test)</li>
          <li>🔧 Sistema avanzato di automazione web</li>
        </ul>
      </div>
    </div>
  )
}

export default SearchForm
