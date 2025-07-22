import React from 'react'
import { Loader2, Bot } from 'lucide-react'

const LoadingOverlay = ({ message = 'Caricamento in corso...' }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-mx-auto mx-4 shadow-2xl">
        <div className="text-center">
          {/* Icon Animation */}
          <div className="relative mb-6">
            <Bot className="h-16 w-16 text-booking-blue mx-auto" />
            <div className="absolute -top-2 -right-2">
              <Loader2 className="h-6 w-6 animate-spin text-booking-orange" />
            </div>
          </div>
          
          {/* Message */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Automazione in corso
          </h3>
          <p className="text-gray-600 mb-4">
            {message}
          </p>
          
          {/* Progress Dots */}
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-booking-blue rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
          
          {/* Additional Info */}
          <div className="mt-4 text-xs text-gray-500">
            <p>🤖 GPT-4 sta analizzando la pagina HTML</p>
            <p>🎯 Playwright sta eseguendo le azioni</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoadingOverlay
