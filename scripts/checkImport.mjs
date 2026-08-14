import('../api/voice.js')
  .then(() => console.log('imported'))
  .catch((e) => { console.error(e); process.exit(1); });
