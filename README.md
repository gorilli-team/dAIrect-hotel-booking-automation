# 🏨 Hotel Booking Automation System

Un sistema completo per l'automazione delle prenotazioni hotel utilizzando **React**, **Node.js** e **Playwright**.

## 🎯 Obiettivo

Automatizzare completamente il processo di prenotazione dell'hotel **Palazzo Vitturi** a Venezia su **SimpleBooking** tramite:
- Frontend React moderno stile Booking.com
- Backend Node.js con automazione browser avanzata
- Playwright per l'interazione automatica intelligente con SimpleBooking
- Sistema di parsing HTML robusto e adattabile

## 🚀 Tecnologie Utilizzate

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Node.js + Express |
| **Automazione** | Playwright |
| **Parsing** | Cheerio + Custom Selectors |
| **Styling** | Tailwind CSS |
| **Logging** | Winston |
| **Validazione** | Joi |

## 📁 Struttura del Progetto

```
hotel-booking-automation/
├── package.json                     # Root package con workspaces
├── .env.example                     # Template variabili ambiente
├── README.md                        # Questa documentazione
│
├── frontend/                        # React Frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── components/              # Componenti React
│   │   │   ├── Header.jsx
│   │   │   ├── SearchForm.jsx
│   │   │   ├── RoomSelection.jsx
│   │   │   ├── BookingForm.jsx
│   │   │   ├── BookingResult.jsx
│   │   │   └── LoadingOverlay.jsx
│   │   ├── hooks/
│   │   │   └── useBooking.js        # Custom hook per stato
│   │   ├── services/
│   │   │   └── bookingService.js    # API client
│   │   ├── App.jsx                  # App principale
│   │   └── main.jsx                 # Entry point
│   └── index.html
│
└── backend/                         # Node.js Backend
    ├── package.json
    ├── server.js                    # Server Express
    ├── routes/
    │   └── booking.js               # API routes
    ├── services/
    │   ├── selectorService.js       # Intelligent HTML parsing
    │   └── playwrightSteps.js       # Automazione browser
    ├── utils/
    │   └── logger.js                # Logging Winston
    └── logs/                        # File di log e screenshots
```

## ⚙️ Setup e Installazione

### 1. Clona e installa dipendenze

```bash
# Clona il progetto
git clone <repository-url>
cd hotel-booking-automation

# Installa tutte le dipendenze (root + frontend + backend)
npm run install:all
```

### 2. Configura le variabili ambiente

```bash
# Copia il template
cp .env.example .env

# Modifica .env con i tuoi valori
nano .env
```

**Variabili richieste:**
```env
# Server Configuration  
PORT=3001
NODE_ENV=development

# Browser Configuration
HEADLESS=true                     # true per headless, false per vedere il browser
BROWSER_TIMEOUT=30000
TARGET_HOTEL_URL=https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR
```

### 3. Installa Playwright browsers

```bash
cd backend
npm run install-playwright
```

### 4. Avvia il sistema

```bash
# Dalla root del progetto, avvia frontend + backend
npm run dev
```

Oppure separatamente:
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

## 🎮 Come Utilizzare

### 1. **Ricerca Disponibilità**
- Apri http://localhost:5173
- Inserisci date check-in/out
- Seleziona numero ospiti
- Clicca "Avvia Automazione"

### 2. **Selezione Camera**
- Attendi che il sistema analizzi la pagina
- Vengono estratte camere disponibili con prezzi
- Seleziona la camera desiderata

### 3. **Dati Personali**
- Inserisci dati personali (precompilati per test)
- Dati carta di credito (fake per simulazione)
- Conferma prenotazione

### 4. **Risultato**
- Visualizza esito finale
- Codice prenotazione se successo
- Dettagli errore se fallimento

## 🔧 Come Funziona il Sistema

### Flusso di Automazione

1. **Analisi Pagina Search**
   ```javascript
   // Sistema intelligente identifica selettori dinamicamente
   const selectors = await selectorService.analyzeSearchPage(htmlContent)
   // Ritorna: { selectors: { checkinDate: "#checkin", ... } }
   ```

2. **Estrazione Camere**
   ```javascript
   // Parsing avanzato HTML per estrarre dati camere
   const rooms = await selectorService.extractRoomsData(htmlContent)
   // Ritorna: { rooms: [{ id, name, price, features }] }
   ```

