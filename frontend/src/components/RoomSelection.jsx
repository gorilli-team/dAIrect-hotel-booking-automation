import React from 'react'

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
        <div className="space-y-4">
          {rooms.map((room) => (
            <div key={room.id} className="border p-4 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900">
                {room.name} - {room.price} {room.currency}
              </h3>
              <p className="text-sm text-gray-600">
                {room.features.join(', ')}
              </p>
              <button
                onClick={() => onSelectRoom(room.id)}
                disabled={loading}
                className="btn-primary mt-4"
              >
                Seleziona questa Camera
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RoomSelection;
