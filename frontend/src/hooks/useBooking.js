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

  const selectRoom = useCallback(async (roomId) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Selezione camera in corso...')

    try {
      const response = await bookingService.selectRoom(state.sessionId, roomId)
      const room = state.availableRooms.find(r => r.id === roomId)

      updateState({
        selectedRoom: room,
        currentStep: 'booking',
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore nella selezione camera: ${error.message}`)
      throw error
    }
  }, [state.sessionId, state.availableRooms, setLoading, setError, updateState])

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
    submitBooking,
    resetBooking,
    getSessionStatus,
    
    // Utilities
    setLoading,
    setError
  }
}
