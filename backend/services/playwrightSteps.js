const { ChromiumBrowser, chromium } = require('playwright');
const logger = require('../utils/logger');
const uuid = require('uuid');
const { 
  handleCookieConsent, 
  analyzeAvailabilityResults, 
  waitForAvailabilityResults,
  AVAILABILITY_RESULTS_SELECTORS,
  BOOKING_COMPLETION_SELECTORS
} = require('./aiSelector');

let browserInstance;

async function initBrowser() {
  logger.info('Initializing Playwright browser');
  
  // Launch a new browser if not already done
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
      args: [
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-dev-shm-usage',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-camera',
        '--disable-microphone',
        '--deny-permission-prompts',
        '--disable-permissions-api',
        '--block-new-web-contents'
      ]
    });
  }
  return browserInstance;
}

// Improved date selection using real DOM structure
async function selectDateFromRealCalendar(page, dateString, isCheckIn = true) {
  logger.info('Selecting date from real SimpleBooking calendar', { date: dateString, isCheckIn });
  
  try {
    const targetDate = new Date(dateString);
    const targetDay = targetDate.getDate();
    const targetMonth = targetDate.getMonth(); // 0-based (0=January)
    const targetYear = targetDate.getFullYear();
    
    logger.info('Target date parsed', { day: targetDay, month: targetMonth, year: targetYear });
    
    // Wait for calendar to be fully loaded
    await page.waitForTimeout(2000);
    
    // Navigate to correct month if needed
    await navigateToCorrectMonth(page, targetMonth, targetYear);
    
    // Find the date button with the exact day number
    const dayButtons = await page.locator('button.Calendar__Day.enabled').all();
    
    for (const button of dayButtons) {
      try {
        // Get the day number from the button's text content
        const dayText = await button.locator('span[aria-hidden="true"]').textContent();
        
        if (dayText && parseInt(dayText.trim()) === targetDay) {
          // Check if this button has correct availability
          const buttonClass = await button.getAttribute('class');
          const isAvailable = buttonClass.includes('availability_full') || 
                            (isCheckIn && buttonClass.includes('availability_check_in'));
          
          if (isAvailable) {
            await button.click();
            logger.info('Date selected successfully', { day: targetDay, class: buttonClass });
            await page.waitForTimeout(1000);
            return true;
          }
        }
      } catch (e) {
        // Continue to next button
      }
    }
    
    logger.warn('Could not find available date button', { targetDay });
    return false;
    
  } catch (error) {
    logger.error('Error in selectDateFromRealCalendar:', error);
    return false;
  }
}

// Navigate to correct month using real SimpleBooking navigation
async function navigateToCorrectMonth(page, targetMonth, targetYear) {
  try {
    // Get current month from the first month button
    const firstMonthButton = await page.locator('button.ltr-146b9ar.e13n5vxp4').first();
    const monthText = await firstMonthButton.locator('p.e13n5vxp3.Paragraph b').textContent();
    
    logger.info('Current calendar month text:', { monthText });
    
    if (!monthText) {
      logger.warn('Could not read current month text');
      return false;
    }
    
    // Parse Italian month names
    const italianMonths = {
      'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
      'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
    };
    
    let currentMonth = null;
    let currentYear = null;
    
    for (const [monthName, monthIndex] of Object.entries(italianMonths)) {
      if (monthText.toLowerCase().includes(monthName)) {
        currentMonth = monthIndex;
        const yearMatch = monthText.match(/\b(20\d{2})\b/);
        currentYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        break;
      }
    }
    
    if (currentMonth === null) {
      logger.warn('Could not parse current month');
      return false;
    }
    
    const monthDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
    logger.info('Month navigation calculation', {
      current: { month: currentMonth, year: currentYear },
      target: { month: targetMonth, year: targetYear },
      diff: monthDiff
    });
    
    if (monthDiff === 0) {
      logger.info('Already in target month');
      return true;
    }
    
    // Navigate forward or backward
    const isForward = monthDiff > 0;
    const steps = Math.abs(monthDiff);
    const buttonSelector = isForward ? 
      'button.Calendar__Navigation__NextMonth' : 
      'button.Calendar__Navigation__PrevMonth';
    
    for (let i = 0; i < Math.min(steps, 12); i++) { // Limit to 1 year
      try {
        const navButton = await page.locator(buttonSelector);
        if (await navButton.isVisible({ timeout: 1000 })) {
          await navButton.click();
          await page.waitForTimeout(1000);
          logger.info(`Navigated ${isForward ? 'forward' : 'backward'} one month`, { step: i + 1 });
        } else {
          logger.warn('Navigation button not visible');
          break;
        }
      } catch (e) {
        logger.warn('Failed to click navigation button:', e.message);
        break;
      }
    }
    
    return true;
    
  } catch (error) {
    logger.error('Error in navigateToCorrectMonth:', error);
    return false;
  }
}

