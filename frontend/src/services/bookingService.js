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
   * Submit booking with personal data
   * @param {string} sessionId - Session identifier
   * @param {string} roomId - Selected room identifier
   * @param {Object} personalData - Personal and payment information
   * @returns {Promise<Object>} Booking result
   */
  async submitBooking(sessionId, roomId, personalData) {
    try {
      const response = await api.post('/submit-booking', {
        sessionId,
        roomId,
        personalData: {
          firstName: personalData.firstName,
          lastName: personalData.lastName,
          email: personalData.email,
          phone: personalData.phone,
          cardNumber: personalData.cardNumber.replace(/\s/g, ''), // Remove spaces
          expiryMonth: personalData.expiryMonth,
          expiryYear: personalData.expiryYear,
          cvv: personalData.cvv
        }
      })
      
      return response
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
