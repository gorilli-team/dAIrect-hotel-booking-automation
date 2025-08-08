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
        
        // Estrai blocco prezzo completo (con sconto, tasse, notti, etc.)
        let priceBlock = null;
        let price = '99'; // Fallback numerico per compatibilità
        
        try {
          // Cerca il blocco prezzo completo con il selettore principale
          const priceBlockSelectors = [
            'div[type="PRICES"].Prices.eo2ouhh3', // Selettore completo dal HTML fornito
            '.Prices.eo2ouhh3', // Senza l'attributo type
            'div[type="PRICES"]', // Solo con attributo type
            '.Prices' // Generico
          ];
          
          for (const selector of priceBlockSelectors) {
            try {
              const priceElement = roomCard.locator(selector).first();
              const priceHtml = await priceElement.innerHTML().catch(() => null);
              
              if (priceHtml) {
                // Estrai anche il testo per informazioni separate
                const priceText = await priceElement.textContent().catch(() => null);
                
                priceBlock = {
                  html: priceHtml,
                  text: priceText ? priceText.trim() : null
                };
                
                // Estrai prezzo numerico per compatibilità con il resto del sistema
                const mainAmountElement = priceElement.locator('.mainAmount span').first();
                const mainAmountText = await mainAmountElement.textContent().catch(() => null);
                
                if (mainAmountText) {
                  // Pulisci il prezzo per ottenere valore numerico
                  let cleanedPrice = mainAmountText.replace(/[^0-9,.]/g, '');
                  
                  // Gestisce formato italiano: 2.479,68
                  if (cleanedPrice.includes('.') && cleanedPrice.includes(',')) {
                    cleanedPrice = cleanedPrice.replace(/\./g, '').replace(',', '.');
                  } else if (cleanedPrice.includes(',') && !cleanedPrice.includes('.')) {
                    cleanedPrice = cleanedPrice.replace(',', '.');
                  } else if (cleanedPrice.includes('.') && !cleanedPrice.includes(',')) {
                    const parts = cleanedPrice.split('.');
                    if (parts.length === 2 && parts[1].length <= 2) {
                      cleanedPrice = cleanedPrice;
                    } else {
                      cleanedPrice = cleanedPrice.replace(/\./g, '');
                    }
                  }
                  
                  const numericPrice = parseFloat(cleanedPrice);
                  if (!isNaN(numericPrice) && numericPrice > 0) {
                    price = Math.floor(numericPrice).toString();
                  }
                }
                
                logger.info(`Price block found with selector '${selector}': ${priceText}`);
                break;
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          logger.warn('Failed to extract price block:', error.message);
        }
        
        // Se non troviamo il blocco completo, fallback al metodo precedente
        if (!priceBlock) {
          logger.info('Price block not found, falling back to simple price extraction');
          
          const priceSelectors = [
            '.Prices .mainAmount span',
            '.eiup2eu1 span',
            '.mainAmount span',
            '.mainAmount',
            '[class*="mainAmount"]'
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
                logger.info(`Fallback price found with selector '${selector}': ${elementText}`);
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          if (priceFound) {
            let cleanedPrice = priceText.replace(/[^0-9,.]/g, '');
            if (cleanedPrice.includes('.') && cleanedPrice.includes(',')) {
              cleanedPrice = cleanedPrice.replace(/\./g, '').replace(',', '.');
            } else if (cleanedPrice.includes(',') && !cleanedPrice.includes('.')) {
              cleanedPrice = cleanedPrice.replace(',', '.');
            }
            
            const numericPrice = parseFloat(cleanedPrice);
            if (!isNaN(numericPrice) && numericPrice > 0) {
              price = Math.floor(numericPrice).toString();
            }
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
        
        // Estrai opzioni di prenotazione dal collapse (se espanso)
        const bookingOptions = [];
        try {
          // Cerca il collapse delle opzioni
          const collapseContainer = roomCard.locator('.roomOptionsCollapse, .ltr-dmxz30');
          const hasCollapse = await collapseContainer.count() > 0;
          
          if (hasCollapse) {
            logger.info(`Found booking options collapse for room ${i + 1}`);
            
            // Estrai tutte le sezioni RateWithOptions
            const rateOptions = collapseContainer.locator('.RateWithOptions, .e1sl87534');
            const rateOptionsCount = await rateOptions.count();
            
            logger.info(`Found ${rateOptionsCount} rate options in collapse`);
            
            for (let rateIdx = 0; rateIdx < rateOptionsCount; rateIdx++) {
              const rateOption = rateOptions.nth(rateIdx);
              
              try {
                // Estrai nome/titolo della tariffa
                const rateTitleElement = rateOption.locator('h4.e18qkw5q3 strong, h4 strong').first();
                const rateTitle = await rateTitleElement.textContent().catch(() => `Tariffa ${rateIdx + 1}`);
                
                // Estrai descrizione della tariffa
                const rateDescElement = rateOption.locator('p.e18qkw5q2, .Paragraph').first();
                const rateDescription = await rateDescElement.textContent().catch(() => null);
                
                // Estrai prezzo della tariffa
                let ratePrice = '0';
                const ratePriceElement = rateOption.locator('.mainAmount span, .eiup2eu2 span').first();
                const ratePriceText = await ratePriceElement.textContent().catch(() => null);
                
                if (ratePriceText) {
                  let cleanedPrice = ratePriceText.replace(/[^0-9,.]/g, '');
                  // Gestisce formato italiano: 1.701 o 1.956,15
                  if (cleanedPrice.includes('.') && cleanedPrice.includes(',')) {
                    cleanedPrice = cleanedPrice.replace(/\./g, '').replace(',', '.');
                  } else if (cleanedPrice.includes(',') && !cleanedPrice.includes('.')) {
                    cleanedPrice = cleanedPrice.replace(',', '.');
                  } else if (cleanedPrice.includes('.') && !cleanedPrice.includes(',')) {
                    const parts = cleanedPrice.split('.');
                    if (parts.length === 2 && parts[1].length <= 2) {
                      // È un decimale: 123.45
                      cleanedPrice = cleanedPrice;
                    } else {
                      // È un separatore delle migliaia: 1.701
                      cleanedPrice = cleanedPrice.replace(/\./g, '');
                    }
                  }
                  
                  const numericPrice = parseFloat(cleanedPrice);
                  if (!isNaN(numericPrice) && numericPrice > 0) {
                    ratePrice = numericPrice.toString();
                  }
                }
                
                // Estrai info sconto se presente
                let discountInfo = null;
                const discountElement = rateOption.locator('.discount, .e1f8iu742').first();
                const discountCount = await discountElement.count();
                
                if (discountCount > 0) {
                  const discountPercent = await discountElement.locator('.percent, .ltr-dsm5ai').textContent().catch(() => null);
                  const originalPrice = await discountElement.locator('.originalAmount, .ltr-4pyi7h').textContent().catch(() => null);
                  
                  if (discountPercent || originalPrice) {
                    discountInfo = {
                      percent: discountPercent?.trim(),
                      originalPrice: originalPrice?.trim()
                    };
                  }
                }
                
                // Estrai politica di cancellazione
                let cancellationPolicy = null;
                const cancelPolicyElement = rateOption.locator('.Rate__CancellationPolicy, .e18qkw5q0').first();
                const cancelPolicyText = await cancelPolicyElement.textContent().catch(() => null);
                
                if (cancelPolicyText) {
                  const isRefundable = !cancelPolicyText.toLowerCase().includes('non rimborsabile');
                  cancellationPolicy = {
                    text: cancelPolicyText.trim(),
                    refundable: isRefundable
                  };
                }
                
                // Estrai tipo di pasto (Camera e Colazione, etc.)
                let mealPlan = null;
                const mealPlanElement = rateOption.locator('.e16r10jm5, p b').first();
                const mealPlanText = await mealPlanElement.textContent().catch(() => null);
                
                if (mealPlanText) {
                  mealPlan = mealPlanText.trim();
                }
                
                // Trova bottone "Prenota" per questa opzione
                const bookButtonElement = rateOption.locator('.RoomOption_CTA, .e16r10jm0, button:has-text("Prenota")').first();
                const hasBookButton = await bookButtonElement.count() > 0;
                
                let bookSelector = null;
                if (hasBookButton) {
                  // Genera selettori multipli più robusti per questa opzione specifica
                  const roomIndex = i + 1;
                  const optionIndex = rateIdx + 1;
                  
                  // Selettori ordinati dal più specifico al più generale
                  const selectors = [
                    `.RoomResultBlock:nth-child(${roomIndex}) .RateWithOptions:nth-child(${optionIndex}) .RoomOption_CTA.e16r10jm0`,
                    `.RoomResultBlock:nth-child(${roomIndex}) .RateWithOptions:nth-child(${optionIndex}) button.RoomOption_CTA`,
                    `.RoomResultBlock:nth-child(${roomIndex}) .e1sl87534:nth-child(${optionIndex}) .e16r10jm0`,
                    `.RoomCard:nth-child(${roomIndex}) .RateWithOptions:nth-child(${optionIndex}) button:has-text("Prenota")`,
                    `[data-testid="room-${roomIndex}-option-${optionIndex}-book"]` // Fallback con data attribute
                  ];
                  
                  bookSelector = selectors.join(', ');
                }
                
                // Estrai badge "Offerta speciale" se presente
                let specialOffer = false;
                const specialOfferElement = rateOption.locator('.Badge:has-text("Offerta speciale"), .e1jssjhy1').first();
                const hasSpecialOffer = await specialOfferElement.count() > 0;
                if (hasSpecialOffer) {
                  specialOffer = true;
                }
                
                const bookingOption = {
                  id: `rate-${i + 1}-${rateIdx + 1}`,
                  name: rateTitle.trim(),
                  description: rateDescription ? rateDescription.trim().substring(0, 500) : null,
                  price: parseFloat(ratePrice),
                  currency: 'EUR',
                  mealPlan: mealPlan,
                  cancellationPolicy: cancellationPolicy,
                  discountInfo: discountInfo,
                  specialOffer: specialOffer,
                  bookSelector: bookSelector,
                  available: hasBookButton
                };
                
                bookingOptions.push(bookingOption);
                logger.info(`Extracted booking option: ${bookingOption.name} - €${bookingOption.price}`);
                
              } catch (error) {
                logger.warn(`Failed to extract rate option ${rateIdx + 1} for room ${i + 1}:`, error.message);
              }
            }
          } else {
            logger.info(`No booking options collapse found for room ${i + 1}`);
          }
        } catch (error) {
          logger.warn(`Failed to extract booking options for room ${i + 1}:`, error.message);
        }
        
        // Trova bottone di prenotazione principale
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
          priceBlock: priceBlock, // Blocco HTML completo del prezzo (con sconto, tasse, notti, etc.)
          mainBookSelector,
          available: true,
          limitedAvailability: limitedAvailText,
          availabilityInfo: availabilityInfo, // Detailed availability info
          images: images, // Array di URL delle immagini
          bookingOptions: bookingOptions // Opzioni di prenotazione estratte dal collapse
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

    // Initialize Playwright session with new browser instance
    let browser = null;
    let page = null;
    
    try {
      browser = await playwrightService.initBrowser();
      page = await playwrightService.createPage(browser);
    } catch (browserError) {
      logger.error('Failed to initialize browser:', browserError);
      return res.status(500).json({
        error: 'Browser initialization failed',
        message: 'Could not start browser session. Please try again.'
      });
    }

    // Validate browser and page before storing session
    if (!browser || !page) {
      logger.error('Browser or page is null after initialization');
      return res.status(500).json({
        error: 'Browser session invalid',
        message: 'Failed to create valid browser session'
      });
    }
    
    // Test browser connectivity
    try {
      await page.goto('about:blank', { timeout: 5000 });
    } catch (connectError) {
      logger.error('Browser connectivity test failed:', connectError);
      await playwrightService.cleanup(browser);
      return res.status(500).json({
        error: 'Browser connectivity failed',
        message: 'Could not establish browser connection'
      });
    }

    // Store session data
    sessions.set(sessionId, {
      sessionId,
      browser,
      page,
      searchParams: { checkinDate, checkoutDate, adults, children },
      currentStep: 'search',
      createdAt: new Date(),
      lastActivity: new Date()
    });

    // Costruisce URL diretto con parametri di ricerca
    const directUrl = buildDirectSearchUrl({ checkinDate, checkoutDate, adults, children });
    logger.info('Using direct URL for search', { directUrl });

    // Navigate directly to search results page with retry logic
    let navigationSuccess = false;
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info(`Navigation attempt ${attempt}/3 to: ${directUrl}`);
        
        await page.goto(directUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 // Increased timeout to 30 seconds
        });
        
        navigationSuccess = true;
        logger.info(`Navigation successful on attempt ${attempt}`);
        break;
        
      } catch (error) {
        lastError = error;
        logger.warn(`Navigation attempt ${attempt} failed:`, error.message);
        
        if (attempt < 3) {
          logger.info(`Waiting 2 seconds before retry...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!navigationSuccess) {
      logger.error('All navigation attempts failed:', lastError?.message);
      throw new Error(`Failed to navigate to search page after 3 attempts: ${lastError?.message}`);
    }
    
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

    // Validate session browser and page
    if (!session.browser || !session.page) {
      logger.error(`Session ${sessionId} has invalid browser or page`);
      sessions.delete(sessionId);
      return res.status(400).json({
        error: 'Invalid session state',
        message: 'Browser session is no longer valid. Please start a new search.'
      });
    }

    // Test if browser is still connected
    try {
      await session.page.url();
      session.lastActivity = new Date();
    } catch (browserError) {
      logger.error(`Browser disconnected for session ${sessionId}:`, browserError);
      await playwrightService.cleanup(session.browser).catch(() => {});
      sessions.delete(sessionId);
      return res.status(400).json({
        error: 'Browser session expired',
        message: 'Your browser session has expired. Please start a new search.'
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
    const { sessionId, roomId, optionId } = req.body;

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

    // Use direct selectors to click the "Info e prenota" button (first step)
    const selectors = [
      selectedRoom.mainBookSelector, // Specific selector for this room
      `button:nth-child(${roomId.split('-')[1]}) >> text="Info e prenota"`, // Fallback with room index
      '.RoomCard_CTA', // Generic room booking button
      '.ekc2wag2', // SimpleBooking specific class
      'button:has-text("Info e prenota")', // Generic text search
    ];

    let clicked = false;
    let usedSelector = null;

    for (const selector of selectors) {
      if (!selector) continue;
      
      try {
        logger.info(`Trying to click "Info e prenota" with selector: ${selector}`);
        
        // Wait for selector and try to click
        const element = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          clicked = true;
          usedSelector = selector;
          logger.info(`Successfully clicked "Info e prenota" button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        logger.debug(`Selector ${selector} failed: ${error.message}`);
      }
    }

    if (!clicked) {
      logger.error('Failed to click any "Info e prenota" button');
      return res.status(500).json({
        error: 'Failed to select room',
        message: 'Could not find or click "Info e prenota" button'
      });
    }

    // Wait for the booking options page to load
    logger.info('Waiting for booking options page to load...');
    await session.page.waitForTimeout(3000);
    
    // Check if we're on the booking options page with rate selections
    const bookingOptionsVisible = await session.page.isVisible('.RateWithOptions, .e1sl87534', { timeout: 5000 }).catch(() => false);
    
    if (bookingOptionsVisible) {
      logger.info('✅ Booking options page loaded - found rate options');
      
      let rateOptionClicked = false;
      
      // Get current URL before clicking to detect navigation (needed for both specific and fallback)
      const currentUrl = session.page.url();
      
    // Se l'utente ha specificato un'opzione, usa selettori precisi e scoping per stanza
    if (optionId && selectedRoom.bookingOptions) {
      const selectedOption = selectedRoom.bookingOptions.find(option => option.id === optionId);
      
      if (selectedOption) {
        logger.info(`Trying to click specific option "${selectedOption.name}" with scoped strategy`);

        // 1) Scope: individua la card della stanza selezionata
        let roomIndex = null;
        try {
          // roomId ha formato 'room-<index>'
          const parts = (roomId || '').split('-');
          if (parts.length === 2) roomIndex = parseInt(parts[1]);
        } catch {}
        
        const roomCards = session.page.locator('.RoomCard, .RoomResultBlock, .ekc2wag12, .eio1k2u2');
        const roomScope = Number.isInteger(roomIndex) && roomIndex > 0
          ? roomCards.nth(roomIndex - 1)
          : roomCards.first();

        // Assicurati che il cassetto (collapse) sia visibile all'interno della stanza
        try {
          const expandToggle = roomScope.locator('[aria-expanded="false"], .expand, button:has-text("Info e prenota")').first();
          if (await expandToggle.count() > 0) {
            await expandToggle.click({ timeout: 2000 }).catch(() => {});
          }
        } catch {}
        await session.page.waitForTimeout(800);

        // 2) Prova prima con il selettore precomputato specifico
        if (selectedOption.bookSelector) {
          try {
            logger.info(`Trying precomputed bookSelector: ${selectedOption.bookSelector}`);
            const precomputed = roomScope.locator(selectedOption.bookSelector).first();
            if (await precomputed.count() > 0) {
              await precomputed.scrollIntoViewIfNeeded();
              await precomputed.click({ timeout: 3000 });
              await session.page.waitForTimeout(1500);
              const newUrl = session.page.url();
              if (newUrl !== currentUrl) {
                rateOptionClicked = true;
                logger.info('🎉 SUCCESS! Clicked with precomputed selector');
              } else {
                logger.warn('Precomputed selector clicked but URL did not change');
              }
            } else {
              logger.warn('Precomputed selector not found in room scope');
            }
          } catch (e) {
            logger.debug(`Precomputed selector failed: ${e.message}`);
          }
        }
        // 3) Se non riuscito, prova match ESATTO per prezzo nel cassetto (con normalizzazione punti/virgole)
        if (!rateOptionClicked) {
          try {
            const targetPrice = Number.isFinite(selectedOption.price) ? selectedOption.price : null;
            if (targetPrice !== null) {
              const normalizeToNumber = (txt) => {
                try {
                  if (!txt) return NaN;
                  let cleaned = (txt + '').replace(/[^0-9.,]/g, '');
                  if (cleaned.includes('.') && cleaned.includes(',')) {
                    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
                  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
                    cleaned = cleaned.replace(',', '.');
                  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
                    const parts = cleaned.split('.');
                    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) {
                      cleaned = cleaned.replace(/\./g, '');
                    }
                  }
                  const num = parseFloat(cleaned);
                  return isNaN(num) ? NaN : num;
                } catch { return NaN; }
              };

              const targetCents = Math.round(targetPrice * 100);
              const ratesInRoom = roomScope.locator('.RateWithOptions, .e1sl87534');
              const rateCount = await ratesInRoom.count();
              logger.info(`Price-match attempt: targetPrice=${targetPrice} (cents=${targetCents}), rateCount=${rateCount}`);

              let matchedIndexByPrice = -1;
              let matchedIndexByPriceAndTitle = -1;

              for (let r = 0; r < rateCount; r++) {
                try {
                  const rateLoc = ratesInRoom.nth(r);
                  const priceEl = rateLoc.locator('.mainAmount span, .eiup2eu2 span').first();
                  const priceText = await priceEl.textContent().catch(() => null);
                  const num = normalizeToNumber(priceText);
                  const cents = Math.round((num || 0) * 100);

                  logger.info(`Price-match check rate ${r + 1}: text='${(priceText || '').trim()}', parsed=${num}, cents=${cents}`);

                  if (!isNaN(num) && cents === targetCents) {
                    if (matchedIndexByPrice === -1) matchedIndexByPrice = r;

                    // Check also by title substring for stronger match
                    const txt = (await rateLoc.textContent().catch(() => '') || '').toLowerCase();
                    const nameLower = (selectedOption.name || '').toLowerCase();
                    const probe = nameLower.substring(0, Math.min(15, nameLower.length));
                    if (probe && txt.includes(probe)) {
                      matchedIndexByPriceAndTitle = r;
                      break;
                    }
                  }
                } catch (e) {
                  logger.debug(`Price-match scan error on rate ${r + 1}: ${e.message}`);
                }
              }

              const chosenIndex = matchedIndexByPriceAndTitle !== -1 ? matchedIndexByPriceAndTitle : matchedIndexByPrice;

              if (chosenIndex !== -1) {
                const targetRate = ratesInRoom.nth(chosenIndex);
                const bookBtn = targetRate.locator(
                  'button:has-text("Prenota"):not(:has-text("Info")), .RoomOption_CTA:has-text("Prenota"), button.e16r10jm0:has-text("Prenota"), button:has(.CTA_Text:has-text("Prenota"))'
                ).first();
                if (await bookBtn.count() > 0) {
                  await bookBtn.scrollIntoViewIfNeeded();
                  await session.page.screenshot({ 
                    path: `backend/logs/price-matched-rate-${sessionId}-${optionId.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                    fullPage: true
                  });
                  await bookBtn.click({ timeout: 5000 });
                  await session.page.waitForTimeout(1500);
                  const newUrl = session.page.url();
                  const successBySelectors = await Promise.race([
                    session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                  ]);
                  if (newUrl !== currentUrl || successBySelectors) {
                    rateOptionClicked = true;
                    logger.info(`🎯 SUCCESS! Clicked rate by exact price match in scoped room (index=${chosenIndex + 1})`);
                  } else {
                    logger.warn('Price-matched Prenota clicked but no navigation indicators detected');
                  }
                } else {
                  logger.warn('No Prenota button found in price-matched rate container');
                }
              } else {
                logger.info('No rate matched exactly by price in drawer');
              }
            }
          } catch (e) {
            logger.debug(`Price-based match failed (non-bloccante): ${e.message}`);
          }
        }

        // 4) Se non riuscito, prova selezione basata su indice dall'optionId (es. rate-1-2)
        if (!rateOptionClicked) {
          try {
            let optionIndex = null;
            const parts = (optionId || '').split('-');
            if (parts.length === 3) optionIndex = parseInt(parts[2]);
            if (Number.isInteger(optionIndex) && optionIndex > 0) {
              const ratesInRoom = roomScope.locator('.RateWithOptions, .e1sl87534');
              const rateCount = await ratesInRoom.count();
              logger.info(`Index-based fallback: optionIndex=${optionIndex}, rateCount=${rateCount}`);
              if (rateCount >= optionIndex) {
                const targetRateByIndex = ratesInRoom.nth(optionIndex - 1);
                const bookBtn = targetRateByIndex.locator(
                  'button:has-text("Prenota"):not(:has-text("Info")), .RoomOption_CTA:has-text("Prenota"), button.e16r10jm0:has-text("Prenota"), button:has(.CTA_Text:has-text("Prenota"))'
                ).first();
                if (await bookBtn.count() > 0) {
                  await bookBtn.scrollIntoViewIfNeeded();
                  await session.page.screenshot({ 
                    path: `backend/logs/indexed-rate-${sessionId}-${optionId.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                    fullPage: true
                  });
                  await bookBtn.click({ timeout: 5000 });
                  // Success conditions: URL changed OR personal/guarantee/payment page elements appeared
                  await session.page.waitForTimeout(1500);
                  const newUrl = session.page.url();
                  const successBySelectors = await Promise.race([
                    session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                  ]);
                  if (newUrl !== currentUrl || successBySelectors) {
                    rateOptionClicked = true;
                    logger.info('🎉 SUCCESS! Clicked rate by index-based fallback in scoped room');
                  } else {
                    logger.warn('Index-based Prenota clicked but no navigation indicators detected');
                  }
                } else {
                  logger.warn('No Prenota button found in indexed rate container');
                }
              }
            }
          } catch (e) {
            logger.debug(`Index-based rate click failed: ${e.message}`);
          }
        }

        // 4) Se non riuscito, trova la tariffa per titolo (e optional prezzo) e clicca il suo Prenota
        if (!rateOptionClicked) {
          try {
            const ratesInRoom = roomScope.locator('.RateWithOptions, .e1sl87534');
            // Filtro per titolo della tariffa con confronto più permissivo
            const targetRate = await ratesInRoom.elementHandles();
            let matchedHandle = null;
            for (const handle of targetRate) {
              try {
                const text = (await handle.textContent() || '').toLowerCase();
                const nameLower = (selectedOption.name || '').toLowerCase();
                if (nameLower && text.includes(nameLower.substring(0, Math.min(15, nameLower.length)))) {
                  matchedHandle = handle;
                  break;
                }
              } catch {}
            }

            if (matchedHandle) {
              const rateLocator = roomScope.locator('.RateWithOptions, .e1sl87534').filter({ has: { element: matchedHandle } }).first();
              const bookBtn = rateLocator.locator(
                'button:has-text("Prenota"):not(:has-text("Info")), .RoomOption_CTA:has-text("Prenota"), button.e16r10jm0:has-text("Prenota"), button:has(.CTA_Text:has-text("Prenota"))'
              ).first();
              if (await bookBtn.count() > 0) {
                await bookBtn.scrollIntoViewIfNeeded();
                await session.page.screenshot({ 
                  path: `backend/logs/target-rate-${sessionId}-${optionId.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                  fullPage: true
                });
                await bookBtn.click({ timeout: 5000 });
                await session.page.waitForTimeout(1500);
                const newUrl = session.page.url();
                const successBySelectors = await Promise.race([
                  session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                  session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                  session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                ]);
                if (newUrl !== currentUrl || successBySelectors) {
                  rateOptionClicked = true;
                  logger.info('🎉 SUCCESS! Clicked rate-specific Prenota in scoped room (title match)');
                } else {
                  logger.warn('Clicked rate-specific Prenota (title match) but no navigation indicators detected');
                }
              } else {
                logger.warn('No valid Prenota button inside targeted rate (title match)');
              }
            } else {
              logger.warn('Could not find targeted rate container by title');
            }
          } catch (e) {
            logger.debug(`Scoped rate click (title) failed: ${e.message}`);
          }
        }

        // 4) Ultimo fallback: selettori generici ma sempre nello scope della stanza
        if (!rateOptionClicked) {
          logger.info('Falling back to generic Prenota selectors within room scope');
          const simplePrenotaSelectors = [
            'button:has-text("Prenota"):not(:has-text("Info"))',
            '.RoomOption_CTA:has-text("Prenota")',
            'button.e16r10jm0:has-text("Prenota")',
            '[class*="CTA"]:has-text("Prenota")',
            'button[class*="prenota"]',
            'button[class*="Prenota"]'
          ];

          for (const selector of simplePrenotaSelectors) {
            try {
              logger.info(`Trying simple Prenota selector (scoped): ${selector}`);
              const elements = await roomScope.$$(selector);

              for (const element of elements) {
                const isVisible = await element.isVisible();
                const isEnabled = await element.isEnabled();
                const buttonText = await element.textContent();
                const lowerButtonText = (buttonText || '').toLowerCase();
                const isValidPrenota = lowerButtonText.includes('prenota') && !lowerButtonText.includes('info');

                if (isVisible && isEnabled && isValidPrenota) {
                  await element.scrollIntoViewIfNeeded();
                  await session.page.waitForTimeout(300);
                  await element.click({ timeout: 5000 });
                  await session.page.waitForTimeout(1500);
                  const newUrl = session.page.url();
                  const successBySelectors = await Promise.race([
                    session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                  ]);
                  if (newUrl !== currentUrl || successBySelectors) {
                    rateOptionClicked = true;
                    logger.info(`🎉 SUCCESS! Clicked simple Prenota (scoped) using selector: ${selector}`);
                    break;
                  }
                }
              }
              if (rateOptionClicked) break;
            } catch (error) {
              logger.debug(`Scoped simple Prenota selector ${selector} failed: ${error.message}`);
              continue;
            }
          }
        }
      }
    }
      
      // Solo se l'utente NON ha specificato un'opzione, usa il fallback generico
      if (!rateOptionClicked && !optionId) {
        logger.info('No specific option requested - falling back to first available "Prenota" button');
        
        const rateOptionSelectors = [
          '.RoomOption_CTA.e16r10jm0', // Primary selector for rate option buttons
          'button.RoomOption_CTA', // Generic rate option button
          '.RateWithOptions button:has-text("Prenota")', // Prenota button within rate options
          'button:has-text("Prenota")', // Any Prenota button
        ];
        
        for (const rateSelector of rateOptionSelectors) {
          try {
            logger.info(`Trying to click rate option "Prenota" with selector: ${rateSelector}`);
            
            const rateButton = await session.page.waitForSelector(rateSelector, { timeout: 30000 });
            if (rateButton) {
              // Wait for element to be fully interactive
              await session.page.waitForTimeout(1000);
              
              // Ensure element is visible and enabled
              const isVisible = await rateButton.isVisible();
              const isEnabled = await rateButton.isEnabled();
              
              if (isVisible && isEnabled) {
                // Scroll to element to ensure it's in view
                await rateButton.scrollIntoViewIfNeeded();
                await session.page.waitForTimeout(500);
                
                // Click with force to ensure it registers
                await rateButton.click({ force: true });
                
                // Wait a moment to see if navigation happens
                await session.page.waitForTimeout(2000);
                
                // Check if URL changed (indicates successful navigation)
                const newUrl = session.page.url();
                if (newUrl !== currentUrl) {
                  rateOptionClicked = true;
                  logger.info(`Successfully clicked rate option "Prenota" with selector: ${rateSelector}`);
                  break;
                } else {
                  logger.warn(`Button clicked but no navigation detected with selector: ${rateSelector}`);
                }
              } else {
                logger.warn(`Button found but not clickable: visible=${isVisible}, enabled=${isEnabled}`);
              }
            }
          } catch (error) {
            logger.debug(`Rate selector ${rateSelector} failed: ${error.message}`);
          }
        }
      }
      
      if (!rateOptionClicked) {
        logger.error('Failed to click any rate option "Prenota" button');
        return res.status(500).json({
          error: 'Failed to select rate option',
          message: 'Could not find or click rate option "Prenota" button'
        });
      }
    } else {
      logger.warn('❌ Booking options page not detected - proceeding anyway');
    }

    // Wait for navigation to customer data page
    logger.info('Waiting for navigation to customer data page...');
    
    await session.page.waitForTimeout(5000); // Give more time for navigation
    
    // DEBUG: Get current page state
    const finalUrl = session.page.url();
    const pageTitle = await session.page.title();
    logger.info('After clicking Prenota button:', {
      url: finalUrl,
      title: pageTitle
    });
    
    // Check if we're on customer data page by looking for form elements
    const isCustomerDataPage = await session.page.isVisible(
      'input[name="name"], input[name="firstName"], h2:has-text("Completa i tuoi dati")' 
    ).catch(() => false);

    if (!isCustomerDataPage) {
      logger.warn('Not on customer data page yet, taking screenshot for debugging');
      
      // DEBUG: Check for any forms or input fields on current page
      const allInputs = await session.page.locator('input').all();
      const inputInfo = [];
      
      for (let i = 0; i < Math.min(allInputs.length, 10); i++) {
        try {
          const input = allInputs[i];
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          const placeholder = await input.getAttribute('placeholder');
          const visible = await input.isVisible();
          
          inputInfo.push({ index: i, type, name, id, placeholder, visible });
        } catch (e) {
          // Skip this input
        }
      }
      
      logger.info('DEBUG - Current page inputs:', inputInfo);
      
      // Check for potential next steps or buttons
      const allButtons = await session.page.locator('button, input[type="button"], input[type="submit"]').all();
      const buttonInfo = [];
      
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        try {
          const button = allButtons[i];
          const text = await button.textContent();
          const className = await button.getAttribute('class');
          const visible = await button.isVisible();
          
          buttonInfo.push({ index: i, text: text?.trim(), class: className, visible });
        } catch (e) {
          // Skip this button
        }
      }
      
      logger.info('DEBUG - Current page buttons:', buttonInfo);
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

    // Fill personal data on the page
    const fillResult = await playwrightService.fillPersonalDataPage(
      session.page,
      personalData
    );

    if (fillResult.success) {
      // Click the "Continua" button after filling personal data
      logger.info('Clicking Continua button to proceed to payment page');
      
      try {
        // First, ensure privacy policy is accepted if not already
        logger.info('Ensuring privacy policy is accepted before clicking Continue');
        const privacySelectors = [
          'input[name="privacyPolicyAcceptance"]',
          'input[name="privacy"]',
          'input[type="checkbox"]' // Generic fallback
        ];
        
        for (const privacySelector of privacySelectors) {
          try {
            const privacyCheckbox = await session.page.waitForSelector(privacySelector, { timeout: 2000 });
            if (privacyCheckbox) {
              const isChecked = await privacyCheckbox.isChecked();
              if (!isChecked) {
                await privacyCheckbox.check();
                logger.info(`Privacy policy accepted with selector: ${privacySelector}`);
                await session.page.waitForTimeout(1000); // Give time for UI to update
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Try multiple selectors for the Continue button
        const continueSelectors = [
          'button.CustomerDataCollectionPage_CTA',
          '.CustomerDataCollectionPage_CTA',
          'button.CustomerDataCollectionPage_CTA.CTA',
          'button:has-text("Continua")',
          'button[type="submit"]',
          '.CTA:has-text("Continua")',
          'button.CTA'
        ];
        
        let continueClicked = false;
        let usedSelector = null;
        
        for (const selector of continueSelectors) {
          try {
            logger.info(`Trying Continue button selector: ${selector}`);
            
            // Wait for selector with shorter timeout to try multiple selectors quickly
            const button = await session.page.waitForSelector(selector, { timeout: 3000 });
            if (button) {
              const isVisible = await button.isVisible();
              const isEnabled = await button.isEnabled();
              
              logger.info(`Continue button found: visible=${isVisible}, enabled=${isEnabled}`);
              
              if (isVisible && isEnabled) {
                await button.click();
                continueClicked = true;
                usedSelector = selector;
                logger.info(`Successfully clicked Continue button with selector: ${selector}`);
                break;
              } else {
                logger.warn(`Continue button found but not clickable: visible=${isVisible}, enabled=${isEnabled}`);
              }
            }
          } catch (e) {
            logger.debug(`Continue selector ${selector} failed: ${e.message}`);
            continue;
          }
        }
        
        if (!continueClicked) {
          // Take screenshot for debugging before throwing error
          await session.page.screenshot({ 
            path: `backend/logs/continue-button-not-found-${sessionId}.png`,
            fullPage: true
          });
          
          throw new Error('Could not find or click Continue button with any selector');
        }
        
        // Wait for navigation to payment page
        logger.info('Waiting for navigation to payment page...');
        await session.page.waitForTimeout(5000); // Give time for page to load
        
        // Take screenshot to verify we're on the payment page
        await session.page.screenshot({ 
          path: `backend/logs/after-continua-click-${sessionId}.png`,
          fullPage: true
        });
        
        // Verify we're on the payment page by checking for payment elements
        const isOnPaymentPage = await session.page.evaluate(() => {
          const paymentIndicators = [
            'input[name="mobilePhone"]',
            '.PaymentMethodsForm',
            'h2:contains("Scegli come garantire")',
            '.GuaranteeDataCollectionPage'
          ];
          
          return paymentIndicators.some(selector => {
            try {
              return document.querySelector(selector) !== null;
            } catch (e) {
              return false;
            }
          });
        });
        
        if (isOnPaymentPage) {
          logger.info('Successfully navigated to payment page');
        } else {
          logger.warn('May not be on payment page yet, but continuing...');
        }
        
        logger.info(`Continue button clicked successfully using selector: ${usedSelector}`);
        
      } catch (error) {
        logger.error('Error clicking Continua button:', error);
        throw new Error(`Failed to click Continua button: ${error.message}`);
      }

      // Update session - move to payment step
      session.currentStep = 'payment';
      session.personalDataFilled = true;
      session.personalData = personalData;
      session.updatedAt = new Date();
      
      logger.info('Personal data filled successfully and "Continua" button clicked', {
        sessionId,
        email: personalData.email
      });

      res.json({
        success: true,
        sessionId,
        message: 'Personal data filled and "Continua" clicked',
        currentStep: 'payment',
        nextAction: 'Prepare for payment data input'
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
      cardHolder: Joi.string().required(), // Campo titolare carta richiesto
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
