import React, { useState } from 'react'
import { Phone, CreditCard, ArrowLeft } from 'lucide-react'

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

      {/* Room Summary */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Camera selezionata:</h3>
        <p className="text-blue-800">
          <strong>{room.name}</strong> - {room.price} {room.currency}/notte
        </p>
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

