import React, { useState, useEffect, useRef } from 'react'

// Componente per visualizzare il blocco prezzo completo con styling personalizzato
const PriceBlockDisplay = ({ priceBlockHtml }) => {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current
      
      // Stili per il container principale dei prezzi
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
      
      // Stili per l'importo principale (.mainAmount)
      const mainAmounts = container.querySelectorAll('.mainAmount, .eiup2eu1')
      mainAmounts.forEach(amount => {
        amount.style.fontSize = '2rem'
        amount.style.fontWeight = '700'
        amount.style.color = '#1f2937'
        amount.style.lineHeight = '1.2'
      })
      
      // Stili per prezzi barrati (prezzi originali)
      const strikethroughPrices = container.querySelectorAll('[style*="text-decoration: line-through"]')
      strikethroughPrices.forEach(price => {
        price.style.fontSize = '1.1rem'
        price.style.color = '#6b7280'
        price.style.fontWeight = '500'
      })
      
      // Stili per il badge di sconto/percentuale
      const discountBadges = container.querySelectorAll('.discount, [class*="discount"], [style*="background"]')
      discountBadges.forEach(badge => {
        const text = badge.textContent?.trim()
        if (text && text.includes('%')) {
          badge.style.backgroundColor = '#dc2626'
          badge.style.color = 'white'
          badge.style.padding = '0.25rem 0.5rem'
          badge.style.borderRadius = '0.375rem'
          badge.style.fontSize = '0.875rem'
          badge.style.fontWeight = '600'
          badge.style.display = 'inline-block'
        }
      })
      
      // Stili per "Tasse incluse" e note simili
      const taxNotes = container.querySelectorAll('span, div')
      taxNotes.forEach(note => {
        const text = note.textContent?.trim().toLowerCase()
        if (text && (text.includes('tasse') || text.includes('inclus') || text.includes('notte') || text.includes('notti'))) {
          note.style.fontSize = '0.875rem'
          note.style.color = '#6b7280'
          note.style.fontWeight = '500'
        }
      })
      
      // Layout generale del container
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '0.5rem'
      container.style.alignItems = 'flex-start'
    }
  }, [priceBlockHtml])
  
  return (
    <div 
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: priceBlockHtml }}
    />
  )
}

// Componente per visualizzare le informazioni della camera con styling personalizzato
const RoomInfoDisplay = ({ roomInfoHtml }) => {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (containerRef.current) {
      // Applica gli stili personalizzati dopo che il componente è montato
      const container = containerRef.current
      
      // Stile principale del container
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.gap = '1.5rem'
      container.style.flexWrap = 'wrap'
      
      // Stili per .RoomFeature (dimensioni camera)
      const roomFeatures = container.querySelectorAll('.RoomFeature')
      roomFeatures.forEach(feature => {
        feature.style.display = 'flex'
        feature.style.alignItems = 'center'
        feature.style.gap = '0.5rem'
        feature.style.background = 'white'
        feature.style.padding = '0.5rem 0.75rem'
        feature.style.borderRadius = '0.75rem'
        feature.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
        feature.style.border = '1px solid #e5e7eb'
      })
      
      // Stili per le icone SVG
      const svgs = container.querySelectorAll('svg')
      svgs.forEach(svg => {
        svg.style.width = '18px'
        svg.style.height = '18px'
        svg.style.flexShrink = '0'
        
        if (svg.getAttribute('title') === 'ruler') {
          svg.style.color = '#3b82f6' // blue-500
        } else if (svg.getAttribute('title') === 'adult') {
          svg.style.color = '#059669' // emerald-600
        } else if (svg.getAttribute('title') === 'crib') {
          svg.style.color = '#dc2626' // red-600
        }
      })
      
      // Stili per il testo delle dimensioni e ospiti
      const textElements = container.querySelectorAll('.ltr-zswzrr')
      textElements.forEach(text => {
        text.style.fontWeight = '600'
        text.style.color = '#374151'
        text.style.fontSize = '14px'
      })
      
      // Stili per il gruppo ospiti [role="group"]
      const guestGroups = container.querySelectorAll('[role="group"]')
      guestGroups.forEach(group => {
        group.style.display = 'flex'
        group.style.alignItems = 'center'
        group.style.gap = '0.75rem'
        group.style.background = 'white'
        group.style.padding = '0.5rem 0.75rem'
        group.style.borderRadius = '0.75rem'
        group.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
        group.style.border = '1px solid #e5e7eb'
        
        // Stili per i paragrafi all'interno del gruppo
        const paragraphs = group.querySelectorAll('p')
        paragraphs.forEach(p => {
          p.style.margin = '0'
          p.style.fontWeight = '600'
          p.style.color = '#374151'
          p.style.fontSize = '14px'
          p.style.whiteSpace = 'nowrap'
        })
        
        // Stili per i contenitori delle icone ospiti
        const guestIconContainers = group.querySelectorAll('.ltr-zswzrr')
        guestIconContainers.forEach(container => {
          container.style.display = 'flex'
          container.style.alignItems = 'center'
          container.style.gap = '0.25rem'
        })
      })
      
      // Nascondi elementi di spacing inutili
      const hideElements = container.querySelectorAll('.ltr-jea9ee, .tether-target, span[style*="flex-shrink"]')
      hideElements.forEach(el => {
        el.style.display = 'none'
      })
    }
  }, [roomInfoHtml])
  
  return (
    <div 
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: roomInfoHtml }}
    />
  )
}

