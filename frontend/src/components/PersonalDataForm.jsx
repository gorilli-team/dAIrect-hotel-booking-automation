import React, { useState } from 'react'
import { User, Mail, ArrowLeft, Calendar, Users, Moon, MapPin, Tag, CreditCard } from 'lucide-react'

const PersonalDataForm = ({ room, searchParams, onSubmit, onBack, loading }) => {
  const [formData, setFormData] = useState({
    firstName: 'Prova',
    lastName: 'Takyon',
    email: 'arbi@gorilli.io',
    acceptNewsletter: false
  })

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Nome richiesto'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Cognome richiesto'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email richiesta'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email non valida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm() && !loading) {
      onSubmit(formData)
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

  return (
    <div className="card">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="mr-4 p-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold">Dati personali</h2>
      </div>

      {/* Dynamic Booking Summary - 3 Column Layout */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          La tua prenotazione
        </h3>
        
        {/* 3 Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Date & Stay Info */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center mb-3">
                <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Date soggiorno</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Check-in</span>
                  <p className="text-sm font-semibold text-gray-800">
                    {room.summaryStructured?.checkinDate || searchParams.checkinDate}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Check-out</span>
                  <p className="text-sm font-semibold text-gray-800">
                    {room.summaryStructured?.checkoutDate || searchParams.checkoutDate}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Moon className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Notti</span>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  {room.summaryStructured?.nights || '2'}
                </span>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Ospiti</span>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  {room.summaryStructured?.guests || `${searchParams.adults} Adulti`}
                </span>
              </div>
            </div>
          </div>
          
          {/* Column 2: Room & Rate Details */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <div className="flex items-center mb-3">
                <MapPin className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Camera selezionata</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 text-sm leading-tight">
                  {room.summaryStructured?.roomName || room.name}
                </h4>
                <p className="text-xs text-gray-600">
                  {room.summaryStructured?.occupants || `${searchParams.adults} Adulti`}
                </p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <div className="flex items-center mb-3">
                <Tag className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Tariffa & Trattamento</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-800 leading-tight">
                  {room.summaryStructured?.rateName || 'Tariffa selezionata'}
                </p>
                <p className="text-xs text-green-700 font-medium">
                  {room.summaryStructured?.mealPlan || 'Camera e Colazione'}
                </p>
                {room.summaryStructured?.refundability && (
                  <div className="flex items-center mt-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                    <span className="text-xs text-orange-700 font-medium">
                      {room.summaryStructured.refundability}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Column 3: Pricing Summary */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-purple-100">
              <div className="flex items-center mb-3">
                <CreditCard className="h-4 w-4 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Riepilogo prezzi</span>
              </div>
              
              <div className="space-y-3">
                {/* Room Price */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Camera</span>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-800">
                      {room.summaryStructured?.roomPriceFormatted || `€ ${room.price}`}
                    </div>
                    {room.summaryStructured?.originalRoomPriceFormatted && (
                      <div className="text-xs text-gray-500 line-through">
                        {room.summaryStructured.originalRoomPriceFormatted}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Mandatory Services */}
                {room.summaryStructured?.mandatoryServices?.length > 0 && (
                  <div className="border-t pt-2">
                    {room.summaryStructured.mandatoryServices.map((service, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">{service.name}</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {service.priceFormatted}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Taxes */}
                {room.summaryStructured?.taxes && (
                  <div className="text-xs text-gray-600 flex justify-between">
                    <span>{room.summaryStructured.taxes.description}</span>
                    <span>{room.summaryStructured.taxes.amountFormatted}</span>
                  </div>
                )}
                
                {/* Total */}
                <div className="border-t pt-2 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-800">Totale prenotazione</span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-700">
                        {room.summaryStructured?.totalPriceFormatted || `€ ${room.price}`}
                      </div>
                      {room.summaryStructured?.originalTotalPriceFormatted && (
                        <div className="text-xs text-gray-500 line-through">
                          {room.summaryStructured.originalTotalPriceFormatted}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Voucher Section */}
            {room.summaryStructured?.voucher?.available && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="flex items-center text-yellow-800">
                  <Tag className="h-4 w-4 mr-2" />
                  <span className="text-xs font-medium">Hai un voucher? Applicalo nel prossimo step!</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Raw HTML Fallback - Hidden by default, show if no structured data */}
        {!room.summaryStructured && room.summaryStructured?.sidebarHtml && (
          <details className="mt-4">
            <summary className="text-sm text-gray-600 cursor-pointer">Mostra dati prenotazione completi</summary>
            <div 
              className="mt-2 p-3 bg-gray-50 rounded border text-xs overflow-auto max-h-60"
              dangerouslySetInnerHTML={{ __html: room.summaryStructured.sidebarHtml }}
            />
          </details>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Completa i tuoi dati
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome *
              </label>
              <input
                type="text"
                className={`input-field ${errors.firstName ? 'border-red-500' : ''}`}
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="Mario"
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cognome *
              </label>
              <input
                type="text"
                className={`input-field ${errors.lastName ? 'border-red-500' : ''}`}
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Rossi"
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline h-4 w-4 mr-1" />
              Email *
            </label>
            <input
              type="email"
              className={`input-field ${errors.email ? 'border-red-500' : ''}`}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="mario.rossi@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conferma Email *
            </label>
            <input
              type="email"
              className="input-field"
              value={formData.email}
              placeholder="Reinserisci la tua email"
              readOnly
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              La conferma email verrà compilata automaticamente
            </p>
          </div>

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={formData.acceptNewsletter}
                onChange={(e) => handleChange('acceptNewsletter', e.target.checked)}
              />
              <span className="text-sm text-gray-600">
                Accetto di ricevere newsletter e offerte speciali
              </span>
            </label>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Step 1 di 2:</strong> Compila i tuoi dati personali per procedere al pagamento.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center space-x-2"
        >
          <span>{loading ? 'Elaborazione...' : 'Continua →'}</span>
        </button>
      </form>
    </div>
  )
}

export default PersonalDataForm
