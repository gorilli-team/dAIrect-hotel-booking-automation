const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const playwrightService = require('../services/playwrightSteps');
const aiService = require('../services/aiSelector');

// Funzione per costruire URL diretto SimpleBooking
function buildDirectSearchUrl(searchParams) {
  const baseUrl = process.env.TARGET_HOTEL_URL || 'https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR';
  
  // Costruisce parametri date
  const dateParams = `&in=${searchParams.checkinDate}&out=${searchParams.checkoutDate}`;
  
  // Costruisce parametri ospiti (A per ogni adulto)
  const adults = parseInt(searchParams.adults) || 1;
  const guestParams = Array(adults).fill('A').join('%2C'); // %2C è la codifica URL per ,
  const guestsParam = `&guests=${guestParams}`;
  
  const directUrl = baseUrl + dateParams + guestsParam;
  
  return directUrl;
}

// Funzione per estrarre camere usando solo i selettori diretti (NO AI)
async function extractRoomsWithSelectors(page) {
  logger.info('Extracting rooms using direct CSS selectors');
  
  const rooms = [];
  
  try {
    // Aspetta che ci siano delle camere sulla pagina
    await page.waitForSelector('.RoomCard, .RoomResultBlock, .ekc2wag12, .eio1k2u2', { timeout: 10000 });
    
    // Trova tutte le cards delle camere
    const roomCards = await page.locator('.RoomCard, .RoomResultBlock, .ekc2wag12, .eio1k2u2');
    const roomCount = await roomCards.count();
    
    logger.info(`Found ${roomCount} room cards on page`);
    
    for (let i = 0; i < roomCount; i++) {
      const roomCard = roomCards.nth(i);
      
      try {
        // Estrai titolo camera
        const titleElement = roomCard.locator('.RoomCard h3, .ekc2wag9 h3, h3.Heading strong').first();
        const title = await titleElement.textContent().catch(() => `Camera ${i + 1}`);
        
        // Estrai prezzo
        const priceElement = roomCard.locator('.Prices .mainAmount, .eiup2eu1, .mainAmount span').first();
        const priceText = await priceElement.textContent().catch(() => '0');
        const price = priceText.replace(/[^0-9,\.]/g, '').replace(',', '.').split('.')[0] || '0';
        
        // Estrai descrizione
        const descElement = roomCard.locator('.ekc2wag6, .RoomCard .Paragraph').first();
        const description = await descElement.textContent().catch(() => 'Camera disponibile');
        
        // Trova bottone di prenotazione
        const bookButtons = roomCard.locator('.RoomCard_CTA, .ekc2wag2, button:has-text("Info e prenota"), button:has-text("Prenota")');
        const bookButtonCount = await bookButtons.count();
        
        let mainBookSelector = null;
        if (bookButtonCount > 0) {
          // Genera un selector unico per questo bottone
          mainBookSelector = `.RoomCard:nth-child(${i + 1}) .RoomCard_CTA, .RoomResultBlock:nth-child(${i + 1}) button`;
        }
        
        // Verifica disponibilità limitata
        const limitedAvailElement = roomCard.locator('.enongdq2, :has-text("Ne resta solo"), :has-text("Ne restano solo")');
        const limitedAvailText = await limitedAvailElement.textContent().catch(() => null);
        
        const room = {
          id: `room-${i + 1}`,
          name: title.trim(),
          price: parseInt(price) || 99,
          currency: 'EUR',
          description: description.trim().substring(0, 100),
          features: ['WiFi gratuito', 'Aria condizionata'],
          mainBookSelector,
          available: true,
          limitedAvailability: limitedAvailText
        };
        
        rooms.push(room);
        logger.info(`Extracted room: ${room.name} - €${room.price}`);
        
      } catch (error) {
        logger.warn(`Failed to extract data for room card ${i + 1}:`, error.message);
      }
    }
    
    return {
      success: true,
      rooms: rooms,
      totalRooms: rooms.length,
      message: `Found ${rooms.length} rooms using direct selectors`
    };
    
  } catch (error) {
    logger.error('Failed to extract rooms with selectors:', error);
    return {
      success: false,
      rooms: [],
      totalRooms: 0,
      message: 'No rooms found with direct selectors'
    };
  }
}

