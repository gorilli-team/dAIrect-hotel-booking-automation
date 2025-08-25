import React, { useState } from 'react'
import { Phone, CreditCard, ArrowLeft, Calendar, Users, Moon, MapPin, Tag } from 'lucide-react'

const PaymentForm = ({ room, onSubmit, onBack, loading }) => {
  const [formData, setFormData] = useState({
    phone: '3246987461',
    cardNumber: '4444333322221111',
    expiryMonth: '06',
    expiryYear: '2027',
    cardHolder: 'Prova Takyon' // Campo titolare carta richiesto
  })

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefono richiesto'
    }

    if (!formData.cardNumber.trim()) {
      newErrors.cardNumber = 'Numero carta richiesto'
    } else if (formData.cardNumber.replace(/\s/g, '').length !== 16) {
      newErrors.cardNumber = 'Numero carta deve essere di 16 cifre'
    }

    if (!formData.cardHolder.trim()) {
      newErrors.cardHolder = 'Titolare carta richiesto'
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

  const formatCardNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    // Add spaces every 4 digits
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
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
        <h2 className="text-2xl font-bold">Dati di pagamento</h2>
      </div>

      {/* Dynamic Booking Summary - 3 Column Layout */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-green-600" />
          Riepilogo della tua prenotazione
        </h3>
        
        {/* 3 Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Date & Stay Info */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <div className="flex items-center mb-3">
                <Calendar className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Date soggiorno</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Check-in</span>
                  <p className="text-sm font-semibold text-gray-800">
                    {room.summaryStructured?.checkinDate || 'Data da confermare'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Check-out</span>
                  <p className="text-sm font-semibold text-gray-800">
                    {room.summaryStructured?.checkoutDate || 'Data da confermare'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Moon className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Notti</span>
                </div>
                <span className="text-lg font-bold text-green-700">
                  {room.summaryStructured?.nights || '2'}
                </span>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Ospiti</span>
                </div>
                <span className="text-lg font-bold text-green-700">
                  {room.summaryStructured?.guests || room.summaryStructured?.occupants || '2 Adulti'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Column 2: Room & Rate Details */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center mb-3">
                <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Camera selezionata</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 text-sm leading-tight">
                  {room.summaryStructured?.roomName || room.name}
                </h4>
                <p className="text-xs text-gray-600">
                  {room.summaryStructured?.occupants || '2 Adulti'}
                </p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center mb-3">
                <Tag className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Tariffa & Trattamento</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-800 leading-tight">
                  {room.summaryStructured?.rateName || 'Tariffa selezionata'}
                </p>
                <p className="text-xs text-blue-700 font-medium">
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
            <div className="bg-white p-4 rounded-lg border border-emerald-100">
              <div className="flex items-center mb-3">
                <CreditCard className="h-4 w-4 text-emerald-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Importo da pagare</span>
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
                <div className="border-t-2 border-emerald-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-800">Totale da pagare</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-emerald-700">
                        {room.summaryStructured?.totalPriceFormatted || `€ ${room.price}`}
                      </div>
                      {room.summaryStructured?.originalTotalPriceFormatted && (
                        <div className="text-xs text-gray-500 line-through">
                          {room.summaryStructured.originalTotalPriceFormatted}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Savings indicator */}
                  {room.summaryStructured?.originalTotalPrice && room.summaryStructured?.totalPrice && (
                    <div className="mt-2 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Risparmi €{(room.summaryStructured.originalTotalPrice - room.summaryStructured.totalPrice).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Voucher Section */}
            {room.summaryStructured?.voucher?.available && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="flex items-center text-yellow-800">
                  <Tag className="h-4 w-4 mr-2" />
                  <span className="text-xs font-medium">Hai un voucher da applicare?</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Payment Security Notice */}
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center mb-2">
            <CreditCard className="h-4 w-4 text-green-600 mr-2" />
            <span className="text-sm font-medium text-green-800">Pagamento sicuro</span>
          </div>
          <p className="text-xs text-green-700">
            I tuoi dati di pagamento sono protetti da crittografia SSL. Il pagamento sarà elaborato in modo sicuro.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Phone className="h-5 w-5 mr-2" />
            Numero di telefono
          </h3>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline h-4 w-4 mr-1" />
              Telefono *
            </label>
            <input
              type="tel"
              className={`input-field ${errors.phone ? 'border-red-500' : ''}`}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+39 123 456 7890"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Payment Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Dettagli della carta
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numero carta *
            </label>
            <input
              type="text"
              className={`input-field ${errors.cardNumber ? 'border-red-500' : ''}`}
              value={formatCardNumber(formData.cardNumber)}
              onChange={(e) => handleChange('cardNumber', e.target.value.replace(/\s/g, ''))}
              placeholder="4111 1111 1111 1111"
              maxLength="19"
            />
            {errors.cardNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mese scadenza *
              </label>
              <select
                className="input-field"
                value={formData.expiryMonth}
                onChange={(e) => handleChange('expiryMonth', e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = (i + 1).toString().padStart(2, '0')
                  return (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anno scadenza *
              </label>
              <select
                className="input-field"
                value={formData.expiryYear}
                onChange={(e) => handleChange('expiryYear', e.target.value)}
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const year = (new Date().getFullYear() + i).toString()
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titolare carta *
            </label>
            <input
              type="text"
              className={`input-field ${errors.cardHolder ? 'border-red-500' : ''}`}
              value={formData.cardHolder}
              onChange={(e) => handleChange('cardHolder', e.target.value)}
              placeholder="Mario Rossi"
            />
            {errors.cardHolder && (
              <p className="text-red-500 text-sm mt-1">{errors.cardHolder}</p>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-600">
            Procedendo con il pagamento, confermi di accettare i termini e le condizioni dell'hotel.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center space-x-2"
        >
          <CreditCard className="h-5 w-5" />
          <span>{loading ? 'Elaborazione...' : 'Completa pagamento'}</span>
        </button>
      </form>
    </div>
  )
}

export default PaymentForm

