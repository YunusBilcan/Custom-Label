import React from 'react';
import ProductApp from './components/ProductApp';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto py-8">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
              XML Custom Label Generator
            </h1>
            <p className="text-gray-500">
              Fetch Google Shopping feed, filter products, and output a custom labeled XML mapping.
            </p>
          </div>

          <ProductApp />
          
        </div>
      </div>
    </div>
  );
}

export default App;
