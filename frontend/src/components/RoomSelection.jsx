import React, { useState } from 'react'

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
                    
                    {/* Prezzo */}
                    <div className="mb-3">
                      <span className="text-3xl font-bold text-blue-600">
                        €{room.price}
                      </span>
                      <span className="text-gray-500 ml-2">per notte</span>
                    </div>
                    
                    {/* Informazioni Camera */}
                    {(room.roomSize || room.guestCapacity) && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                          {room.roomSize && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">{room.roomSize}</span>
                            </div>
                          )}
                          {room.guestCapacity && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                              <div className="flex items-center gap-2">
                                {/* Parser intelligente per adult/crib */}
                                {(() => {
                                  const text = room.guestCapacity;
                                  
                                  // Estrai "Max ospiti:"
                                  const prefixMatch = text.match(/^[^:]*:/);
                                  const prefix = prefixMatch ? prefixMatch[0] + ' ' : '';
                                  
                                  let totalAdults = 0;
                                  let totalCribs = 0;
                                  
                                  // Pattern per adult/adult[numero]
                                  const adultMatches = text.match(/adult(\d*)/g) || [];
                                  adultMatches.forEach(match => {
                                    const numberMatch = match.match(/adult(\d+)/);
                                    if (numberMatch) {
                                      totalAdults += parseInt(numberMatch[1]);
                                    } else {
                                      totalAdults += 1; // solo "adult" = 1 adulto
                                    }
                                  });
                                  
                                  // Pattern per crib/crib[numero]
                                  const cribMatches = text.match(/crib(\d*)/g) || [];
                                  cribMatches.forEach(match => {
                                    const numberMatch = match.match(/crib(\d+)/);
                                    if (numberMatch) {
                                      totalCribs += parseInt(numberMatch[1]);
                                    } else {
                                      totalCribs += 1; // solo "crib" = 1 culla
                                    }
                                  });
                                  
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{prefix}</span>
                                      
                                      {/* Adulti: numero + icona */}
                                      {totalAdults > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium text-blue-600">{totalAdults}</span>
                                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      )}
                                      
                                      {/* Culle: numero + icona */}
                                      {totalCribs > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium text-pink-500">{totalCribs}</span>
                                          <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M6 18h12v-2c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v2zm14-8h-2V8c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v6h2v-2h16v2h2v-6c0-1.1-.9-2-2-2z"/>
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Descrizione */}
                    {room.description && (
                      <p className="text-gray-700 mb-4 leading-relaxed">
                        {room.description}
                      </p>
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
                    {room.limitedAvailability && (
                      <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-orange-800 text-sm font-medium">
                            {room.limitedAvailability}
                          </span>
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