const router = express.Router();

// Session storage (in production use Redis or database)
const sessions = new Map();

// Validation schemas
const searchSchema = Joi.object({
  checkinDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  checkoutDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  adults: Joi.number().integer().min(1).max(6).required(),
  children: Joi.number().integer().min(0).max(4).default(0)
});

const personalDataSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  roomId: Joi.string().required(),
  personalData: Joi.object({
    firstName: Joi.string().min(2).required(),
    lastName: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(10).required(),
    cardNumber: Joi.string().pattern(/^\d{16}$/).required(),
    expiryMonth: Joi.string().pattern(/^\d{2}$/).required(),
    expiryYear: Joi.string().pattern(/^\d{4}$/).required(),
    cvv: Joi.string().pattern(/^\d{3,4}$/).required()
  }).required()
});

// POST /api/booking/start-search
router.post('/start-search', async (req, res) => {
  try {
    // Validate input
    const { error, value } = searchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { checkinDate, checkoutDate, adults, children } = value;
    const sessionId = uuidv4();

    logger.info(`Starting booking search for session ${sessionId}`, {
      checkinDate,
      checkoutDate,
      adults,
      children
    });

    // Initialize Playwright session
    const browser = await playwrightService.initBrowser();
    const page = await playwrightService.createPage(browser);

    // Store session data
    sessions.set(sessionId, {
      sessionId,
      browser,
      page,
      searchParams: { checkinDate, checkoutDate, adults, children },
      currentStep: 'search',
      createdAt: new Date()
    });

    // Costruisce URL diretto con parametri di ricerca
    const directUrl = buildDirectSearchUrl({ checkinDate, checkoutDate, adults, children });
    logger.info('Using direct URL for search', { directUrl });

    // Navigate directly to search results page
    await page.goto(directUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    // Handle cookie consent if present
    await aiService.handleCookieConsent(page);
    
    // Wait for results to load
    logger.info('Waiting for availability results to load');
    const waitResult = await aiService.waitForAvailabilityResults(page);
    
    let availableRooms = [];
    
    if (waitResult.success) {
      // Extract rooms using direct selectors (no AI)
      logger.info('Extracting available rooms using direct selectors');
      
      const roomsData = await extractRoomsWithSelectors(page);
      
      if (roomsData.rooms && roomsData.rooms.length > 0) {
        availableRooms = roomsData.rooms;
        logger.info(`Found ${availableRooms.length} rooms using direct selectors`);
        
        // Update session with rooms
        const session = sessions.get(sessionId);
        session.availableRooms = availableRooms;
        session.currentStep = 'room-selection';
      }
    }
    
    const searchResult = {
      success: waitResult.success,
      status: waitResult.status,
      message: waitResult.success ? 'Search completed successfully' : 'Search timed out or failed',
      rooms: availableRooms
    };

    // Take screenshot for debugging
    await page.screenshot({ 
      path: `backend/logs/search-${sessionId}.png`,
      fullPage: true
    });

    res.json({
      success: true,
      sessionId,
      message: 'Search completed successfully',
      data: searchResult
    });

  } catch (error) {
    logger.error('Error in start-search:', error);
    res.status(500).json({
      error: 'Failed to start search',
      message: error.message
    });
  }
});

// GET /api/booking/available-rooms/:sessionId
router.get('/available-rooms/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Invalid or expired session ID'
      });
    }

    logger.info(`Getting available rooms for session ${sessionId}`);

    // Extract rooms using direct selectors (no AI)
    const roomsData = await extractRoomsWithSelectors(session.page);

    logger.info(`Found rooms using direct selectors:`, { roomsCount: roomsData.rooms?.length || 0 });

    // Take screenshot
    await session.page.screenshot({ 
      path: `backend/logs/rooms-${sessionId}.png`,
      fullPage: true
    });

    // Update session
    session.currentStep = 'room-selection';
    session.availableRooms = roomsData.rooms;

    res.json({
      success: true,
      rooms: roomsData.rooms,
      message: roomsData.message || 'Rooms found successfully'
    });

  } catch (error) {
    logger.error('Error getting available rooms:', error);
    res.status(500).json({
      error: 'Failed to get available rooms',
      message: error.message
    });
  }
});

