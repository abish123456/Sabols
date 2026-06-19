const https = require('https');

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let headers = res.headers;
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers }); } catch (e) { resolve({ status: res.statusCode, data, headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('Sending OTP...');
  const otpRes = await request('https://mobile-app-liard-kappa.vercel.app/shop/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://mobile-app-liard-kappa.vercel.app', 'User-Agent': 'Mozilla/5.0' }
  }, { phone: '9488349282' });
  
  console.log('Verifying OTP 1234...');
  const verRes = await request('https://mobile-app-liard-kappa.vercel.app/shop/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://mobile-app-liard-kappa.vercel.app', 'User-Agent': 'Mozilla/5.0' }
  }, { reqId: otpRes.data.reqId, otp: '1234' });
  
  const token = verRes.data.token;
  if (!token) return console.log('No token', verRes.data);
  
  console.log('Fetching profile...');
  const profRes = await request('https://mobile-app-liard-kappa.vercel.app/shop/api/user/profile', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Cookie': 'token=' + token, 'Origin': 'https://mobile-app-liard-kappa.vercel.app', 'User-Agent': 'Mozilla/5.0' }
  });
  console.log('Profile:', profRes.data.success);
  
  console.log('Creating order...');
  const orderRes = await request('https://mobile-app-liard-kappa.vercel.app/shop/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Cookie': 'token=' + token, 'Origin': 'https://mobile-app-liard-kappa.vercel.app', 'User-Agent': 'Mozilla/5.0' }
  }, { quantity: 1, deliverySlot: '2026-06-10', paymentType: 'ONLINE', paymentMethodId: 'ONLINE', addressId: profRes.data.user.addresses[0].id, addressLine1: 'A', city: 'B', pincode: '641001' });
  
  console.log('Order:', orderRes.data);
  if (!orderRes.data.order) return;
  
  console.log('Creating payment (null)...');
  const payRes1 = await request('https://mobile-app-liard-kappa.vercel.app/shop/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Cookie': 'token=' + token, 'Origin': 'https://mobile-app-liard-kappa.vercel.app', 'User-Agent': 'Mozilla/5.0' }
  }, { orderId: orderRes.data.order.id, amount: Math.round(orderRes.data.order.amount * 100), paymentMethodId: null });
  console.log('Payment 1:', payRes1.data);
  
  console.log('Creating payment (undefined)...');
  const payRes2 = await request('https://mobile-app-liard-kappa.vercel.app/shop/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Cookie': 'token=' + token, 'Origin': 'https://mobile-app-liard-kappa.vercel.app', 'User-Agent': 'Mozilla/5.0' }
  }, { orderId: orderRes.data.order.id, amount: Math.round(orderRes.data.order.amount * 100) });
  console.log('Payment 2:', payRes2.data);
}
test();
