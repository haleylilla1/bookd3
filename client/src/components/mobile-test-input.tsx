import React, { useState } from 'react';

export function MobileTestInput() {
  const [value, setValue] = useState('');
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <h3>Mobile Input Test</h3>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type here to test"
        style={{
          width: '100%',
          height: '50px',
          fontSize: '16px',
          padding: '10px',
          border: '2px solid #333',
          borderRadius: '4px',
          backgroundColor: '#fff',
          color: '#000',
          outline: 'none'
        }}
      />
      <p>Current value: {value}</p>
    </div>
  );
}