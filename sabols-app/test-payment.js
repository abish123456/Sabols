const https = require('https');

async function testPayment() {
  const baseUrl = 'https://mobile-app-liard-kappa.vercel.app/shop/api';
  
  try {
    // 1. Login
    console.log('Sending OTP...');
    const sendOtpRes = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919999999998' })
    });
    const sendOtpData = await sendOtpRes.json();
    console.log(sendOtpData);

    console.log('Verifying OTP...');
    const verifyOtpRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919999999998', otp: '123456', reqId: sendOtpData.reqId })
    });
    const verifyData = await verifyOtpRes.json();
    console.log('Verify Data:', verifyData);

    const token = verifyData.token;
    if (!token) return console.log('No token');

    const headers = {
      'Origin': 'https://mobile-app-liard-kappa.vercel.app',
      'Referer': 'https://mobile-app-liard-kappa.vercel.app/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cookie': `token=${token}`
    };

    // 2. Add to cart
    console.log('Adding to cart...');
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId: 'some-id-needed', quantity: 1 })
    }); // we might fail here if we don't know a product id, let's fetch products first

    const prodRes = await fetch(`${baseUrl}/products`);
    const prodData = await prodRes.json();
    const productId = prodData.products[0].id;
    
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId, quantity: 1 })
    });

    // 3. Create order
    console.log('Creating order...');
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quantity: 1,
        deliverySlot: '2026-06-10',
        paymentType: 'ONLINE',
        paymentMethodId: 'ONLINE',
        addressLine1: 'Test',
        city: 'Test',
        area: 'Test',
        pincode: '641001'
      })
    });
    const orderData = await orderRes.json();
    console.log('Order Data:', orderData);

    if (!orderData.success) return;

    // 4. Create payment
    console.log('Creating payment...');
    const payRes = await fetch(`${baseUrl}/payments/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: orderData.order.id,
        amount: Math.round(orderData.order.amount * 100),
        paymentMethodId: null
      })
    });
    console.log('Payment Data:', await payRes.json());
  } catch (err) {
    console.error(err);
  }
}
testPayment();