async function createPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Block tracking scripts and ads for better performance
  await page.route('**/*', route => {
    const url = route.request().url();
    
    // Block known tracking and analytics domains
    const blockedDomains = [
      'googletagmanager.com',
      'google-analytics.com',
      'facebook.net',
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com'
    ];
    
    const shouldBlock = blockedDomains.some(domain => url.includes(domain));
    
    if (shouldBlock) {
      logger.info('Blocked tracking script:', { url });
      route.abort();
    } else {
      route.continue();
    }
  });
  
  logger.info('New page created with tracking protection');
  return page;
}

// Helper function to capture screenshot for debugging
async function captureScreenshot(page, filename) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `logs/screenshot-${filename}-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info('Screenshot captured', { path: screenshotPath });
    return screenshotPath;
  } catch (error) {
    logger.error('Failed to capture screenshot:', error);
    return null;
  }
}

// Helper function to select date from calendar
async function selectDateFromCalendar(page, dateString, calendarSelectors) {
  logger.info('Selecting date from calendar', { date: dateString });
  
  try {
    const targetDate = new Date(dateString);
    const targetDay = targetDate.getDate();
    const targetMonth = targetDate.getMonth(); // 0-based
    const targetYear = targetDate.getFullYear();
    
    // Wait for calendar to be visible
    await page.waitForTimeout(1500);
    
    // First check if we need to navigate to the correct month
    await navigateToMonth(page, targetMonth, targetYear, calendarSelectors);
    
    // Try different selectors for date cells specific to SimpleBooking
    const possibleSelectors = [
      // SimpleBooking specific selectors
      `.Calendar__Day.enabled:has-text("${targetDay}")`,
      `.Calendar__Day:has-text("${targetDay}"):not(.disabled):not(.past)`,
      `.Calendar__Day[data-date*="${targetDay}"]:not(.disabled)`,
      // Generic selectors
      `[data-date='${dateString}']`,
      `[data-day='${targetDay}']`,
      `.day[data-date='${dateString}']`,
      `.calendar-day[data-date='${dateString}']`,
      `button[data-date='${dateString}']`,
      `td[data-date='${dateString}']`,
      calendarSelectors?.dateCell?.replace('2025-07-28', dateString)
    ].filter(Boolean);
    
    // Try each selector
    for (const selector of possibleSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }) && await element.isEnabled()) {
          await element.click();
          logger.info('Date selected successfully', { selector, date: dateString });
          return true;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Enhanced fallback: try to find date by text content with better context
    try {
      const dayText = targetDay.toString();
      // Look for enabled calendar days with the target text
      const dayElements = [
        page.locator(`.Calendar__Day.enabled`).filter({ hasText: dayText }).first(),
        page.locator(`.Calendar__Day:not(.disabled)`).filter({ hasText: dayText }).first(),
        page.locator(`[class*="day"]:not([class*="disabled"])`).filter({ hasText: dayText }).first(),
        page.locator(`text=${dayText}`).first()
      ];
      
      for (const dayElement of dayElements) {
        try {
          if (await dayElement.isVisible({ timeout: 2000 }) && await dayElement.isEnabled()) {
            await dayElement.click();
            logger.info('Date selected by text content', { day: dayText });
            return true;
          }
        } catch (e) {
          // Continue to next element
        }
      }
    } catch (e) {
      // Continue
    }
    
    logger.warn('Could not select date from calendar', { date: dateString });
    return false;
  } catch (error) {
    logger.error('Error selecting date from calendar:', error);
    return false;
  }
}

// Helper function to navigate to the correct month in calendar
async function navigateToMonth(page, targetMonth, targetYear, calendarSelectors) {
  try {
    await page.waitForTimeout(1000); // Wait for calendar to stabilize
    
    // Try multiple approaches to detect current calendar month
    let currentMonth = null;
    let currentYear = null;
    
    // Approach 1: Look for month header text - try more specific selectors first
    const monthHeaderSelectors = [
      '.Calendar__Header .Calendar__Month',
      '.Calendar__Header',
      '.Calendar__Navigation h3', // SimpleBooking might use h3 for month display
      '.Calendar__Navigation span', // Or span
      '.calendar-header',
      '[class*="month"][class*="header"]',
      '[class*="Calendar"][class*="Month"]',
      '.Calendar__Navigation', // Try the navigation container itself
    ];
    
    for (const selector of monthHeaderSelectors) {
      try {
        const monthElement = await page.locator(selector).first();
        if (await monthElement.isVisible({ timeout: 1000 })) {
          const monthText = await monthElement.textContent();
          logger.info('Found calendar header:', { selector, text: monthText });
          
          if (monthText && monthText.trim()) {
            // Try to parse Italian month names (case insensitive)
            const monthNames = {
              'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
              'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11,
              'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
              'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
              // Also try short forms
              'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5,
              'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11
            };
            
            const lowerText = monthText.toLowerCase();
            for (const [monthName, monthIndex] of Object.entries(monthNames)) {
              if (lowerText.includes(monthName)) {
                currentMonth = monthIndex;
                // Extract year if present
                const yearMatch = monthText.match(/\b(20\d{2})\b/);
                if (yearMatch) {
                  currentYear = parseInt(yearMatch[1]);
                } else {
                  // Default to current year if not found
                  currentYear = new Date().getFullYear();
                }
                logger.info('Parsed calendar month:', { monthName, monthIndex, year: currentYear });
                break;
              }
            }
            
            if (currentMonth !== null) break;
          }
        }
      } catch (e) {
        logger.warn('Failed to read month header:', { selector, error: e.message });
        continue;
      }
    }
    
    // Fallback: assume calendar shows current month if we can't detect
    if (currentMonth === null) {
      const now = new Date();
      currentMonth = now.getMonth();
      currentYear = now.getFullYear();
      logger.info('Using fallback current date', { currentMonth, currentYear });
    }
    
    const monthDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
    logger.info('Calendar navigation needed', { 
      currentMonth, currentYear, targetMonth, targetYear, monthDiff 
    });
    
    if (monthDiff === 0) {
      logger.info('Already in target month');
      return true;
    }
    
    // Try multiple selectors for navigation buttons
    const nextSelectors = [
      calendarSelectors.monthNavNext,
      '.Calendar__Navigation__NextMonth',
      '.Calendar__Navigation .next',
      '[class*="next"][class*="month"]',
      '[class*="Calendar"][class*="Next"]',
      'button[class*="next"]',
      '.fa-chevron-right',
      '.fa-arrow-right'
    ].filter(Boolean);
    
    const prevSelectors = [
      calendarSelectors.monthNavPrev,
      '.Calendar__Navigation__PrevMonth', 
      '.Calendar__Navigation .prev',
      '[class*="prev"][class*="month"]',
      '[class*="Calendar"][class*="Prev"]',
      'button[class*="prev"]',
      '.fa-chevron-left',
      '.fa-arrow-left'
    ].filter(Boolean);
    
    if (monthDiff > 0) {
      // Navigate forward
      for (let i = 0; i < Math.min(monthDiff, 24); i++) { // Limit to 2 years max
        let navigated = false;
        for (const selector of nextSelectors) {
          try {
            const nextButton = page.locator(selector).first();
            if (await nextButton.isVisible({ timeout: 1000 })) {
              await nextButton.click();
              await page.waitForTimeout(800);
              logger.info('Navigated forward one month', { iteration: i + 1, selector });
              navigated = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        if (!navigated) {
          logger.warn('Could not navigate to next month', { iteration: i + 1 });
          break;
        }
      }
    } else if (monthDiff < 0) {
      // Navigate backward  
      for (let i = 0; i < Math.min(Math.abs(monthDiff), 24); i++) { // Limit to 2 years max
        let navigated = false;
        for (const selector of prevSelectors) {
          try {
            const prevButton = page.locator(selector).first();
            if (await prevButton.isVisible({ timeout: 1000 })) {
              await prevButton.click();
              await page.waitForTimeout(800);
              logger.info('Navigated backward one month', { iteration: i + 1, selector });
              navigated = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        if (!navigated) {
          logger.warn('Could not navigate to previous month', { iteration: i + 1 });
          break;
        }
      }
    }
    
    // Give calendar time to update after navigation
    await page.waitForTimeout(1000);
    return true;
    
  } catch (error) {
    logger.warn('Error navigating calendar months:', error.message);
    return false;
  }
}

async function executeSearch(page, aiResponse, params) {
  logger.info('Executing search...', { params });

  const selectors = aiResponse.selectors || {};
  const calendarSelectors = aiResponse.calendarSelectors || {};
  const dateSelectionMethod = aiResponse.dateSelectionMethod || 'fill';
  
  try {
    // Handle check-in date
    if (selectors.checkinDate) {
      await page.waitForSelector(selectors.checkinDate, { timeout: 5000 });
      
      if (dateSelectionMethod === 'calendar' || dateSelectionMethod === 'click') {
        // Take screenshot before calendar interaction
        await captureScreenshot(page, 'before-checkin-calendar');
        
        // Click to open calendar
        await page.click(selectors.checkinDate);
        await page.waitForTimeout(1000);
        
        // Take screenshot after opening calendar
        await captureScreenshot(page, 'checkin-calendar-opened');
        
        // Select date from calendar
        const dateSelected = await selectDateFromCalendar(page, params.checkinDate, calendarSelectors);
        if (!dateSelected) {
          logger.warn('Calendar date selection failed, trying direct fill');
          await captureScreenshot(page, 'checkin-calendar-failed');
          // Fallback to fill if calendar selection fails
          try {
            await page.fill(selectors.checkinDate, params.checkinDate);
          } catch (fillError) {
            logger.error('Both calendar and fill methods failed for check-in date');
            await captureScreenshot(page, 'checkin-all-failed');
          }
        } else {
          await captureScreenshot(page, 'checkin-calendar-success');
        }
      } else {
        // Direct fill method
        await page.fill(selectors.checkinDate, params.checkinDate);
      }
      
      await page.waitForTimeout(500);
    }

    // Handle check-out date
    if (selectors.checkoutDate) {
      await page.waitForSelector(selectors.checkoutDate, { timeout: 5000 });
      
      if (dateSelectionMethod === 'calendar' || dateSelectionMethod === 'click') {
        // For SimpleBooking, the calendar might need to be reopened for checkout date
        // Since both dates use the same selector, click it to ensure calendar is open
        await page.click(selectors.checkoutDate);
        await page.waitForTimeout(1500); // Longer wait for calendar to stabilize
        
        // Take screenshot before checkout date selection
        await captureScreenshot(page, 'before-checkout-calendar');
        
        // Select date from calendar
        const dateSelected = await selectDateFromCalendar(page, params.checkoutDate, calendarSelectors);
        if (dateSelected) {
          await captureScreenshot(page, 'checkout-calendar-success');
        } else {
          logger.warn('Calendar date selection failed, trying direct fill');
          await captureScreenshot(page, 'checkout-calendar-failed');
          try {
            await page.fill(selectors.checkoutDate, params.checkoutDate);
          } catch (fillError) {
            logger.error('Both calendar and fill methods failed for check-out date');
            await captureScreenshot(page, 'checkout-all-failed');
          }
        }
      } else {
        await page.fill(selectors.checkoutDate, params.checkoutDate);
      }
      
      await page.waitForTimeout(500);
    }

    // Handle adults selection
    if (selectors.adultsSelector) {
      await page.waitForSelector(selectors.adultsSelector, { timeout: 5000 });
      
      try {
        // Try clicking first (might open a dropdown)
        await page.click(selectors.adultsSelector);
        await page.waitForTimeout(500);
        
        // Try to find and click the specific number
        const adultOption = page.locator(`text=${params.adults}`).or(
          page.locator(`[data-value='${params.adults}']`)
        ).first();
        
        if (await adultOption.isVisible({ timeout: 2000 })) {
          await adultOption.click();
        } else {
          // Fallback to selectOption
          await page.selectOption(selectors.adultsSelector, String(params.adults));
        }
      } catch (error) {
        logger.warn('Error selecting adults, trying selectOption fallback:', error.message);
        await page.selectOption(selectors.adultsSelector, String(params.adults));
      }
    }

    // Handle children selection
    if (params.children > 0 && selectors.childrenSelector) {
      await page.waitForSelector(selectors.childrenSelector, { timeout: 5000 });
      
      try {
        await page.click(selectors.childrenSelector);
        await page.waitForTimeout(500);
        
        const childOption = page.locator(`text=${params.children}`).or(
          page.locator(`[data-value='${params.children}']`)
        ).first();
        
        if (await childOption.isVisible({ timeout: 2000 })) {
          await childOption.click();
        } else {
          await page.selectOption(selectors.childrenSelector, String(params.children));
        }
      } catch (error) {
        logger.warn('Error selecting children, trying selectOption fallback:', error.message);
        await page.selectOption(selectors.childrenSelector, String(params.children));
      }
    }

    // Close any open dropdowns/calendars
    if (calendarSelectors.closeCalendar) {
      try {
        await page.click(calendarSelectors.closeCalendar);
        await page.waitForTimeout(500);
      } catch (error) {
        // Ignore close errors
      }
    }

    // Click search button
    if (selectors.searchButton) {
      await page.waitForSelector(selectors.searchButton, { timeout: 5000 });
      await page.click(selectors.searchButton);
    }

    // Wait for results to load
    await page.waitForTimeout(3000);

    logger.info('Search executed successfully');
    return { 
      message: 'Search executed successfully', 
      selectors: aiResponse.selectors,
      confidence: aiResponse.confidence,
      dateSelectionMethod: dateSelectionMethod
    };
  } catch (error) {
    logger.error('Error executing search:', error);
    // Capture screenshot for debugging
    await captureScreenshot(page, 'search-error');
    throw new Error(`Search execution failed: ${error.message}`);
  }
}

async function selectRoom(page, selectionInstructions, roomId) {
  logger.info('Selecting room...', { roomId });

  try {
    // Use instructions from GPT to perform room selection
    await page.click(selectionInstructions.selectRoomButton);

    logger.info('Room selected successfully');
    return { message: 'Room selected', roomId };
  } catch (error) {
    logger.error('Error selecting room:', error);
    throw error;
  }
}

async function submitBooking(page, formInstructions, personalData) {
  logger.info('Submitting booking...', { email: personalData.email });

  try {
    // Use instructions from GPT to fill in personal data and perform booking
    await page.fill(formInstructions.firstName, personalData.firstName);
    await page.fill(formInstructions.lastName, personalData.lastName);
    await page.fill(formInstructions.email, personalData.email);
    await page.fill(formInstructions.phone, personalData.phone);
    await page.fill(formInstructions.cardNumber, personalData.cardNumber);
    await page.fill(formInstructions.cvv, personalData.cvv);
    await page.fill(formInstructions.expiryMonth, personalData.expiryMonth);
    await page.fill(formInstructions.expiryYear, personalData.expiryYear);
    await page.click(formInstructions.acceptCheck);
    await page.click(formInstructions.submitButton);

    logger.info('Booking submitted successfully');
    return { message: 'Booking submitted' };
  } catch (error) {
    logger.error('Error submitting booking:', error);
    throw error;
  }
}

async function cleanup(browser) {
  logger.info('Cleaning up browser session');
  await browser.close();
}

// New improved search function using real DOM structure
async function executeSearchWithRealDOM(page, params) {
  logger.info('Executing search with real DOM selectors...', { params });
  
  try {
    // First handle cookie consent if present
    await handleCookieConsent(page);
    
    // Use precise selectors based on the real HTML structure
    const calendarButton = 'button.OpenPanelCTA.SearchWidget__Calendar_CTA';
    const searchButton = 'a#PanelSearchWidgetCTA';
    
    // Take initial screenshot
    await captureScreenshot(page, 'search-start');
    
    // Click the calendar button to open the date picker
    logger.info('Clicking calendar button');
    await page.waitForSelector(calendarButton, { timeout: 10000 });
    await page.click(calendarButton);
    
    // Wait for calendar to open and stabilize
    await page.waitForTimeout(2000);
    await captureScreenshot(page, 'calendar-opened');
    
    // Select check-in date using improved method
    logger.info('Selecting check-in date');
    const checkinSuccess = await selectDateFromRealCalendar(page, params.checkinDate, true);
    
    if (!checkinSuccess) {
      logger.error('Failed to select check-in date');
      await captureScreenshot(page, 'checkin-failed');
      throw new Error('Could not select check-in date');
    }
    
    await captureScreenshot(page, 'checkin-selected');
    
    // Select check-out date
    logger.info('Selecting check-out date');
    const checkoutSuccess = await selectDateFromRealCalendar(page, params.checkoutDate, false);
    
    if (!checkoutSuccess) {
      logger.error('Failed to select check-out date');
      await captureScreenshot(page, 'checkout-failed');
      throw new Error('Could not select check-out date');
    }
    
    await captureScreenshot(page, 'checkout-selected');
    
    // Handle guest selection if needed
    if (params.adults !== 2) { // Only change if not default
      try {
        const guestButton = 'button.OpenPanelCTA.SearchWidget__Allocations_CTA';
        await page.click(guestButton);
        await page.waitForTimeout(1000);
        // Logic to change guest count would go here if needed
      } catch (e) {
        logger.warn('Guest selection not needed or failed, continuing...', e.message);
      }
    }
    
    // Click search button
    logger.info('Clicking search button');
    await page.waitForSelector(searchButton, { timeout: 5000 });
    await page.click(searchButton);
    
    // Wait for page to load
    await page.waitForTimeout(5000);
    await captureScreenshot(page, 'search-completed');
    
    logger.info('Search executed successfully with real DOM selectors');
    return {
      message: 'Search executed successfully with real DOM selectors',
      method: 'realDOM',
      confidence: 'alto'
    };
    
  } catch (error) {
    logger.error('Error in executeSearchWithRealDOM:', error);
    await captureScreenshot(page, 'search-real-dom-error');
    throw new Error(`Real DOM search failed: ${error.message}`);
  }
}

// Funzione per compilare la prima pagina (dati personali)
async function fillPersonalDataPage(page, personalData) {
  logger.info('Filling personal data page', { email: personalData.email });
  
  try {
    // Take initial screenshot
    await captureScreenshot(page, 'personal-data-start');
    
    // 1. Fill first name
    const firstNameSelectors = [
      'input[name="name"]',
      'input[name="firstName"]',
      'input[id*="first"]',
      'input[placeholder*="Nome"]'
    ];
    
    for (const selector of firstNameSelectors) {
      try {
        const field = await page.locator(selector).first();
        if (await field.isVisible({ timeout: 2000 })) {
          await field.fill(personalData.firstName);
          logger.info('First name filled with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // 2. Fill last name
    const lastNameSelectors = [
      'input[name="lastName"]',
      'input[name="surname"]',
      'input[id*="last"]',
      'input[placeholder*="Cognome"]'
    ];
    
    for (const selector of lastNameSelectors) {
      try {
        const field = await page.locator(selector).first();
        if (await field.isVisible({ timeout: 2000 })) {
          await field.fill(personalData.lastName);
          logger.info('Last name filled with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // 3. Fill email
    const emailSelectors = [
      'input[name="email"]:first-of-type',
      'input[type="email"]:first-of-type',
      'input[id*="email"]:first-of-type',
      'input[placeholder*="email"]'
    ];
    
    for (const selector of emailSelectors) {
      try {
        const field = await page.locator(selector).first();
        if (await field.isVisible({ timeout: 2000 })) {
          await field.fill(personalData.email);
          logger.info('Email filled with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // 4. Fill email confirmation
    const emailConfirmSelectors = [
      'input[name="emailConfirm"]',
      'input[type="email"]:nth-of-type(2)',
      'input[placeholder*="conferma"]',
      'input[placeholder*="Conferma"]'
    ];
    
    for (const selector of emailConfirmSelectors) {
      try {
        const field = await page.locator(selector).first();
        if (await field.isVisible({ timeout: 2000 })) {
          await field.fill(personalData.email); // Same as email
          logger.info('Email confirmation filled with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // 5. Accept privacy policy (mandatory)
    const privacySelectors = [
      'input[name="privacyPolicyAcceptance"]',
      'input[name="privacy"]',
      'input[type="checkbox"]', // Generic checkbox fallback
      'input[id*="privacy"]'
    ];
    
    for (const selector of privacySelectors) {
      try {
        const checkbox = await page.locator(selector).first();
        if (await checkbox.isVisible({ timeout: 2000 })) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.check();
            logger.info('Privacy policy accepted with selector:', selector);
          }
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // 6. Optionally accept newsletter
    if (personalData.acceptNewsletter) {
      const newsletterSelectors = [
        'input[name="newsletterSubscription"]',
        'input[name="newsletter"]',
        'input[id*="newsletter"]'
      ];
      
      for (const selector of newsletterSelectors) {
        try {
          const checkbox = await page.locator(selector).first();
          if (await checkbox.isVisible({ timeout: 2000 })) {
            const isChecked = await checkbox.isChecked();
            if (!isChecked) {
              await checkbox.check();
              logger.info('Newsletter accepted with selector:', selector);
            }
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Take screenshot before clicking continue
    await captureScreenshot(page, 'personal-data-filled');
    
    // 7. Click "Continua" button to proceed to payment page
    const continueSelectors = [
      'button.CustomerDataCollectionPage_CTA',
      'button:has-text("Continua")',
      'button:has-text("CONTINUA")', 
      'button:has-text("Procedi")',
      'button:has-text("PROCEDI")',
      '.CustomerDataCollectionPage_CTA',
      'button[type="submit"]',
      'input[type="submit"]',
      '.CTA:has-text("Continua")',
      '[class*="CTA"]:has-text("Continua")',
      '[class*="Button"]:has-text("Continua")',
      'a:has-text("Continua")',
      'a.CTA',
      'button', // Generic button as last fallback
    ];
    
    let continueClicked = false;
    
    for (const selector of continueSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          await button.click();
          logger.info('Continue button clicked with selector:', selector);
          continueClicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!continueClicked) {
      throw new Error('Could not find or click continue button');
    }
    
    // Wait for navigation to payment page
    logger.info('Waiting for navigation to payment page...');
    await page.waitForTimeout(3000); // Wait for page transition
    
    // Take screenshot of payment page
    await captureScreenshot(page, 'payment-page-loaded');
    
    return {
      success: true,
      message: 'Personal data filled and navigated to payment page'
    };
    
  } catch (error) {
    logger.error('Error filling personal data page:', error);
    await captureScreenshot(page, 'personal-data-error');
    
    return {
      success: false,
      message: `Failed to fill personal data: ${error.message}`,
      error: error.message
    };
  }
}

// Funzione per completare la prenotazione (pagina finale con carta di credito)
async function completeBookingWithRealSelectors(page, bookingData, testMode = false) {
  logger.info('Completing booking with real selectors', { 
    email: bookingData.email, 
    testMode 
  });
  
  try {
    // Take initial screenshot
    await captureScreenshot(page, 'booking-completion-start');
    
    // 1. Fill phone number if required
    if (bookingData.phone) {
      try {
        await page.waitForSelector(BOOKING_COMPLETION_SELECTORS.mobilePhone, { timeout: 5000 });
        await page.fill(BOOKING_COMPLETION_SELECTORS.mobilePhone, bookingData.phone);
        logger.info('Phone number filled');
      } catch (error) {
        logger.warn('Phone field not found or already filled');
      }
    }
    
    // 2. Select payment method (default to credit card)
    const paymentMethod = bookingData.paymentMethod || 'credit_card';
    
    if (paymentMethod === 'credit_card') {
      try {
        await page.waitForSelector(BOOKING_COMPLETION_SELECTORS.creditCardRadio, { timeout: 5000 });
        await page.check(BOOKING_COMPLETION_SELECTORS.creditCardRadio);
        logger.info('Credit card payment method selected');
        
        // Wait for credit card fields to appear (they might load dynamically)
        await page.waitForTimeout(2000);
        
        // 3. Fill credit card details if provided
        if (bookingData.cardNumber && !testMode) {
          const cardSelectors = [
            BOOKING_COMPLETION_SELECTORS.cardNumber,
            'input[name*="card"][name*="number"]',
            'input[placeholder*="card"][placeholder*="number"]',
            '#cardNumber',
            '.card-number input'
          ];
          
          for (const selector of cardSelectors) {
            try {
              const cardField = await page.locator(selector).first();
              if (await cardField.isVisible({ timeout: 2000 })) {
                await cardField.fill(bookingData.cardNumber);
                logger.info('Card number filled');
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          // Card expiry
          if (bookingData.cardExpiry) {
            const expirySelectors = [
              BOOKING_COMPLETION_SELECTORS.cardExpiry,
              'input[name*="expir"]',
              'input[placeholder*="MM/YY"]',
              '#cardExpiry'
            ];
            
            for (const selector of expirySelectors) {
              try {
                const expiryField = await page.locator(selector).first();
                if (await expiryField.isVisible({ timeout: 2000 })) {
                  await expiryField.fill(bookingData.cardExpiry);
                  logger.info('Card expiry filled');
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
          
          // CVV
          if (bookingData.cvv) {
            const cvvSelectors = [
              BOOKING_COMPLETION_SELECTORS.cardCvv,
              'input[name*="cvv"]',
              'input[name*="cvc"]',
              'input[placeholder*="CVV"]',
              '#cvv'
            ];
            
            for (const selector of cvvSelectors) {
              try {
                const cvvField = await page.locator(selector).first();
                if (await cvvField.isVisible({ timeout: 2000 })) {
                  await cvvField.fill(bookingData.cvv);
                  logger.info('CVV filled');
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
          
          // Card holder name
          if (bookingData.cardHolder) {
            const holderSelectors = [
              BOOKING_COMPLETION_SELECTORS.cardHolder,
              'input[name*="holder"]',
              'input[placeholder*="nome"]',
              '#cardHolder'
            ];
            
            for (const selector of holderSelectors) {
              try {
                const holderField = await page.locator(selector).first();
                if (await holderField.isVisible({ timeout: 2000 })) {
                  await holderField.fill(bookingData.cardHolder);
                  logger.info('Card holder filled');
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
        } else {
          logger.info('Test mode or no card details provided, skipping card fields');
        }
        
      } catch (error) {
        logger.error('Error with credit card payment method:', error);
        throw new Error('Failed to select credit card payment');
      }
    } else if (paymentMethod === 'bank_transfer') {
      try {
        await page.waitForSelector(BOOKING_COMPLETION_SELECTORS.bankTransferRadio, { timeout: 5000 });
        await page.check(BOOKING_COMPLETION_SELECTORS.bankTransferRadio);
        logger.info('Bank transfer payment method selected');
      } catch (error) {
        logger.warn('Bank transfer option not found, continuing with credit card');
      }
    }
    
    // 4. Accept terms and conditions (mandatory)
    try {
      await page.waitForSelector(BOOKING_COMPLETION_SELECTORS.termsCheckbox, { timeout: 5000 });
      const isChecked = await page.isChecked(BOOKING_COMPLETION_SELECTORS.termsCheckbox);
      if (!isChecked) {
        await page.check(BOOKING_COMPLETION_SELECTORS.termsCheckbox);
        logger.info('Terms and conditions accepted');
      }
    } catch (error) {
      logger.error('Could not find or check terms checkbox:', error);
      throw new Error('Terms and conditions checkbox is required');
    }
    
    // 5. Optionally subscribe to newsletter
    if (bookingData.acceptNewsletter) {
      try {
        await page.waitForSelector(BOOKING_COMPLETION_SELECTORS.newsletterCheckbox, { timeout: 3000 });
        const isChecked = await page.isChecked(BOOKING_COMPLETION_SELECTORS.newsletterCheckbox);
        if (!isChecked) {
          await page.check(BOOKING_COMPLETION_SELECTORS.newsletterCheckbox);
          logger.info('Newsletter subscription accepted');
        }
      } catch (error) {
        logger.warn('Newsletter checkbox not found, continuing...');
      }
    }
    
    // Take screenshot before final submission
    await captureScreenshot(page, 'before-final-booking');
    
    // 6. Submit booking (this will attempt real payment in production)
    if (testMode) {
      logger.info('TEST MODE: Would submit booking but stopping here for safety');
      return {
        success: true,
        message: 'Test mode - booking form completed but not submitted',
        testMode: true,
        bookingReference: null
      };
    }
    
    logger.info('Proceeding with actual booking submission...');
    
    // Try both possible booking buttons
    const bookingButtons = [
      BOOKING_COMPLETION_SELECTORS.finalBookingButton,
      BOOKING_COMPLETION_SELECTORS.sidebarBookingButton
    ];
    
    let bookingSubmitted = false;
    
    for (const buttonSelector of bookingButtons) {
      try {
        const bookingButton = await page.locator(buttonSelector).first();
        if (await bookingButton.isVisible({ timeout: 3000 })) {
          await bookingButton.click();
          logger.info('Booking submitted via button:', buttonSelector);
          bookingSubmitted = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!bookingSubmitted) {
      throw new Error('Could not find or click booking button');
    }
    
    // 7. Wait for booking result and capture it
    logger.info('Waiting for booking result...');
    
    // Wait longer for payment processing
    await page.waitForTimeout(10000);
    
    // Take screenshot of result
    await captureScreenshot(page, 'booking-result');
    
    // Try to detect success or failure from page content
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    // Look for success indicators
    const successIndicators = [
      'prenotazione confermata',
      'booking confirmed',
      'conferma prenotazione',
      'numero di prenotazione',
      'booking reference',
      'conferma di prenotazione'
    ];
    
    // Look for error indicators
    const errorIndicators = [
      'errore',
      'error',
      'carta rifiutata',
      'declined',
      'payment failed',
      'pagamento fallito',
      'fondi insufficienti'
    ];
    
    const hasSuccess = successIndicators.some(indicator => 
      pageContent.toLowerCase().includes(indicator)
    );
    
    const hasError = errorIndicators.some(indicator => 
      pageContent.toLowerCase().includes(indicator)
    );
    
    // Try to extract booking reference if successful
    let bookingReference = null;
    if (hasSuccess) {
      const refMatches = pageContent.match(/(\w{8,}|[A-Z]{2,}\d{4,}|\d{8,})/g);
      if (refMatches && refMatches.length > 0) {
        bookingReference = refMatches[0]; // Take first match as potential reference
      }
    }
    
    const result = {
      success: hasSuccess && !hasError,
      message: hasSuccess ? 'Booking completed successfully' : 
               hasError ? 'Booking failed - payment or validation error' : 
               'Booking result unclear',
      bookingReference,
      url: currentUrl,
      timestamp: new Date().toISOString()
    };
    
    logger.info('Booking completion result:', result);
    return result;
    
  } catch (error) {
    logger.error('Error in completeBookingWithRealSelectors:', error);
    await captureScreenshot(page, 'booking-completion-error');
    
    return {
      success: false,
      message: `Booking completion failed: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  initBrowser,
  createPage,
  executeSearch,
  executeSearchWithRealDOM,
  selectRoom,
  submitBooking,
  fillPersonalDataPage,
  completeBookingWithRealSelectors,
  cleanup
};

