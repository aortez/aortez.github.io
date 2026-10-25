#!/usr/bin/env node
// Requires Node 22+, adb, and an already installed frame app on the selected phone.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {socket.close(); reject(new Error('CDP connection timed out'));}, 10000);
      socket.addEventListener('open', () => {clearTimeout(timeout); resolve();}, {once: true});
      socket.addEventListener('error', () => {clearTimeout(timeout); reject(new Error('Could not connect to the Android target'));}, {once: true});
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(new Error(`CDP timed out: ${method}`));}, 15000);
      this.pending.set(id, {resolve, reject, timer});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }

  close() {
    for (const {timer, reject} of this.pending.values()) {clearTimeout(timer); reject(new Error('CDP connection closed'));}
    this.pending.clear();
    this.socket.close();
  }
}

const snapshot = `({
  url: location.href,
  title: document.title,
  standalone: matchMedia('(display-mode: standalone)').matches,
  ready: !!document.querySelector('#connect'),
  viewportWidth: innerWidth,
  contentWidth: document.documentElement.scrollWidth,
  draft: document.querySelector('#draft-name')?.textContent,
  preview: [document.querySelector('#preview')?.naturalWidth || 0, document.querySelector('#preview')?.naturalHeight || 0],
  sendDisabled: document.querySelector('#send')?.disabled,
  fitDisabled: document.querySelector('#fit')?.disabled,
  connection: document.querySelector('#frame-detail')?.textContent,
  serviceWorker: navigator.serviceWorker?.controller?.scriptURL
})`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const {values} = parseArgs({options: {
    origin: {type: 'string', default: 'https://allan.pizza'},
    serial: {type: 'string'},
    package: {type: 'string'},
    offline: {type: 'boolean', default: false},
    screenshot: {type: 'string'},
    help: {type: 'boolean', short: 'h'},
  }});
  if (values.help) {
    console.log('Usage: node tools/android-frame-check.mjs [--serial ID] [--origin URL] [--package WEBAPK_ID] [--offline] [--screenshot FILE]\nAn optional package force-stops/relaunches that installed WebAPK. Offline mode temporarily disables WiFi/mobile data and a matching localhost ADB reverse, then restores their prior states. Use --package for an offline cold launch.');
    return;
  }
  const url = new URL(values.origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an HTTP(S) origin without credentials or a path');
  const origin = url.origin;
  let serial = values.serial;
  if (!serial) {
    const devices = execFileSync('adb', ['devices'], {encoding: 'utf8'}).split('\n').filter(line => /\tdevice$/.test(line)).map(line => line.split('\t')[0]);
    if (devices.length !== 1) throw new Error('Select one authorized Android device with --serial');
    [serial] = devices;
  }
  const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], {encoding: 'utf8'});
  adb('forward', 'tcp:9222', 'localabstract:chrome_devtools_remote');
  const wake = () => adb('shell', 'input', 'keyevent', '224');
  wake();
  const awake = setInterval(() => {try {wake();} catch { /* Report a disconnected phone through the main check. */ }}, 5000);
  let client;
  const restore = [];
  let component;
  try {
    if (values.package) {
      if (!/^org\.chromium\.webapk\.[a-zA-Z0-9_]+$/.test(values.package)) throw new Error('Use the installed org.chromium.webapk.* package ID');
      component = adb('shell', 'cmd', 'package', 'resolve-activity', '--brief', values.package).trim().split('\n').at(-1);
      if (!component.startsWith(`${values.package}/`) || !/^[a-zA-Z0-9_./]+$/.test(component)) throw new Error('Could not resolve the WebAPK launcher');
      adb('shell', 'am', 'force-stop', values.package);
      adb('shell', 'am', 'start', '-n', component);
    }
    const findInstalledApp = async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        let targets;
        try {targets = await (await fetch('http://127.0.0.1:9222/json/list', {signal: AbortSignal.timeout(5000)})).json();}
        catch {await pause(500); continue;} // Chrome's debugging socket starts after the Android activity.
        for (const target of targets.filter(target => target.type === 'page' && target.url.startsWith(`${origin}/frame/`))) {
          const candidate = await Cdp.connect(target.webSocketDebuggerUrl);
          const state = await candidate.evaluate(snapshot);
          if (state.standalone && state.ready) return candidate;
          candidate.close();
        }
        await pause(500);
      }
      throw new Error('No ready installed frame app found; launch it or pass --package');
    };
    client = await findInstalledApp();
    await client.evaluate('navigator.serviceWorker.ready.then(() => true)');
    let initial;
    // A saved photo is reprocessed locally after a cold launch.
    for (let attempt = 0; attempt < 60; attempt++) {
      initial = await client.evaluate(snapshot);
      if (initial.preview[0] || (!values.offline && initial.draft === 'Your next favorite view')) break;
      await pause(500);
    }
    if (initial.contentWidth > initial.viewportWidth) throw new Error('App overflows the phone viewport');
    const result = {origin, coldLaunch: Boolean(values.package), initial};
    if (values.offline) {
      if (!initial.preview[0]) throw new Error('Choose a photo and wait for its preview before checking offline draft recovery');
      await client.evaluate('window.__frameCheckDocument = true');
      const wifiEnabled = /^Wifi is enabled/m.test(adb('shell', 'cmd', 'wifi', 'status'));
      const mobileData = adb('shell', 'settings', 'get', 'global', 'mobile_data').trim();
      if (!['0', '1'].includes(mobileData)) throw new Error('Could not determine the previous mobile-data state');
      const reverse = ['localhost', '127.0.0.1'].includes(url.hostname)
        ? adb('reverse', '--list').split('\n').map(line => line.trim().split(/\s+/)).find(parts => parts[1] === `tcp:${url.port || 80}`) : null;
      // Record restoration before each change, so a partially successful adb call is recovered too.
      if (reverse) {restore.push(() => adb('reverse', reverse[1], reverse[2])); adb('reverse', '--remove', reverse[1]);}
      if (wifiEnabled) {restore.push(() => adb('shell', 'svc', 'wifi', 'enable')); adb('shell', 'svc', 'wifi', 'disable');}
      if (mobileData === '1') {restore.push(() => adb('shell', 'svc', 'data', 'enable')); adb('shell', 'svc', 'data', 'disable');}
      await pause(1000);
      if (component) {
        client.close(); client = null;
        adb('shell', 'am', 'force-stop', values.package);
        adb('shell', 'am', 'start', '-n', component);
        client = await findInstalledApp();
      } else {
        await client.send('Page.reload');
      }
      let recovered;
      let newDocument = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        recovered = await client.evaluate(snapshot);
        newDocument = await client.evaluate('!window.__frameCheckDocument');
        if (newDocument && recovered.ready && recovered.draft === initial.draft && recovered.sendDisabled && !recovered.fitDisabled && (!initial.preview[0] || recovered.preview[0])) break;
        await pause(500);
      }
      if (!newDocument || !recovered.ready || recovered.draft !== initial.draft || !recovered.sendDisabled || recovered.fitDisabled || (initial.preview[0] && recovered.preview.join() !== initial.preview.join())) throw new Error('Offline draft recovery failed');
      result.offlineReload = recovered;
      result.offlineMethod = {wifiDisabled: wifiEnabled, mobileDataDisabled: true, localhostForwardRemoved: Boolean(reverse), coldLaunch: Boolean(component)};
    }
    if (values.screenshot) {
      const screenshot = await client.send('Page.captureScreenshot', {format: 'png'});
      writeFileSync(values.screenshot, Buffer.from(screenshot.data, 'base64'));
      result.screenshot = values.screenshot;
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try {
      const failures = [];
      for (const undo of restore) {try {undo();} catch (error) {failures.push(error);}}
      if (failures.length) throw new Error('Could not restore phone networking; check WiFi/mobile data and adb reverse');
      if (restore.length && client) await client.send('Page.reload');
    } finally {client?.close(); clearInterval(awake);}
  }
}

main().catch(error => {console.error(error.message); process.exitCode = 1;});
