import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api/booking',
  timeout: 120000, // 2 minutes timeout for long operations
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`)
    return response.data
  },
  (error) => {
    console.error('❌ Response Error:', error)
    
    const message = error.response?.data?.message 
      || error.response?.data?.error 
      || error.message 
      || 'Errore di connessione'
    
    throw new Error(message)
  }
)

export const bookingService = {
  /**
   * Start hotel availability search
   * @param {Object} searchData - Search parameters
   * @param {string} searchData.checkinDate - Check-in date (YYYY-MM-DD)
   * @param {string} searchData.checkoutDate - Check-out date (YYYY-MM-DD)
   * @param {number} searchData.adults - Number of adults
   * @param {number} searchData.children - Number of children
   * @returns {Promise<Object>} Search result with sessionId
   */
  async startSearch(searchData) {
    try {
      const response = await api.post('/start-search', {
        checkinDate: searchData.checkinDate,
        checkoutDate: searchData.checkoutDate,
        adults: parseInt(searchData.adults),
        children: parseInt(searchData.children) || 0
      })
      
      return response
    } catch (error) {
      console.error('Error starting search:', error)
      throw error
    }
  },

  /**
   * Get available rooms for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Available rooms data
   */
  async getAvailableRooms(sessionId) {
    try {
      const response = await api.get(`/available-rooms/${sessionId}`)
      return response
    } catch (error) {
      console.error('Error getting available rooms:', error)
      throw error
    }
  },

  /**
   * Select a specific room
   * @param {string} sessionId - Session identifier
   * @param {string} roomId - Room identifier
   * @returns {Promise<Object>} Selection result
   */
  async selectRoom(sessionId, roomId) {
    try {
      const response = await api.post('/select-room', {
        sessionId,
        roomId
      })
      
      return response
    } catch (error) {
      console.error('Error selecting room:', error)
      throw error
    }
  },

  /**
   * Fill personal data on the booking form
   * @param {string} sessionId - Session identifier
   * @param {Object} personalData - Personal data only
   * @returns {Promise<Object>} Fill result
   */
  async fillPersonalData(sessionId, personalData) {
    try {
      const response = await api.post('/fill-personal-data', {
        sessionId,
        personalData: {
          firstName: personalData.firstName,
          lastName: personalData.lastName,
          email: personalData.email,
          acceptNewsletter: personalData.acceptNewsletter || false
        }
      })
      
      return response
    } catch (error) {
      console.error('Error filling personal data:', error)
      throw error
    }
  },

  /**
   * Complete booking with payment data
   * @param {string} sessionId - Session identifier
   * @param {Object} bookingData - Complete booking data including payment
   * @param {boolean} testMode - Whether to run in test mode (default: false for real payments)
   * @returns {Promise<Object>} Booking result
   */
  async completeBooking(sessionId, bookingData, testMode = false) {
    try {
      const response = await api.post('/complete-booking', {
        sessionId,
        bookingData: {
          email: bookingData.email,
          phone: bookingData.phone,
          paymentMethod: 'credit_card',
          cardNumber: bookingData.cardNumber?.replace(/\s/g, ''), // Remove spaces
          cardExpiry: bookingData.cardExpiry,
          cardHolder: bookingData.cardHolder, // Campo titolare carta richiesto
          acceptNewsletter: bookingData.acceptNewsletter || false
        },
        testMode
      })
      
      return response
    } catch (error) {
      console.error('Error completing booking:', error)
      throw error
    }
  },

  /**
   * Submit booking with personal data (DEPRECATED - use fillPersonalData + completeBooking instead)
   * @param {string} sessionId - Session identifier
   * @param {string} roomId - Selected room identifier
   * @param {Object} personalData - Personal and payment information
   * @returns {Promise<Object>} Booking result
   */
  async submitBooking(sessionId, roomId, personalData) {
    try {
      // Step 1: Fill personal data
      console.log('🔄 Step 1: Filling personal data...')
      const personalDataResult = await this.fillPersonalData(sessionId, personalData)
      
      if (!personalDataResult.success) {
        throw new Error('Failed to fill personal data')
      }
      
      // Step 2: Complete booking with payment
      console.log('🔄 Step 2: Completing booking with payment...')
      const bookingData = {
        email: personalData.email,
        phone: personalData.phone,
        cardNumber: personalData.cardNumber,
        cardExpiry: `${personalData.expiryMonth}/${personalData.expiryYear.slice(-2)}`, // Convert to MM/YY
        cardHolder: personalData.cardHolder, // Usa il campo titolare carta dal form
        acceptNewsletter: personalData.acceptNewsletter || false
      }
      
      const bookingResult = await this.completeBooking(sessionId, bookingData, false) // testMode: false for real payments
      
      return bookingResult
    } catch (error) {
      console.error('Error submitting booking:', error)
      throw error
    }
  },

  /**
   * Get session status
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Session status
   */
  async getSessionStatus(sessionId) {
    try {
      const response = await api.get(`/session/${sessionId}/status`)
      return response
    } catch (error) {
      console.error('Error getting session status:', error)
      throw error
    }
  },

  /**
   * Clean up session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupSession(sessionId) {
    try {
      const response = await api.delete(`/session/${sessionId}`)
      return response
    } catch (error) {
      console.error('Error cleaning up session:', error)
      // Don't throw error for cleanup failures
      return null
    }
  },

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await axios.get('/api/health')
      return response.data
    } catch (error) {
      console.error('Health check failed:', error)
      throw error
    }
  }
}
