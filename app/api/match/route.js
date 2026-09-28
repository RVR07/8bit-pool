const SUPABASE_URL = 'https://fhmzewpqvblncczeklty.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobXpld3BxdmJsbmNjemVrbHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NzgxNjMsImV4cCI6MjEwNTE1NDE2M30.Ur5lTstsobtj5Q0nzxXItTpkZzvzRj5VPoRS2jHWjOc';

function clean(address) {
  return String(address || '').trim().toLowerCase();
}

function valid(address) {
  return /^0x[a-f0-9]{40}$/.test(address);
}

function cueOf(value) {
  var id = String(value || 'classic').toLowerCase();
  return /^[a-z]{3,16}$/.test(id) ? id : 'classic';
}

function callRpc(name, args) {
  return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  }).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.message || data.error || 'match failed');
      return data;
    });
  });
}

export async function POST(request) {
  const body = await request.json().catch(function () { return {}; });
  const address = clean(body.address);
  const city = String(body.city || '');
  const cue = cueOf(body.cue);
  if (!valid(address) || !city || city === 'bot') {
    return Response.json({ error: 'Connect MetaMask first' }, { status: 400 });
  }
  try {
    const result = await callRpc('billiards_join', { p_address: address, p_city: city, p_cue: cue });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || 'match failed' }, { status: 500 });
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const address = clean(url.searchParams.get('address'));
  const city = String(url.searchParams.get('city') || '');
  if (!valid(address)) return Response.json({ status: 'idle' });
  try {
    const result = await callRpc('billiards_poll', { p_address: address, p_city: city });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || 'match failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const url = new URL(request.url);
  const address = clean(url.searchParams.get('address'));
  try {
    const result = await callRpc('billiards_leave', { p_address: address });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || 'match failed' }, { status: 500 });
  }
}
