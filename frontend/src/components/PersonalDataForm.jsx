import React, { useEffect, useState } from 'react'
import { User, Mail, ArrowLeft, Calendar, Moon, Users, Tag, CreditCard, CheckCircle, XCircle } from 'lucide-react'

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

  useEffect(() => {
    // Add comprehensive CSS normalization for imported summary HTML
    const styleId = 'personal-summary-scope-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.innerHTML = `
        /* Reset and normalize imported HTML */
        .personal-summary-scope {
          font-family: inherit !important;
          line-height: 1.5 !important;
          font-size: 0.875rem !important;
        }
        
        .personal-summary-scope * {
          font-family: inherit !important;
          line-height: 1.5 !important;
          box-sizing: border-box !important;
          position: relative !important;
        }
        
        /* ==== RESERVATION SUMMARY SECTION ==== */
        
        /* Main reservation container - horizontal layout */
        .personal-summary-scope .ReservationSummary {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
          border-radius: 12px !important;
          padding: 1.5rem !important;
          border: 1px solid #e0f2fe !important;
        }
        
        /* Date selection container - horizontal layout */
        .personal-summary-scope .e1dfdjmq9 {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 1rem !important;
          margin-bottom: 1rem !important;
        }
        
        /* Individual date blocks - modern cards */
        .personal-summary-scope .e1dfdjmq8 {
          background: white !important;
          border-radius: 12px !important;
          padding: 1rem !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
          border: 1px solid #e5e7eb !important;
          text-align: center !important;
          min-width: 80px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        
        /* Day names (venerdì, domenica) */
        .personal-summary-scope .e1dfdjmq1 {
          color: #6b7280 !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin: 0 !important;
        }
        
        /* Day numbers (6, 8) */
        .personal-summary-scope .e1dfdjmq6 {
          color: #111827 !important;
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          margin: 0.25rem 0 !important;
        }
        
        /* Month/year (feb 2026) */
        .personal-summary-scope .e1dfdjmq5 {
          color: #374151 !important;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }
        
        /* Arrow between dates */
        .personal-summary-scope .e1dfdjmq7 {
          display: flex !important;
          align-items: center !important;
          color: #6b7280 !important;
        }
        
        /* Stats section (notti, ospiti) */
        .personal-summary-scope .e1dfdjmq2 {
          display: flex !important;
          flex-direction: row !important;
          justify-content: center !important;
          gap: 2rem !important;
          margin-top: 1rem !important;
        }
        
        /* Individual stat items */
        .personal-summary-scope .e1dfdjmq3 {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          background: white !important;
          padding: 0.75rem 1rem !important;
          border-radius: 8px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        }
        
        /* Labels (Notti, Ospiti) */
        .personal-summary-scope .label {
          background: #dbeafe !important;
          color: #1e40af !important;
          padding: 0.25rem 0.5rem !important;
          border-radius: 4px !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin-bottom: 0.5rem !important;
        }
        
        /* Stat icons and text */
        .personal-summary-scope .IconAndText {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
        }
        
        .personal-summary-scope .IconAndText__Text {
          font-size: 1.125rem !important;
          font-weight: 700 !important;
          color: #111827 !important;
        }
        
        /* ==== CART SECTION ==== */
        
        /* Cart title */
        .personal-summary-scope .Cart__Title {
          font-weight: 700 !important;
          font-size: 1.125rem !important;
          color: #111827 !important;
          margin: 0 0 1rem 0 !important;
        }
        
        /* Main cart room container */
        .personal-summary-scope .Cart__Room,
        .personal-summary-scope .e104199m1 {
          background: linear-gradient(135deg, #fefefe 0%, #f8fafc 100%) !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          padding: 1.5rem !important;
          margin: 1rem 0 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
        }
        
        /* Room header section */
        .personal-summary-scope .e1t20bug2 {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 1rem !important;
        }
        
        /* Room info section */
        .personal-summary-scope .e1m2olwc5 {
          display: flex !important;
          align-items: center !important;
          gap: 1rem !important;
          flex: 1 !important;
        }
        
        /* Room number badge */
        .personal-summary-scope .e1m2olwc3 {
          background: #3b82f6 !important;
          color: white !important;
          border-radius: 50% !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-weight: 700 !important;
          font-size: 0.875rem !important;
        }
        
        /* Room name button */
        .personal-summary-scope .Cart__Room__Name {
          background: none !important;
          border: none !important;
          color: #111827 !important;
          font-weight: 700 !important;
          font-size: 1rem !important;
          text-align: left !important;
          padding: 0 !important;
          cursor: default !important;
          margin-bottom: 0.25rem !important;
        }
        
        /* Occupants text */
        .personal-summary-scope .e1m2olwc0 {
          color: #6b7280 !important;
          font-size: 0.875rem !important;
          margin: 0 !important;
        }
        
        /* Rate and meal plan section */
        .personal-summary-scope .e13o920w5 .Cart__Room__Rate {
          background: #dbeafe !important;
          color: #1e40af !important;
          border: none !important;
          padding: 0.375rem 0.75rem !important;
          border-radius: 6px !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          margin-right: 0.5rem !important;
          cursor: default !important;
        }
        
        .personal-summary-scope .e13o920w5 .Cart__Room__MealPlan {
          background: #fef3c7 !important;
          color: #92400e !important;
          border: none !important;
          padding: 0.375rem 0.75rem !important;
          border-radius: 6px !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          cursor: default !important;
        }
        
        /* Refundability section */
        .personal-summary-scope .e13o920w4 {
          color: #dc2626 !important;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          margin: 0.5rem 0 !important;
        }
        
        /* Price section */
        .personal-summary-scope .Prices {
          text-align: right !important;
          margin-left: 1rem !important;
        }
        
        .personal-summary-scope .mainAmount {
          font-weight: 800 !important;
          color: #111827 !important;
          font-size: 1.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        
        .personal-summary-scope .decimals {
          font-size: 1.125rem !important;
        }
        
        .personal-summary-scope .discount .originalAmount {
          color: #9ca3af !important;
          font-size: 0.875rem !important;
          text-decoration: line-through !important;
          margin-right: 0.5rem !important;
        }
        
        .personal-summary-scope .discount:last-child {
          color: #16a34a !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          text-decoration: none !important;
        }
        
        /* Mandatory services section */
        .personal-summary-scope .mandatoryServicesHeading {
          font-weight: 600 !important;
          color: #374151 !important;
          font-size: 1rem !important;
          margin: 1.5rem 0 0.5rem 0 !important;
        }
        
        .personal-summary-scope .Cart__MandatoryServicesList {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          padding: 1rem !important;
          margin: 0.5rem 0 !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }
        
        .personal-summary-scope .CartServiceItem {
          background: none !important;
          border: none !important;
          color: #374151 !important;
          font-weight: 500 !important;
          padding: 0 !important;
          cursor: default !important;
        }
        
        /* Cart totals */
        .personal-summary-scope .Cart__Totals {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important;
          border: 1px solid #bbf7d0 !important;
          border-radius: 12px !important;
          padding: 1.5rem !important;
          margin-top: 1rem !important;
        }
        
        .personal-summary-scope .e1risg602 {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }
        
        .personal-summary-scope .e1risg600 {
          font-weight: 700 !important;
          font-size: 1.125rem !important;
          color: #111827 !important;
          margin: 0 !important;
        }
        
        .personal-summary-scope .Cart__Totals .mainAmount {
          font-weight: 800 !important;
          color: #16a34a !important;
          font-size: 1.75rem !important;
        }
        
        .personal-summary-scope .Cart__Totals .discount {
          color: #16a34a !important;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
        }
        
        /* Hide unnecessary spans and dividers */
        .personal-summary-scope span[style*="height"],
        .personal-summary-scope span[style*="width"],
        .personal-summary-scope .ltr-13ghssl,
        .personal-summary-scope .ltr-1f7p61g {
          display: none !important;
        }
        
        /* General layout improvements */
        .personal-summary-scope div {
          display: flex;
          flex-direction: column;
        }
        
        /* SVG icons styling */
        .personal-summary-scope svg {
          width: 1rem !important;
          height: 1rem !important;
          color: #6b7280 !important;
        }
      `
      document.head.appendChild(style)
    }
  }, [])

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

      {/* Modern booking summary with structured data */}
      <div className="mb-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            Riepilogo prenotazione
          </h3>
        </div>

        {/* Main booking info in horizontal layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Dates & Duration */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center text-blue-600 mb-3">
              <Calendar className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Date soggiorno</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Check-in</span>
                <span className="text-sm font-medium text-gray-900">
                  {room.summaryStructured?.checkin || searchParams.checkinDate}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Check-out</span>
                <span className="text-sm font-medium text-gray-900">
                  {room.summaryStructured?.checkout || searchParams.checkoutDate}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-600">
                    <Moon className="w-4 h-4 mr-1" />
                    <span className="text-sm">{room.summaryStructured?.nights || '2'} notti</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="text-sm">{room.summaryStructured?.guests || `${searchParams.adults} ospiti`}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Room & Rate */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center text-indigo-600 mb-3">
              <Tag className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Camera e tariffa</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  {room.summaryStructured?.roomName || "Suite con Balcone DELUXE"}
                </div>
                <div className="text-xs text-gray-500">
                  {room.summaryStructured?.occupants || "2 Adulti"}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-medium">
                  {room.summaryStructured?.rateName || "Pre-paga solo 1 notte e risparmia"}
                </div>
                <div className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium ml-2">
                  {room.summaryStructured?.mealPlan || "Camera e Colazione"}
                </div>
              </div>
              
              <div className="flex items-center text-xs">
                <XCircle className="w-3 h-3 text-red-500 mr-1" />
                <span className="text-gray-600">
                  {room.summaryStructured?.refundability || "Non rimborsabile"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Payment & Services */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center text-purple-600 mb-3">
              <CreditCard className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Costi dettagliati</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Totale soggiorno</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">
                    {room.summaryStructured?.roomAmountFormatted || "€1.834,43"}
                  </span>
                  <div className="text-xs text-gray-400 line-through">
                    {room.summaryStructured?.originalRoomAmount || "€2.658,60"}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Tasse incluse</span>
                <span className="text-gray-700">
                  {room.summaryStructured?.taxesAmountFormatted || "€166,77"}
                </span>
              </div>
              
              <div className="pt-3 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-700 mb-2">Servizi obbligatori</div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">
                      {room.summaryStructured?.mandatoryServices?.[0]?.name || "Tassa di Soggiorno"}
                    </span>
                    <span className="text-gray-700 font-medium">
                      {room.summaryStructured?.mandatoryServices?.[0]?.priceFormatted || "€14"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="pt-3 border-t border-gray-200 bg-green-50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-800">Totale prenotazione</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-green-800">
                      {room.summaryStructured?.totalAmountFormatted || "€1.848,43"}
                    </span>
                    <div className="text-xs text-green-600 line-through">
                      {room.summaryStructured?.originalTotalAmount || "€2.672,60"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-green-600 mt-1">Tasse incluse</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="mt-6 flex items-center justify-center">
          <div className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-4 py-2 text-sm font-medium">
            <CheckCircle className="w-4 h-4 mr-2" />
            Camera selezionata e confermata
          </div>
        </div>
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