// Componente Carousel per le immagini delle camere
const ImageCarousel = ({ images, roomName }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">Nessuna immagine disponibile</span>
      </div>
    )
  }
  
  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }
  
  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }
  
  return (
    <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
      <img 
        src={images[currentIndex]} 
        alt={`${roomName} - Immagine ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-opacity duration-300"
        onError={(e) => {
          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltbWFnaW5lIG5vbiBkaXNwb25pYmlsZTwvdGV4dD48L3N2Zz4='
        }}
      />
      
      {images.length > 1 && (
        <>
          {/* Bottoni navigazione */}
          <button 
            onClick={prevImage}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            aria-label="Immagine precedente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            onClick={nextImage}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            aria-label="Immagine successiva"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          {/* Indicatori */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                }`}
                aria-label={`Vai all'immagine ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Contatore immagini */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}

const RoomSelection = ({ rooms, onSelectRoom, loading, onBack }) => {
  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-4">Seleziona una camera</h2>

      {rooms.length === 0 ? (
        <div className="text-center">
          <p className="text-gray-600 mb-4">Nessuna camera disponibile per le date selezionate.</p>
          <button onClick={onBack} className="btn-secondary">
            Torna Indietro
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {rooms.map((room) => (
            <div key={room.id} className="border rounded-lg shadow-lg overflow-hidden bg-white hover:shadow-xl transition-shadow duration-300">
              {/* Layout a griglia: immagini a sinistra, dettagli a destra */}
              <div className="md:flex">
                {/* Sezione Immagini */}
                <div className="md:w-1/3 p-4">
                  <ImageCarousel images={room.images} roomName={room.name} />
                </div>
                
                {/* Sezione Dettagli */}
                <div className="md:w-2/3 p-6 flex flex-col justify-between">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {room.name}
                    </h3>
                    
                    {/* Blocco Prezzo Completo */}
                    {room.priceBlock ? (
                      <div className="mb-4">
                        <PriceBlockDisplay priceBlockHtml={room.priceBlock.html} />
                      </div>
                    ) : (
                      /* Fallback al prezzo semplice se priceBlock non disponibile */
                      <div className="mb-4">
                        <div className="mb-3">
                          <span className="text-3xl font-bold text-blue-600">
                            €{room.price}
                          </span>
                          <span className="text-gray-500 ml-2">per notte</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Blocco informazioni camera con styling migliorato */}
                    {room.roomInfoBlock && (
                      <div className="mb-4">
                        <RoomInfoDisplay roomInfoHtml={room.roomInfoBlock.html} />
                      </div>
                    )}
                    
                    {/* Descrizione - subito dopo prezzo/mq/max persone */}
                    {room.description && (
                      <div className="mb-4">
                        <p className="text-gray-600 text-sm leading-relaxed italic">
                          {room.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Features/Servizi */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                        Servizi inclusi
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {room.features.map((feature, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Disponibilità limitata */}
                    {(room.availabilityInfo || room.limitedAvailability) && (
                      <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                              {room.availabilityInfo ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-orange-800 text-sm font-medium">
                                    {room.availabilityInfo.description || 'Disponibilità limitata'}
                                  </span>
                                  {room.availabilityInfo.remaining && (
                                    <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">
                                      {room.availabilityInfo.remaining} rimaste
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-orange-800 text-sm font-medium">
                                  {room.limitedAvailability}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Urgency indicator */}
                          {room.availabilityInfo && room.availabilityInfo.remaining <= 2 && (
                            <div className="flex items-center">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Pochissime rimaste!
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Bottone Selezione */}
                  <div className="text-right">
                    <button
                      onClick={() => onSelectRoom(room.id)}
                      disabled={loading}
                      className="btn-primary px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:hover:shadow-lg"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Prenotazione in corso...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Seleziona questa Camera
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RoomSelection;