// POST /api/booking/select-room
router.post('/select-room', async (req, res) => {
  try {
    const { sessionId, roomId } = req.body;

    if (!sessionId || !roomId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'sessionId and roomId are required'
      });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    logger.info(`Selecting room ${roomId} for session ${sessionId}`);

    // Get current page HTML
    const htmlContent = await session.page.content();
    
    // Ask GPT how to select this room
    const selectionInstructions = await aiService.analyzeRoomSelection(htmlContent, roomId);

    // Execute room selection
    const selectionResult = await playwrightService.selectRoom(
      session.page, 
      selectionInstructions, 
      roomId
    );

    // Take screenshot
    await session.page.screenshot({ 
      path: `backend/logs/room-selected-${sessionId}.png`,
      fullPage: true
    });

    // Update session
    session.selectedRoom = roomId;
    session.currentStep = 'personal-data';

    res.json({
      success: true,
      message: 'Room selected successfully',
      data: selectionResult
    });

  } catch (error) {
    logger.error('Error selecting room:', error);
    res.status(500).json({
      error: 'Failed to select room',
      message: error.message
    });
  }
});

// POST /api/booking/submit-booking
router.post('/submit-booking', async (req, res) => {
  try {
    // Validate input
    const { error, value } = personalDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { sessionId, personalData } = value;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    logger.info(`Submitting booking for session ${sessionId}`, {
      email: personalData.email,
      room: session.selectedRoom
    });

    // Get current page HTML
    const htmlContent = await session.page.content();
    
    // Ask GPT how to fill the form
    const formInstructions = await aiService.analyzeBookingForm(htmlContent, personalData);

    // Fill and submit the booking form
    const bookingResult = await playwrightService.submitBooking(
      session.page,
      formInstructions,
      personalData
    );

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get final page content
    const finalHtml = await session.page.content();
    
    // Ask GPT to analyze the result
    const resultAnalysis = await aiService.analyzeBookingResult(finalHtml);

    // Take final screenshot
    await session.page.screenshot({ 
      path: `backend/logs/booking-final-${sessionId}.png`,
      fullPage: true
    });

    // Clean up session
    await playwrightService.cleanup(session.browser);
    sessions.delete(sessionId);

    res.json({
      success: resultAnalysis.success,
      message: resultAnalysis.message,
      bookingReference: resultAnalysis.bookingReference,
      error: resultAnalysis.error,
      data: {
        sessionId,
        searchParams: session.searchParams,
        selectedRoom: session.selectedRoom,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error submitting booking:', error);
    res.status(500).json({
      error: 'Failed to submit booking',
      message: error.message
    });
  }
});

// GET /api/booking/session/:sessionId/status
router.get('/session/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }

  res.json({
    sessionId,
    currentStep: session.currentStep,
    createdAt: session.createdAt,
    searchParams: session.searchParams,
    availableRooms: session.availableRooms?.length || 0,
    selectedRoom: session.selectedRoom
  });
});

// DELETE /api/booking/session/:sessionId
router.delete('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (session) {
    await playwrightService.cleanup(session.browser);
    sessions.delete(sessionId);
  }

  res.json({
    success: true,
    message: 'Session cleaned up'
  });
});

module.exports = router;
