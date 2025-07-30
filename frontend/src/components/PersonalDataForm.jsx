import React, { useState } from 'react'
import { User, Mail, ArrowLeft } from 'lucide-react'

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

      {/* Room Summary */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Camera selezionata:</h3>
        <p className="text-blue-800">
          <strong>{room.name}</strong> - {room.price} {room.currency}/notte
        </p>
        <p className="text-sm text-blue-600 mt-1">
          Check-in: {searchParams.checkinDate} | Check-out: {searchParams.checkoutDate}
        </p>
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
