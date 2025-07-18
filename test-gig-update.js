// Test script to debug gig update issue
const updateGig = async () => {
  try {
    console.log('🔄 Testing gig update...');
    
    // First verify we're authenticated
    const userResponse = await fetch('http://localhost:5000/api/user', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      console.error('❌ Not authenticated');
      return;
    }
    
    const user = await userResponse.json();
    console.log('✅ Authenticated as:', user.email, 'User ID:', user.id);
    
    // Now try to update gig 88
    const updateResponse = await fetch('http://localhost:5000/api/gigs/88', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventName: 'Vegas tradeshow UPDATED TEST',
        expectedPay: '750.00'
      })
    });
    
    const result = await updateResponse.json();
    
    if (updateResponse.ok) {
      console.log('✅ Update successful:', result);
    } else {
      console.error('❌ Update failed:', updateResponse.status, result);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

updateGig();