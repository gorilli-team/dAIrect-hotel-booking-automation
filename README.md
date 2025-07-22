# 🏨 Hotel Booking Automation System

Un sistema completo per l'automazione delle prenotazioni hotel utilizzando **React**, **Node.js**, **Playwright** e **GPT-4**.

## 🎯 Obiettivo

Automatizzare completamente il processo di prenotazione dell'hotel **Palazzo Vitturi** a Venezia su **SimpleBooking** tramite:
- Frontend React stile Booking.com
- Backend Node.js con automazione browser
- GPT-4 per l'analisi intelligente delle pagine HTML
- Playwright per l'interazione automatica con SimpleBooking

## 🚀 Tecnologie Utilizzate

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Node.js + Express |
| **Automazione** | Playwright |
| **AI** | GPT-4 (OpenAI API) |
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
    │   ├── aiSelector.js            # GPT-4 integrazione
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
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o

# Server Configuration  
PORT=3001
NODE_ENV=development

# Browser Configuration
HEADLESS=false                    # true per headless, false per vedere il browser
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
- Attendi che GPT-4 analizzi la pagina
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

## 🤖 Come Funziona l'AI

### Flusso di Automazione

1. **Analisi Pagina Search**
   ```javascript
   // GPT-4 riceve HTML e identifica selettori
   const aiResponse = await aiService.analyzeSearchPage(htmlContent, searchParams)
   // Ritorna: { selectors: { checkinDate: "#checkin", ... } }
   ```

2. **Estrazione Camere**
   ```javascript
   // GPT-4 analizza risultati e estrae dati camere
   const rooms = await aiService.analyzeRoomsPage(htmlContent)
   // Ritorna: { rooms: [{ id, name, price, features }] }
   ```

3. **Selezione Camera**
   ```javascript
   // GPT-4 trova come cliccare sulla camera specifica
   const instructions = await aiService.analyzeRoomSelection(html, roomId)
   ```

4. **Form di Prenotazione**  
   ```javascript
   // GPT-4 identifica tutti i campi del form
   const formData = await aiService.analyzeBookingForm(html, personalData)
   ```

5. **Risultato Finale**
   ```javascript
   // GPT-4 determina se prenotazione è riuscita
   const result = await aiService.analyzeBookingResult(finalHtml)
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
- Browser: visibile (HEADLESS=false)

## 🔒 Sicurezza e Limitazioni

### ⚠️ Importante
- **Nessun pagamento reale**: usa sempre dati di test
- **Rate limiting**: evita troppe richieste consecutive
- **GPT-4 costs**: ogni analisi HTML consuma token
- **Resilienza**: il sistema può fallire se il sito cambia struttura

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

## 🚀 Miglioramenti Suggeriti

### Resilienza
- [ ] Retry automatico con backoff
- [ ] Fallback selettori multipli
- [ ] Cache delle analisi GPT
- [ ] Monitoring uptime sito target

### Funzionalità
- [ ] Multi-hotel support
- [ ] Database persistente (Redis/PostgreSQL)  
- [ ] Dashboard admin
- [ ] Webhook notifications
- [ ] PDF report generation

### AI Enhancement
- [ ] Fine-tuning GPT per selettori più accurati
- [ ] Vision API per screenshot analysis
- [ ] Automatic selector learning
- [ ] A/B testing diversi prompt

## 🤝 Contribuire

1. Fork del progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📄 Licenza

Distributed under the MIT License. See `LICENSE` for more information.

## 👨‍💻 Autore

Creato con ❤️ per automazioni intelligenti.

---

**🎯 Ready to automate? Run `npm run dev` and start booking!**
