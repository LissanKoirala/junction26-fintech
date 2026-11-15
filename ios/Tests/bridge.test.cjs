const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://vara-junction26.swedencentral.cloudapp.azure.com';
const source = fs.readFileSync(path.join(__dirname, '../Vara/Resources/NativeBridge.js'), 'utf8')
  .replace('__VARA_ORIGIN_JSON__', JSON.stringify(origin));
function page({ foreign = false, iframe = false } = {}) {
  const messages = [];
  const window = { webkit: { messageHandlers: { varaNative: { postMessage: m => messages.push(m) } } } };
  window.top = iframe ? {} : window;
  const context = { window, location: { origin: foreign ? 'https://untrusted.example' : origin }, navigator: {}, DOMException };
  vm.runInNewContext(source, context);
  return { ...context, messages };
}
test('no bridge is installed on foreign pages or in frames', () => {
  for (const options of [{foreign:true}, {iframe:true}]) {
    const p = page(options);
    assert.equal(p.window.SpeechRecognition, undefined);
    assert.equal(p.navigator.vibrate, undefined);
  }
});
test('interim text does not send; final result arrives before one end callback', () => {
  const p = page();
  const recognition = new p.window.SpeechRecognition();
  const events = [];
  recognition.lang = 'fi-FI';
  recognition.onresult = e => events.push([e.results[0][0].transcript, e.results[0].isFinal]);
  recognition.onend = () => events.push('end');
  recognition.start();
  assert.equal(p.messages[0].lang, 'fi-FI');
  const id = p.messages[0].id;
  p.window.__varaNativeSpeech({id, type:'result', text:'Paljonko', final:false});
  recognition.stop();
  assert.equal(p.messages[1].action, 'speechStop');
  p.window.__varaNativeSpeech({id, type:'result', text:'Paljonko voin käyttää?', final:true});
  p.window.__varaNativeSpeech({id, type:'end'});
  p.window.__varaNativeSpeech({id, type:'end'});
  assert.deepEqual(events, [['Paljonko',false],['Paljonko voin käyttää?',true],'end']);
});
test('aborting on unmount drops late transcript and does not end the next session', () => {
  const p = page();
  const first = new p.window.SpeechRecognition();
  first.start();
  const id = p.messages[0].id;
  first.abort();
  const second = new p.window.SpeechRecognition();
  let ended = false;
  second.onend = () => ended = true;
  second.start();
  p.window.__varaNativeSpeech({id, type:'result', text:'stale', final:true});
  p.window.__varaNativeSpeech({id, type:'end'});
  assert.equal(ended, false);
  assert.throws(() => first.start(), {name:'InvalidStateError'});
});
test('permission denial reaches the hook and permits a fresh attempt', () => {
  const p = page();
  const rec = new p.window.SpeechRecognition();
  let error;
  rec.onerror = e => error = e.error;
  rec.start();
  const id = p.messages[0].id;
  p.window.__varaNativeSpeech({id, type:'error', error:'not-allowed'});
  p.window.__varaNativeSpeech({id, type:'end'});
  assert.equal(error, 'not-allowed');
  assert.doesNotThrow(() => rec.start());
});
test('haptics clamp duration and reject invalid patterns', () => {
  const p = page();
  assert.equal(p.navigator.vibrate([30,20,900]), true);
  assert.deepEqual(Array.from(p.messages[0].pattern), [30,20,200]);
  assert.equal(p.navigator.vibrate([-1]), false);
  assert.equal(p.navigator.vibrate([Infinity]), false);
  assert.equal(p.messages.length, 1);
});
