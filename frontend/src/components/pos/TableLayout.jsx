import React from 'react';

function TableLayout({ 
  showTableModal, 
  setShowTableModal, 
  activeFloor, 
  setActiveFloor, 
  tables, 
  handleSelectTable 
}) {
  if (!showTableModal) return null;

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 flex flex-col h-[500px]">
        <div className="flex justify-between items-center mb-4 border-b pb-3 shrink-0">
          <div>
            <h3 className="font-extrabold text-lg text-[#714B67]">Select Table Floor Plan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Click a table to begin or retrieve orders.</p>
          </div>
          <button className="text-gray-400 hover:text-gray-800 font-bold" onClick={() => setShowTableModal(false)}>Close</button>
        </div>

        <div className="flex bg-[#f3f4f5] p-1 rounded-xl gap-1 mb-4 shrink-0 border border-gray-100">
          {['Ground Floor', 'First Floor', 'Terrace'].map(floorName => (
            <button
              key={floorName}
              onClick={() => setActiveFloor(floorName)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                activeFloor === floorName ? 'bg-[#714B67] text-white shadow' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {floorName}
            </button>
          ))}
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {tables
              .filter(t => t.floor === activeFloor)
              .map(table => {
                const isOccupied = table.status === 'Active' || table.active_order_id;
                return (
                  <div
                    key={table.id}
                    onClick={() => handleSelectTable(table)}
                    className={`p-4 rounded-2xl border-2 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-1 select-none active:scale-[0.97] ${
                      isOccupied 
                        ? 'bg-purple-50 border-[#714B67] text-[#714B67] shadow-sm shadow-purple-900/5' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/20'
                    }`}
                  >
                    <span className="text-lg font-black">{table.table_number}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{table.seats} Seats</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mt-1 ${
                      isOccupied ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TableLayout;