3. **Selezione Camera**
   ```javascript
   // Trova automaticamente come selezionare camera specifica
   const instructions = await selectorService.findRoomSelector(html, roomId)
   ```

4. **Form di Prenotazione**  
   ```javascript
   // Identifica tutti i campi del form dinamicamente
   const formData = await selectorService.analyzeBookingForm(html, personalData)
   ```

5. **Risultato Finale**
   ```javascript
   // Determina automaticamente se prenotazione è riuscita
   const result = await selectorService.analyzeBookingResult(finalHtml)
   ```

## 📡 API Endpoints

### Backend Routes (`/api/booking`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/start-search` | Avvia ricerca disponibilità |
| `GET` | `/available-rooms/:sessionId` | Ottieni camere disponibili |
| `POST` | `/select-room` | Seleziona una camera |
| `POST` | `/submit-booking` | Completa prenotazione |
| `GET` | `/session/:sessionId/status` | Stato sessione |
| `DELETE` | `/session/:sessionId` | Pulisci sessione |

### Esempio Request/Response

```javascript
// POST /api/booking/start-search
{
  "checkinDate": "2024-01-15",
  "checkoutDate": "2024-01-17", 
  "adults": 2,
  "children": 0
}

// Response
{
  "success": true,
  "sessionId": "uuid-here",
  "message": "Search initialized successfully"
}
```

## 🛠️ Sviluppo e Debug

### Logging
```bash
# Visualizza log in tempo reale
tail -f backend/logs/booking.log

# Errori
tail -f backend/logs/error.log
```

### Screenshot Debug
I screenshot vengono salvati automaticamente in `backend/logs/`:
- `search-{sessionId}.png` - Dopo ricerca
- `rooms-{sessionId}.png` - Pagina camere
- `booking-final-{sessionId}.png` - Risultato finale

### Mode Sviluppo
- Frontend: hot reload su http://localhost:5173
- Backend: auto-restart con nodemon su http://localhost:3001
- Browser: headless (HEADLESS=true per performance, false per debugging)

## 🔒 Sicurezza e Limitazioni

### ⚠️ Importante
- **Nessun pagamento reale**: usa sempre dati di test
- **Rate limiting**: evita troppe richieste consecutive
- **Resilienza**: il sistema può fallire se il sito cambia struttura drasticamente
- **Rispetto dei Terms of Service**: usa responsabilmente

### Dati di Test Precompilati
```javascript
// Carta di credito di test
cardNumber: "4111111111111111"  // Visa test
expiryMonth: "12"
expiryYear: "2026"  
cvv: "123"

// Dati personali
firstName: "Mario"
lastName: "Rossi"
email: "mario.rossi@example.com"
```

## 🚀 Miglioramenti e Caratteristiche

### Resilienza Avanzata
- ✅ Retry automatico con backoff
- ✅ Selettori multipli e fallback intelligenti
- ✅ Screenshot automatici per debugging
- ✅ Logging dettagliato delle operazioni

### Parsing Intelligente
- ✅ Analisi DOM dinamica e adattabile
- ✅ Estrazione automatica di prezzi e disponibilità
- ✅ Riconoscimento pattern comuni nei form
- ✅ Gestione di strutture HTML variabili

### Sistema Robusto
- ✅ Gestione sessioni multiple
- ✅ Timeout e error handling avanzato
- ✅ Monitoraggio performance automazione
- ✅ Validazione dati completa

## 🛣️ Roadmap Future

### Espansioni Funzionalità
- [ ] Multi-hotel support
- [ ] Database persistente (Redis/PostgreSQL)  
- [ ] Dashboard admin con analytics
- [ ] API webhooks per notifiche
- [ ] Export reports in PDF

### Miglioramenti Tecnici
- [ ] Cache intelligente per performance
- [ ] Load balancing per multiple istanze
- [ ] Monitoring uptime e alerting
- [ ] Tests automatici E2E

### Ottimizzazioni Parsing
- [ ] Machine learning per pattern recognition
- [ ] Auto-learning di nuovi selettori
- [ ] A/B testing per algoritmi parsing
- [ ] Computer vision per fallback visuale

## 🤝 Contribuire

1. Fork del progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📄 Licenza

Distributed under the MIT License. See `LICENSE` for more information.

## 👨‍💻 Autore

Creato con ❤️ per automazioni web intelligenti e robuste.

---

**🎯 Ready to automate? Run `npm run dev` and start booking!**
