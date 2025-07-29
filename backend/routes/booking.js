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
    // Aspetta che ci siano delle camere sulla pagina - usa solo il container principale
    await page.waitForSelector('.RoomResultBlock, .eio1k2u2', { timeout: 10000 });
    
    // Trova tutte le sezioni delle camere (container principale, non i figli)
    const roomCards = await page.locator('.RoomResultBlock, .eio1k2u2');
    const roomCount = await roomCards.count();
    
    // Log per debugging
    const debugInfo = await roomCards.evaluateAll(elements => {
      return elements.map((el, index) => ({
        index,
        classes: el.className,
        hasRoomCard: el.querySelector('.RoomCard') !== null,
        hasPrice: el.querySelector('[class*="mainAmount"]') !== null
      }));
    });
    logger.info('Room cards debug info:', debugInfo);
    
    logger.info(`Found ${roomCount} room cards on page`);
    
    for (let i = 0; i < roomCount; i++) {
      const roomCard = roomCards.nth(i);
      
      try {
        // Estrai titolo camera
        const titleElement = roomCard.locator('.RoomCard h3, .ekc2wag9 h3, h3.Heading strong').first();
        const title = await titleElement.textContent().catch(() => `Camera ${i + 1}`);
        
        // Estrai prezzo con selettori multipli basati sulla struttura SimpleBooking reale
        const priceSelectors = [
          // Selettori specifici SimpleBooking dal body fornito
          '.Prices .mainAmount span', // Struttura esatta dal HTML: .Prices .mainAmount span
          '.eiup2eu1 span', // Classe specifica SimpleBooking con span figlio
          '.mainAmount span', // Versione più generica
          '.eo2ouhh3 .mainAmount span', // Con classe container Prices
          '.ltr-1yp4sq2 span', // Classe layout specifica
          '.mainAmount', // Senza span specifico
          '.eiup2eu1', // Classe diretta
          '[class*="mainAmount"]', // Qualsiasi classe contenente mainAmount
          '[class*="eiup2eu"]', // Qualsiasi classe SimpleBooking per prezzi
          'div[type="PRICES"] .mainAmount span', // Attributo type=PRICES specifico
          'div[type="PRICES"] span', // Solo con attributo type
          '[translate="no"] span' // Elementi con translate="no" (prezzi)
        ];
        
        let priceText = '0';
        let priceFound = false;
        
        for (const selector of priceSelectors) {
          try {
            const priceElement = roomCard.locator(selector).first();
            const elementText = await priceElement.textContent({ timeout: 1000 });
            if (elementText && elementText.match(/\d/)) {
              priceText = elementText;
              priceFound = true;
              logger.info(`Price found with selector '${selector}': ${elementText}`);
              break;
            }
          } catch (error) {
            // Continua con il prossimo selettore
          }
        }
        
        if (!priceFound) {
          // Fallback: cerca qualsiasi testo con € nella card
          try {
            const allText = await roomCard.textContent();
            const euroMatch = allText.match(/\d+[,.]?\d*\s*€|€\s*\d+[,.]?\d*/g);
            if (euroMatch && euroMatch.length > 0) {
              priceText = euroMatch[0];
              logger.info(`Price found with € fallback: ${priceText}`);
            }
          } catch (error) {
            logger.warn('No price found anywhere in room card');
          }
        }
        
        // Pulizia del prezzo: gestisce formato SimpleBooking (€2.085,72)
        let price = '99'; // default fallback
        if (priceText) {
          // Remove currency symbols and spaces
          let cleanedPrice = priceText.replace(/[^0-9,.]/g, '');
          
          // Handle Italian number format: 2.085,72 (thousands separator . and decimal separator ,)
          if (cleanedPrice.includes('.') && cleanedPrice.includes(',')) {
            // Format like 2.085,72 - remove thousands separator and use comma as decimal
            cleanedPrice = cleanedPrice.replace(/\./g, '').replace(',', '.');
          } else if (cleanedPrice.includes(',') && !cleanedPrice.includes('.')) {
            // Format like 2085,72 - replace comma with dot
            cleanedPrice = cleanedPrice.replace(',', '.');
          }
          // If only contains dots, assume it's thousands separator like 2.085
          else if (cleanedPrice.includes('.') && !cleanedPrice.includes(',')) {
            const parts = cleanedPrice.split('.');
            if (parts.length === 2 && parts[1].length <= 2) {
              // Likely decimal: 2085.72
              cleanedPrice = cleanedPrice;
            } else {
              // Likely thousands: 2.085
              cleanedPrice = cleanedPrice.replace(/\./g, '');
            }
          }
          
          const numericPrice = parseFloat(cleanedPrice);
          if (!isNaN(numericPrice) && numericPrice > 0) {
            price = Math.floor(numericPrice).toString(); // Remove decimals for consistency
          }
        }
        
        // Estrai descrizione dal selettore specifico (solo quello corretto)
        let description = 'Camera disponibile';
        try {
          const descElement = roomCard.locator('.ekc2wag7 .ekc2wag6').first();
          const rawDescription = await descElement.textContent().catch(() => null);
          
          if (rawDescription && rawDescription.trim()) {
            // Pulisci la descrizione da elementi indesiderati
            description = rawDescription.trim()
              .replace(/^Slide \d+ di \d+.*?ruler/g, '') // Rimuovi "Slide 1 di 8...ruler"
              .replace(/^\d+ m².*?ruler/g, '') // Rimuovi "28 m²...ruler"
              .replace(/chevron-left.*?chevron-right/g, '') // Rimuovi navigazione
              .replace(/^\d+ \/ \d+/g, '') // Rimuovi "1 / 8"
              .replace(/ruler\d+\s*m²/g, '') // Rimuovi "ruler45 m²"
              .replace(/Max ospiti:.*?crib\d+/g, '') // Rimuovi info ospiti
              .replace(/adult\d+/g, '') // Rimuovi "adult5"
              .replace(/crib\d+/g, '') // Rimuovi "crib1"
              .replace(/snow|volume|terrace|tree|help-circle|building|wifi/g, '') // Rimuovi icone
              .replace(/Aria condizionata|Insonorizzazione|Balcone|Vista|Vista luogo di interesse|Vista città|Wi-Fi Free/g, '') // Rimuovi features
              .replace(/Vedi di più/g, '') // Rimuovi "Vedi di più"
              .replace(/Ne resta solo \d+|Ne restano solo \d+/g, '') // Rimuovi disponibilità
              .replace(/A partire da.*?Info e prenota/g, '') // Rimuovi prezzo e bottone
              .replace(/chevron-up.*?Offerta speciale/g, '') // Rimuovi offerta speciale
              .replace(/tag/g, '') // Rimuovi "tag"
              .replace(/\s+/g, ' ') // Normalizza spazi
              .trim();
              
            if (description.length > 10) { // Solo se abbiamo una descrizione valida
              logger.info(`Clean description extracted: ${description}`);
            } else {
              description = 'Camera disponibile';
            }
          }
        } catch (error) {
          logger.warn('Failed to extract description:', error.message);
        }
        
        // Estrai blocco completo dimensioni + ospiti dal selettore .ekc2wag8
        let roomInfoBlock = null;
        try {
          const infoBlockElement = roomCard.locator('.ekc2wag8.ltr-1f91znd.e3a2zab1').first();
          const infoBlockHtml = await infoBlockElement.innerHTML().catch(() => null);
          
          if (infoBlockHtml) {
            // Estrai anche il testo leggibile per informazioni separate
            const infoBlockText = await infoBlockElement.textContent().catch(() => null);
            
            roomInfoBlock = {
              html: infoBlockHtml,
              text: infoBlockText ? infoBlockText.trim() : null
            };
            
            logger.info(`Found room info block: ${infoBlockText}`);
          }
        } catch (error) {
          logger.warn('Failed to extract room info block:', error.message);
        }
        
        // Estrai caratteristiche dettagliate della camera (escludi dimensioni)
        const detailedFeatures = [];
        try {
          // Trova tutti gli elementi RoomFeature nella sezione caratteristiche
          const featureElements = roomCard.locator('.RoomFeature .ltr-zswzrr');
          const featureCount = await featureElements.count();
          
          for (let featIdx = 0; featIdx < featureCount; featIdx++) {
            const featureEl = featureElements.nth(featIdx);
            const featureText = await featureEl.textContent().catch(() => null);
            
            if (featureText && featureText.trim()) {
              const cleanFeatureText = featureText.trim();
              
              // Escludi le dimensioni dalle features (già estratte in roomSize)
              if (!cleanFeatureText.match(/^\d+\s*m²$/)) {
                detailedFeatures.push(cleanFeatureText);
              }
            }
          }
          
          logger.info(`Found ${detailedFeatures.length} detailed features (excluding room size):`, detailedFeatures);
        } catch (error) {
          logger.warn('Failed to extract detailed features:', error.message);
        }
        
        // Estrai disponibilità limitata con più dettagli
        let availabilityInfo = null;
        try {
          const availElement = roomCard.locator('.enongdq2, .enongdq1, .enongdq0');
          
          // Prova a ottenere il numero rimasto
          const numberElement = roomCard.locator('.enongdq1');
          const numberText = await numberElement.textContent().catch(() => null);
          
          // Prova a ottenere il testo descrittivo
          const descElement = roomCard.locator('.enongdq0');
          const descText = await descElement.textContent().catch(() => null);
          
          if (numberText || descText) {
            availabilityInfo = {
              remaining: numberText ? parseInt(numberText) : null,
              description: descText || null,
              isLimited: true
            };
            logger.info(`Found availability info:`, availabilityInfo);
          }
        } catch (error) {
          // Info disponibilità non trovate
        }
        
        // Trova bottone di prenotazione
        const bookButtons = roomCard.locator('.RoomCard_CTA, .ekc2wag2, button:has-text("Info e prenota"), button:has-text("Prenota")');
        const bookButtonCount = await bookButtons.count();
        
        let mainBookSelector = null;
        if (bookButtonCount > 0) {
          // Genera un selector unico per questo bottone
          mainBookSelector = `.RoomCard:nth-child(${i + 1}) .RoomCard_CTA, .RoomResultBlock:nth-child(${i + 1}) button`;
        }
        
        // Estrai immagini dal carousel
        const images = [];
        try {
          // Selettori per le immagini nel carousel SpringImageCarousel
          const imageSelectors = [
            '.SpringImageCarousel img[src]',
            '.e1sp74u31[src]', // Classe specifica delle immagini
            '.SpringImageCarousel__Slide img[src]',
            '.e1sp74u35[style*="background-image"]', // Background images
            '[class*="SpringImageCarousel"] img[src]'
          ];
          
          for (const selector of imageSelectors) {
            try {
              const imageElements = roomCard.locator(selector);
              const imageCount = await imageElements.count();
              
              for (let imgIdx = 0; imgIdx < imageCount; imgIdx++) {
                const imgElement = imageElements.nth(imgIdx);
                
                // Prova a ottenere l'URL dalla src
                let imageUrl = await imgElement.getAttribute('src').catch(() => null);
                
                // Se non c'è src, prova con background-image
                if (!imageUrl) {
                  const style = await imgElement.getAttribute('style').catch(() => null);
                  if (style && style.includes('background-image')) {
                    const urlMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
                    if (urlMatch) {
                      imageUrl = urlMatch[1];
                    }
                  }
                }
                
                // Aggiungi immagine se valida e non duplicata
                if (imageUrl && imageUrl.startsWith('http') && !images.includes(imageUrl)) {
                  images.push(imageUrl);
                  logger.info(`Found room image: ${imageUrl}`);
                }
              }
              
              if (images.length > 0) break; // Se abbiamo trovato immagini, non continuare con altri selettori
            } catch (error) {
              // Continua con il prossimo selettore
            }
          }
          
          // Fallback: cerca anche nei div con background-image
          if (images.length === 0) {
            const bgElements = roomCard.locator('[style*="background-image"]');
            const bgCount = await bgElements.count();
            
            for (let bgIdx = 0; bgIdx < bgCount; bgIdx++) {
              const bgElement = bgElements.nth(bgIdx);
              const style = await bgElement.getAttribute('style').catch(() => null);
              
              if (style && style.includes('background-image')) {
                const urlMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
                if (urlMatch && urlMatch[1].startsWith('http') && !images.includes(urlMatch[1])) {
                  images.push(urlMatch[1]);
                  logger.info(`Found room background image: ${urlMatch[1]}`);
                }
              }
            }
          }
          
        } catch (error) {
          logger.warn(`Failed to extract images for room ${i + 1}:`, error.message);
        }
        
        // Verifica disponibilità limitata
        const limitedAvailElement = roomCard.locator('.enongdq2, :has-text("Ne resta solo"), :has-text("Ne restano solo")');
        const limitedAvailText = await limitedAvailElement.textContent().catch(() => null);
        
        const room = {
          id: `room-${i + 1}`,
          name: title.trim(),
          price: parseInt(price) || 99,
          currency: 'EUR',
          description: description.trim().substring(0, 200), // Increased length for longer descriptions
          features: detailedFeatures.length > 0 ? detailedFeatures : ['WiFi gratuito', 'Aria condizionata'], // Use extracted features
          roomInfoBlock: roomInfoBlock, // Blocco HTML completo con dimensioni + ospiti
          mainBookSelector,
          available: true,
          limitedAvailability: limitedAvailText,
          availabilityInfo: availabilityInfo, // Detailed availability info
          images: images // Array di URL delle immagini
        };
        
        // Check for duplicates before adding (simple deduplication by name)
        const existingRoom = rooms.find(existingRoom => 
          existingRoom.name.toLowerCase().trim() === room.name.toLowerCase().trim()
        );
        
        if (!existingRoom) {
          rooms.push(room);
          logger.info(`Extracted room: ${room.name} - €${room.price}`);
        } else {
          logger.info(`Skipped duplicate room: ${room.name} (already found with price €${existingRoom.price})`);
        }
        
      } catch (error) {
        logger.warn(`Failed to extract data for room card ${i + 1}:`, error.message);
      }
    }
    
    // Final deduplication pass (just in case)
    const uniqueRooms = rooms.filter((room, index, self) => 
      index === self.findIndex(r => r.name.toLowerCase().trim() === room.name.toLowerCase().trim())
    );
    
    if (uniqueRooms.length !== rooms.length) {
      logger.info(`Removed ${rooms.length - uniqueRooms.length} duplicate rooms`);
    }
    
    return {
      success: true,
      rooms: uniqueRooms,
      totalRooms: uniqueRooms.length,
      message: `Found ${uniqueRooms.length} unique rooms using direct selectors`
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

    // Find the room in session data
    const selectedRoom = session.availableRooms?.find(room => room.id === roomId);
    if (!selectedRoom) {
      return res.status(400).json({
        error: 'Room not found',
        message: 'Selected room ID not found in available rooms'
      });
    }

    logger.info('Found room to select:', { 
      name: selectedRoom.name, 
      price: selectedRoom.price,
      selector: selectedRoom.mainBookSelector
    });

    // Use direct selectors to click the "Info e prenota" or "Prenota" button
    const selectors = [
      selectedRoom.mainBookSelector, // Specific selector for this room
      `button:nth-child(${roomId.split('-')[1]}) >> text="Info e prenota"`, // Fallback with room index
      `button:nth-child(${roomId.split('-')[1]}) >> text="Prenota"`, // Fallback with "Prenota"
      '.RoomCard_CTA', // Generic room booking button
      '.ekc2wag2', // SimpleBooking specific class
      'button:has-text("Info e prenota")', // Generic text search
      'button:has-text("Prenota")', // Generic "Prenota" search
    ];

    let clicked = false;
    let usedSelector = null;

    for (const selector of selectors) {
      if (!selector) continue;
      
      try {
        logger.info(`Trying to click room selection with selector: ${selector}`);
        
        // Wait for selector and try to click
        const element = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          clicked = true;
          usedSelector = selector;
          logger.info(`Successfully clicked room selection button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        logger.debug(`Selector ${selector} failed: ${error.message}`);
      }
    }

    if (!clicked) {
      logger.error('Failed to click any room selection button');
      return res.status(500).json({
        error: 'Failed to select room',
        message: 'Could not find or click room selection button'
      });
    }

    // Wait for navigation to customer data page
    logger.info('Waiting for navigation to customer data page...');
    try {
      await session.page.waitForNavigation({ 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
      });
      logger.info('Successfully navigated to customer data page');
    } catch (error) {
      logger.warn('Navigation timeout, checking current page content');
    }

    // Wait for customer data form to load
    await session.page.waitForTimeout(2000);
    
    // Check if we're on customer data page by looking for form elements
    const isCustomerDataPage = await session.page.isVisible(
      'input[name="name"], input[name="firstName"], h2:has-text("Completa i tuoi dati")', 
      { timeout: 5000 }
    ).catch(() => false);

    if (!isCustomerDataPage) {
      logger.warn('Not on customer data page yet, taking screenshot for debugging');
    }

    // Take screenshot for debugging
    await session.page.screenshot({ 
      path: `backend/logs/room-selected-${sessionId}.png`,
      fullPage: true
    });

    // Update session
    session.selectedRoom = roomId;
    session.selectedRoomData = selectedRoom;
    session.currentStep = 'personal-data';

    res.json({
      success: true,
      message: 'Room selected successfully',
      data: {
        roomId,
        roomName: selectedRoom.name,
        roomPrice: selectedRoom.price,
        selector: usedSelector,
        onCustomerDataPage: isCustomerDataPage
      }
    });

  } catch (error) {
    logger.error('Error selecting room:', error);
    res.status(500).json({
      error: 'Failed to select room',
      message: error.message
    });
  }
});

// POST /api/booking/fill-personal-data
router.post('/fill-personal-data', async (req, res) => {
  logger.info('Fill personal data endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().uuid().required(),
    personalData: Joi.object({
      firstName: Joi.string().min(2).required(),
      lastName: Joi.string().min(2).required(), 
      email: Joi.string().email().required(),
      acceptNewsletter: Joi.boolean().default(false)
    }).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId, personalData } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  if (session.currentStep !== 'personal-data') {
    return res.status(400).json({
      error: 'Invalid step',
      message: `Expected step 'personal-data', but current step is '${session.currentStep}'`
    });
  }

  try {
    logger.info('Filling personal data page', {
      sessionId,
      email: personalData.email,
      firstName: personalData.firstName
    });

    // Call the new fillPersonalDataPage function
    const fillResult = await playwrightService.fillPersonalDataPage(
      session.page,
      personalData
    );

    if (fillResult.success) {
      // Update session to payment step
      session.currentStep = 'payment';
      session.personalDataFilled = true;
      session.personalData = personalData;
      session.updatedAt = new Date();
      
      logger.info('Personal data filled successfully, moved to payment step', {
        sessionId,
        email: personalData.email
      });

      res.json({
        success: true,
        sessionId,
        message: 'Personal data filled and navigated to payment page',
        currentStep: 'payment',
        nextAction: 'Call /complete-booking to finalize the booking'
      });
    } else {
      logger.error('Failed to fill personal data', {
        sessionId,
        error: fillResult.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fill personal data',
        details: fillResult.message,
        sessionId
      });
    }

  } catch (error) {
    logger.error('Error in fill-personal-data endpoint:', error);
    
    res.status(500).json({
      error: 'Failed to fill personal data',
      details: error.message,
      sessionId
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

// POST /api/booking/complete-booking
router.post('/complete-booking', async (req, res) => {
  logger.info('Complete booking endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    bookingData: Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().optional(),
      paymentMethod: Joi.string().valid('credit_card', 'bank_transfer').default('credit_card'),
      cardNumber: Joi.string().optional(),
      cardExpiry: Joi.string().optional(), // MM/YY format
      cvv: Joi.string().optional(),
      cardHolder: Joi.string().optional(),
      acceptNewsletter: Joi.boolean().default(false)
    }).required(),
    testMode: Joi.boolean().default(false) // IMPORTANT: prevents actual payment
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId, bookingData, testMode } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Completing booking', {
      sessionId,
      email: bookingData.email,
      paymentMethod: bookingData.paymentMethod,
      testMode
    });

    // Call the completion function with real selectors
    const completionResult = await playwrightService.completeBookingWithRealSelectors(
      session.page,
      bookingData,
      testMode
    );

    // Update session
    session.currentStep = 'booking_completed';
    session.bookingResult = completionResult;
    session.updatedAt = new Date();
    
    logger.info('Booking completion result:', {
      sessionId,
      success: completionResult.success,
      message: completionResult.message,
      testMode: completionResult.testMode || testMode
    });

    res.json({
      success: true,
      sessionId,
      result: completionResult,
      message: completionResult.success ? 
        'Booking completed successfully' : 
        'Booking completion failed',
      testMode: completionResult.testMode || testMode
    });

  } catch (error) {
    logger.error('Error in complete-booking endpoint:', error);
    
    // Update session with error
    session.currentStep = 'booking_failed';
    session.error = error.message;
    session.updatedAt = new Date();
    
    res.status(500).json({
      error: 'Failed to complete booking',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/analyze-current-page - Analyze what page we're currently on
router.post('/analyze-current-page', async (req, res) => {
  logger.info('Analyze current page endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Analyzing current page', { sessionId });

    // Take screenshot of current page
    await session.page.screenshot({ 
      path: `backend/logs/page-analysis-${sessionId}.png`,
      fullPage: true
    });

    // Get basic page info
    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    
    logger.info('Current page info:', {
      url: currentUrl,
      title: pageTitle
    });

    // Check for different page indicators
    const pageIndicators = {
      personalDataPage: [
        'h2:has-text("Completa i tuoi dati")',
        'h1:has-text("Completa i tuoi dati")',
        '.CustomerDataCollectionPage',
        'input[name="name"]',
        'input[name="firstName"]'
      ],
      paymentPage: [
        'h2:has-text("Scegli come garantire")',
        '.PaymentMethodsForm',
        'input[name="paymentMethodId"]',
        '.GuaranteeDataCollectionPage'
      ],
      searchPage: [
        '.RoomResultBlock',
        '.SearchWidget',
        'button:has-text("Info e prenota")'
      ],
      confirmationPage: [
        'h2:has-text("Conferma prenotazione")',
        'h1:has-text("Prenotazione confermata")',
        '.BookingConfirmation'
      ]
    };
    
    let currentPageType = 'unknown';
    let foundIndicators = [];
    
    for (const [pageType, selectors] of Object.entries(pageIndicators)) {
      for (const selector of selectors) {
        try {
          if (await session.page.isVisible(selector, { timeout: 1000 })) {
            currentPageType = pageType;
            foundIndicators.push({ pageType, selector, found: true });
            logger.info(`Found ${pageType} indicator: ${selector}`);
          }
        } catch (e) {
          // Indicator not found, continue
        }
      }
    }
    
    // Get all form elements on the page
    const allInputs = await session.page.locator('input').all();
    const inputInfo = [];
    
    for (let i = 0; i < Math.min(allInputs.length, 20); i++) {
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const visible = await input.isVisible();
        const checked = type === 'checkbox' ? await input.isChecked() : null;
        
        inputInfo.push({
          index: i,
          type,
          name,
          id,
          placeholder,
          visible,
          checked
        });
      } catch (e) {
        // Skip this input
      }
    }
    
    // Get all buttons on the page
    const allButtons = await session.page.locator('button, input[type="button"], input[type="submit"], a[role="button"]').all();
    const buttonInfo = [];
    
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      try {
        const button = allButtons[i];
        const tagName = await button.evaluate(el => el.tagName);
        const text = await button.textContent().catch(() => '');
        const className = await button.getAttribute('class').catch(() => '');
        const id = await button.getAttribute('id').catch(() => '');
        const visible = await button.isVisible();
        const enabled = await button.isEnabled();
        
        buttonInfo.push({
          index: i,
          tag: tagName,
          text: text?.trim(),
          class: className,
          id: id,
          visible: visible,
          enabled: enabled
        });
      } catch (e) {
        // Skip this button
      }
    }
    
    // Check for privacy checkbox specifically if we're on personal data page
    let privacyCheckboxInfo = null;
    if (currentPageType === 'personalDataPage' || currentPageType === 'unknown') {
      const privacySelectors = [
        'input[name="privacyPolicyAcceptance"]',
        'input[name="privacy"]',
        'input[type="checkbox"]'
      ];
      
      for (const selector of privacySelectors) {
        try {
          const checkbox = await session.page.waitForSelector(selector, { timeout: 2000 });
          if (checkbox) {
            const isVisible = await checkbox.isVisible();
            const isEnabled = await checkbox.isEnabled();
            const isChecked = await checkbox.isChecked();
            const name = await checkbox.getAttribute('name');
            const id = await checkbox.getAttribute('id');
            
            privacyCheckboxInfo = {
              selector,
              visible: isVisible,
              enabled: isEnabled,
              checked: isChecked,
              name,
              id
            };
            
            logger.info('Privacy checkbox found:', privacyCheckboxInfo);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    const result = {
      success: true,
      currentUrl,
      pageTitle,
      currentPageType,
      foundIndicators,
      totalInputsFound: allInputs.length,
      inputInfo,
      totalButtonsFound: allButtons.length,
      buttonInfo,
      privacyCheckboxInfo,
      sessionCurrentStep: session.currentStep,
      message: `Currently on ${currentPageType} page`
    };
    
    logger.info('Page analysis result:', result);
    
    res.json(result);

  } catch (error) {
    logger.error('Error in analyze-current-page endpoint:', error);
    
    // Take error screenshot
    await session.page.screenshot({ 
      path: `backend/logs/page-analysis-error-${sessionId}.png`,
      fullPage: true
    });
    
    res.status(500).json({
      error: 'Failed to analyze current page',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/test-privacy-checkbox - Test privacy policy checkbox in personal data page
router.post('/test-privacy-checkbox', async (req, res) => {
  logger.info('Test privacy checkbox endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Testing privacy checkbox and page state', { sessionId });

    // Take screenshot of current page
    await session.page.screenshot({ 
      path: `backend/logs/privacy-test-start-${sessionId}.png`,
      fullPage: true
    });

    // Get current page info
    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    
    logger.info('Current page info:', {
      url: currentUrl,
      title: pageTitle
    });

    // Check if we're on the personal data page
    const personalDataPageIndicators = [
      'h2:has-text("Completa i tuoi dati")',
      'h1:has-text("Completa i tuoi dati")',
      '.CustomerDataCollectionPage',
      'input[name="name"]',
      'input[name="firstName"]',
      'input[type="email"]'
    ];
    
    let onPersonalDataPage = false;
    let foundIndicator = null;
    
    for (const selector of personalDataPageIndicators) {
      try {
        if (await session.page.isVisible(selector, { timeout: 2000 })) {
          logger.info(`Found personal data page indicator: ${selector}`);
          onPersonalDataPage = true;
          foundIndicator = selector;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Get all form fields on the page
    const allInputs = await session.page.locator('input').all();
    const inputInfo = [];
    
    for (let i = 0; i < allInputs.length; i++) {
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const visible = await input.isVisible();
        const checked = type === 'checkbox' ? await input.isChecked() : null;
        
        inputInfo.push({
          index: i,
          type,
          name,
          id,
          placeholder,
          visible,
          checked
        });
      } catch (e) {
        // Skip this input
      }
    }
    
    // Look specifically for privacy policy checkbox
    const privacySelectors = [
      'input[name="privacyPolicyAcceptance"]',
      'input[name="privacy"]',
      'input[type="checkbox"]', // Generic checkbox
      'input[id*="privacy"]',
      'input[id*="Privacy"]'
    ];
    
    let privacyCheckboxFound = false;
    let privacyCheckboxInfo = null;
    let usedPrivacySelector = null;
    
    for (const selector of privacySelectors) {
      try {
        logger.info(`Trying privacy checkbox selector: ${selector}`);
        const checkbox = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (checkbox) {
          const isVisible = await checkbox.isVisible();
          const isEnabled = await checkbox.isEnabled();
          const isChecked = await checkbox.isChecked();
          const name = await checkbox.getAttribute('name');
          const id = await checkbox.getAttribute('id');
          
          privacyCheckboxInfo = {
            selector,
            visible: isVisible,
            enabled: isEnabled,
            checked: isChecked,
            name,
            id
          };
          
          logger.info('Privacy checkbox found:', privacyCheckboxInfo);
          
          if (isVisible && isEnabled) {
            if (!isChecked) {
              await checkbox.check();
              const nowChecked = await checkbox.isChecked();
              logger.info(`Privacy checkbox checked. Status: ${nowChecked}`);
              privacyCheckboxInfo.checkedAfterAction = nowChecked;
            } else {
              logger.info('Privacy checkbox was already checked');
              privacyCheckboxInfo.checkedAfterAction = true;
            }
            
            privacyCheckboxFound = true;
            usedPrivacySelector = selector;
            break;
          } else {
            logger.warn(`Privacy checkbox found but not interactable: visible=${isVisible}, enabled=${isEnabled}`);
          }
        }
      } catch (e) {
        logger.debug(`Privacy selector ${selector} failed: ${e.message}`);
        continue;
      }
    }
    
    // Look for Continue button and check if it's enabled
    const continueSelectors = [
      'button.CustomerDataCollectionPage_CTA.CTA',
      'button.CustomerDataCollectionPage_CTA',
      '.CustomerDataCollectionPage_CTA.CTA',
      '.CustomerDataCollectionPage_CTA',
      'button:has-text("Continua")',
      'button[type="submit"]'
    ];
    
    let continueButtonInfo = null;
    
    for (const selector of continueSelectors) {
      try {
        const button = await session.page.waitForSelector(selector, { timeout: 2000 });
        if (button) {
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          const text = await button.textContent();
          
          continueButtonInfo = {
            selector,
            visible: isVisible,
            enabled: isEnabled,
            text: text?.trim()
          };
          
          logger.info('Continue button found:', continueButtonInfo);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Take screenshot after checking/attempting to check privacy
    await session.page.screenshot({ 
      path: `backend/logs/privacy-test-after-${sessionId}.png`,
      fullPage: true
    });
    
    const result = {
      success: privacyCheckboxFound,
      onPersonalDataPage,
      foundIndicator,
      currentUrl,
      pageTitle,
      privacyCheckboxFound,
      privacyCheckboxInfo,
      usedPrivacySelector,
      continueButtonInfo,
      totalInputsFound: allInputs.length,
      inputInfo,
      message: privacyCheckboxFound ? 
        'Privacy checkbox found and processed' : 
        'Privacy checkbox not found - this might be why Continue button does not work'
    };
    
    logger.info('Privacy checkbox test result:', result);
    
    res.json(result);

  } catch (error) {
    logger.error('Error in test-privacy-checkbox endpoint:', error);
    
    // Take error screenshot
    await session.page.screenshot({ 
      path: `backend/logs/privacy-test-error-${sessionId}.png`,
      fullPage: true
    });
    
    res.status(500).json({
      error: 'Failed to test privacy checkbox',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/test-phone-field - Test only phone field without radio buttons
router.post('/test-phone-field', async (req, res) => {
  logger.info('Test phone field endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    phone: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId, phone } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Testing phone field only', {
      sessionId,
      phone
    });

    // Take screenshot of current page
    await session.page.screenshot({ 
      path: `backend/logs/phone-test-start-${sessionId}.png`,
      fullPage: true
    });

    // Get current page info
    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    
    logger.info('Current page info:', {
      url: currentUrl,
      title: pageTitle
    });

    // Try to find and fill phone field
    const phoneSelectors = [
      'input[name="mobilePhone"]', // Selettore principale
      'input#_rge_', // ID specifico dal HTML fornito dall'utente
      'input[aria-describedby*="_rep_"]', // Backup con aria-describedby
      '.PhoneNumberInputWrapper input[type="text"]', // Selettore container
      'input[type="tel"]', // Generic phone input
      'input[placeholder*="telefono"]', // Italian placeholder
      'input[placeholder*="cellulare"]', // Italian mobile placeholder
      'input[name*="phone"]', // Generic phone name
      'input[id*="phone"]' // Generic phone id
    ];
    
    let phoneFieldFound = false;
    let usedSelector = null;
    let phoneFieldInfo = null;
    
    for (const selector of phoneSelectors) {
      try {
        logger.info(`Trying phone selector: ${selector}`);
        const phoneField = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (phoneField) {
          // Get field info before filling
          const isVisible = await phoneField.isVisible();
          const isEnabled = await phoneField.isEnabled();
          const currentValue = await phoneField.inputValue();
          const placeholder = await phoneField.getAttribute('placeholder');
          
          phoneFieldInfo = {
            selector,
            visible: isVisible,
            enabled: isEnabled,
            currentValue,
            placeholder
          };
          
          logger.info('Phone field found:', phoneFieldInfo);
          
          if (isVisible && isEnabled) {
            await phoneField.fill(phone);
            const newValue = await phoneField.inputValue();
            
            logger.info(`Phone field filled successfully. New value: ${newValue}`);
            phoneFieldFound = true;
            usedSelector = selector;
            phoneFieldInfo.newValue = newValue;
            break;
          } else {
            logger.warn(`Phone field found but not interactable: visible=${isVisible}, enabled=${isEnabled}`);
          }
        }
      } catch (e) {
        logger.debug(`Phone selector ${selector} failed: ${e.message}`);
        continue;
      }
    }
    
    // Also check what other input fields are available
    const allInputs = await session.page.locator('input').all();
    const inputInfo = [];
    
    for (let i = 0; i < Math.min(allInputs.length, 15); i++) { // Limit to first 15 inputs
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const visible = await input.isVisible();
        
        inputInfo.push({
          index: i,
          type,
          name,
          id,
          placeholder,
          visible
        });
      } catch (e) {
        // Skip this input
      }
    }
    
    // Take screenshot after attempt
    await session.page.screenshot({ 
      path: `backend/logs/phone-test-after-${sessionId}.png`,
      fullPage: true
    });
    
    const result = {
      success: phoneFieldFound,
      phoneFieldFound,
      usedSelector,
      phoneFieldInfo,
      currentUrl,
      pageTitle,
      totalInputsFound: allInputs.length,
      inputInfo,
      message: phoneFieldFound ? 
        'Phone field found and filled successfully' : 
        'Phone field not found with any selector'
    };
    
    logger.info('Phone field test result:', result);
    
    res.json(result);

  } catch (error) {
    logger.error('Error in test-phone-field endpoint:', error);
    
    // Take error screenshot
    await session.page.screenshot({ 
      path: `backend/logs/phone-test-error-${sessionId}.png`,
      fullPage: true
    });
    
    res.status(500).json({
      error: 'Failed to test phone field',
      details: error.message,
      sessionId
    });
  }
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
