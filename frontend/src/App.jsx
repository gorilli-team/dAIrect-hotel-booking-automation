import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import SearchForm from './components/SearchForm'
import RoomSelection from './components/RoomSelection'
import BookingForm from './components/BookingForm'
import PersonalDataForm from './components/PersonalDataForm'
import PaymentForm from './components/PaymentForm'
import BookingResult from './components/BookingResult'
import Header from './components/Header'
import StepIndicator from './components/StepIndicator'
import LoadingOverlay from './components/LoadingOverlay'
import { useBooking } from './hooks/useBooking'
import toast from 'react-hot-toast'

function App() {
  const {
    currentStep,
    sessionId,
    searchParams,
    availableRooms,
    selectedRoom,
    bookingResult,
    loading,
    error,
    startSearch,
    getRooms,
    selectRoom,
    fillPersonalData,
    completeBooking,
    submitBooking,
    resetBooking
  } = useBooking()

  const steps = [
    { id: 'search', title: 'Ricerca', description: 'Date e ospiti' },
    { id: 'rooms', title: 'Camere', description: 'Selezione camera' },
    { id: 'personal-data', title: 'Dati personali', description: 'Nome, email' },
    { id: 'payment', title: 'Pagamento', description: 'Telefono, carta' },
    { id: 'result', title: 'Risultato', description: 'Conferma finale' }
  ]

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep)
  }

  const handleSearch = async (searchData) => {
    try {
      const result = await startSearch(searchData)
      if (result.success) {
        const roomsCount = result.data?.rooms?.length || 0
        if (roomsCount > 0) {
          toast.success(`Trovate ${roomsCount} camere disponibili!`)
        } else {
          // Fallback: try to get rooms if not immediately available
          setTimeout(() => {
            getRooms()
          }, 2000)
          toast.success('Ricerca avviata con successo!')
        }
      }
    } catch (err) {
      toast.error('Errore durante la ricerca: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  const handleRoomSelect = async (roomId) => {
    try {
      const result = await selectRoom(roomId)
      if (result.success) {
        toast.success('Camera selezionata!')
      }
    } catch (err) {
      toast.error('Errore nella selezione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  const handleBookingSubmit = async (personalData) => {
    try {
      const result = await submitBooking(selectedRoom, personalData)
      if (result.success) {
        toast.success('Prenotazione completata!')
      } else {
        toast.error(result.message || 'Errore nella prenotazione')
      }
    } catch (err) {
      toast.error('Errore durante la prenotazione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  const handleReset = () => {
    resetBooking()
    toast.success('Sessione resettata')
  }

  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onReset={handleReset} />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator 
            steps={steps} 
            currentStepIndex={getCurrentStepIndex()} 
          />
        </div>

        {/* Loading Overlay */}
        {loading && <LoadingOverlay message={loading} />}

        {/* Content based on current step */}
        <div className="relative">
          {currentStep === 'search' && (
            <SearchForm 
              onSearch={handleSearch}
              loading={loading}
              initialData={searchParams}
            />
          )}

          {currentStep === 'rooms' && (
            <RoomSelection
              rooms={availableRooms}
              loading={loading}
              onSelectRoom={handleRoomSelect}
              onBack={() => window.history.back()}
            />
          )}

          {currentStep === 'personal-data' && selectedRoom && (
            <PersonalDataForm
              room={selectedRoom}
              searchParams={searchParams}
              onSubmit={fillPersonalData}
              onBack={() => window.history.back()}
              loading={loading}
            />
          )}

          {currentStep === 'payment' && selectedRoom && (
            <PaymentForm
              room={selectedRoom}
              searchParams={searchParams}
              onSubmit={completeBooking}
              onBack={() => window.history.back()}
              loading={loading}
            />
          )}

          {currentStep === 'result' && (
            <BookingResult
              result={bookingResult}
              searchParams={searchParams}
              selectedRoom={selectedRoom}
              onNewSearch={handleReset}
            />
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="card bg-red-50 border border-red-200">
              <div className="text-center">
                <div className="text-red-600 text-xl font-semibold mb-2">
                  ⚠️ Errore
                </div>
                <p className="text-red-700 mb-4">{error}</p>
                <button 
                  onClick={handleReset}
                  className="btn-primary"
                >
                  Ricomincia
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <strong>Debug Info:</strong>
            <br />Step: {currentStep} | Session: {sessionId} | Rooms: {availableRooms?.length || 0}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
