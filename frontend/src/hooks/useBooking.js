import { useState, useCallback } from 'react'
import { bookingService } from '../services/bookingService'

export const useBooking = () => {
  const [state, setState] = useState({
    currentStep: 'search',
    sessionId: null,
    searchParams: null,
    availableRooms: [],
    selectedRoom: null,
    bookingResult: null,
    loading: null,
    error: null
  })

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const setLoading = useCallback((message) => {
    updateState({ loading: message, error: null })
  }, [updateState])

  const setError = useCallback((error) => {
    updateState({ loading: null, error })
  }, [updateState])

  const startSearch = useCallback(async (searchData) => {
    setLoading('Avvio ricerca disponibilità...')
    
    try {
      const response = await bookingService.startSearch(searchData)
      
      // Check if rooms are already available in the response
      const rooms = response.data?.rooms || []
      
      updateState({
        currentStep: 'rooms',
        sessionId: response.sessionId,
        searchParams: searchData,
        availableRooms: rooms,
        loading: rooms.length > 0 ? null : 'Analisi camere in corso...'
      })

      return response
    } catch (error) {
      setError(`Errore durante la ricerca: ${error.message}`)
      throw error
    }
  }, [setLoading, setError, updateState])

  const getRooms = useCallback(async () => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Estrazione camere disponibili...')

    try {
      const response = await bookingService.getAvailableRooms(state.sessionId)
      
      updateState({
        availableRooms: response.rooms || [],
        loading: null
      })

      if (!response.rooms || response.rooms.length === 0) {
        setError('Nessuna camera disponibile per le date selezionate')
      }

      return response
    } catch (error) {
      setError(`Errore nel recupero camere: ${error.message}`)
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  const selectRoom = useCallback(async (roomId, optionId = null) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Selezione camera in corso...')

    try {
      const response = await bookingService.selectRoom(state.sessionId, roomId, optionId)
      const room = state.availableRooms.find(r => r.id === roomId)

      updateState({
        selectedRoom: room,
        currentStep: 'personal-data', // First step: personal data
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore nella selezione camera: ${error.message}`)
      throw error
    }
  }, [state.sessionId, state.availableRooms, setLoading, setError, updateState])

  // Step 1: Fill personal data and click 'Continua'
  const fillPersonalData = useCallback(async (personalData) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Compilazione dati personali...')

    try {
      const response = await bookingService.fillPersonalData(state.sessionId, personalData)

      updateState({
        currentStep: 'payment', // Move to payment step
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore durante la compilazione: ${error.message}`)
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  // Step 2: Complete booking with payment data
  const completeBooking = useCallback(async (bookingData, testMode = false) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Completamento prenotazione...')

    try {
      const response = await bookingService.completeBooking(state.sessionId, bookingData, testMode)

      updateState({
        bookingResult: response,
        currentStep: 'result',
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore durante la prenotazione: ${error.message}`)
      
      // Still move to result step to show the error
      updateState({
        bookingResult: {
          success: false,
          message: error.message,
          error: error.message
        },
        currentStep: 'result',
        loading: null
      })
      
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  // Legacy method for backward compatibility
  const submitBooking = useCallback(async (room, personalData) => {
    if (!state.sessionId || !room) {
      setError('Dati mancanti per completare la prenotazione')
      return
    }

    setLoading('Invio dati di prenotazione...')

    try {
      const response = await bookingService.submitBooking(
        state.sessionId,
        room.id,
        personalData
      )

      updateState({
        bookingResult: response,
        currentStep: 'result',
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore durante la prenotazione: ${error.message}`)
      
      // Still move to result step to show the error
      updateState({
        bookingResult: {
          success: false,
          message: error.message,
          error: error.message
        },
        currentStep: 'result',
        loading: null
      })
      
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  const resetBooking = useCallback(() => {
    // Clean up session on backend if exists
    if (state.sessionId) {
      bookingService.cleanupSession(state.sessionId).catch(console.error)
    }

    setState({
      currentStep: 'search',
      sessionId: null,
      searchParams: null,
      availableRooms: [],
      selectedRoom: null,
      bookingResult: null,
      loading: null,
      error: null
    })
  }, [state.sessionId])

  const getSessionStatus = useCallback(async () => {
    if (!state.sessionId) return null

    try {
      const status = await bookingService.getSessionStatus(state.sessionId)
      return status
    } catch (error) {
      console.error('Error getting session status:', error)
      return null
    }
  }, [state.sessionId])

  return {
    // State
    ...state,
    
    // Actions
    startSearch,
    getRooms,
    selectRoom,
    fillPersonalData,
    completeBooking,
    submitBooking, // Legacy
    resetBooking,
    getSessionStatus,
    
    // Utilities
    setLoading,
    setError
  }
}
