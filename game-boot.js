let loaderUrl = buildUrl + "/cut_the_rope_prod.loader.js";
let config = {
  dataUrl: buildUrl + "/67c4a7b91934965f555db3203495eea3.data.unityweb",
  frameworkUrl: buildUrl + "/b26e87582db5d4f179d3b1bc4e625e59.js.unityweb",
  codeUrl: buildUrl + "/ac794d36f9bd90490562050c8d0211b1.wasm.unityweb",
  streamingAssetsUrl: "StreamingAssets",
  companyName: "ZeptoLab",
  productName: "Cut The Rope",
  productVersion: "1.0",
};

const debugSize = !!(new URLSearchParams(window.location.search)?.get('debug_size'));
let loadingEntriesBefore = [];

if (debugSize) {
  loadingEntriesBefore = performance.getEntriesByType('resource');
}

let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) {
  // Define a maximum pixel ratio for mobile to avoid rendering at too high resolutions
  let maxPixelRatioMobile = 2.0;
  config.devicePixelRatio = Math.min(window.devicePixelRatio, maxPixelRatioMobile);
}

let canvas = document.querySelector("#unity-canvas");
let loadingContainer = document.querySelector("#unity-loading-container");
let loadingBar = document.querySelector("#unity-loading-bar-inner");

let unityInstance, unityCbHandlerGo;
window.registerUnityCallbackListener = (handlerGo) => {
  unityCbHandlerGo = handlerGo;
}

window.callRewardedAdCallback = (callbackId, isRewardGranted) => {
  unityInstance.SendMessage(unityCbHandlerGo, 'OnRewardedAdCallback', JSON.stringify({ callbackId, isRewardGranted }));
}

window.callUnityCallback = (callbackId) => {
  // console.log("Calling Unity callback", unityCbHandlerGo, callbackId);

  unityInstance.SendMessage(unityCbHandlerGo, 'OnCallback', callbackId);
}

window.callHasRewardedAdCallback = (adId, result) => {
  let data = { adId, result };
  unityInstance.SendMessage(unityCbHandlerGo, 'OnHasRewardedAdCallback', JSON.stringify(data));
}

window.callHasInterstitialAdCallback = (adId, result) => {
  let data = { adId, result };
  unityInstance.SendMessage(unityCbHandlerGo, 'OnHasInterstitialAdCallback', JSON.stringify(data));
}

function onResize() {
  const pixelRatio = config.devicePixelRatio || window.devicePixelRatio;

  let { left, right, top, bottom } = window.GameInterface.getOffsets();
  left = left || 0;
  right = right || 0;
  top = top || 0;
  bottom = bottom || 0;

  const width = window.innerWidth - (left + right);
  const height = window.innerHeight - (top + bottom);

  canvas.style.position = "absolute";
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
}

function applyFeatures() {
  const audio = window.GameInterface.hasFeature("audio");
  const score = window.GameInterface.hasFeature("score");
  const progress = window.GameInterface.hasFeature("progress");
  const credits = window.GameInterface.hasFeature("credits");
  const version = window.GameInterface.hasFeature("version");
  const privacy = window.GameInterface.hasFeature("privacy");
  const copyright = window.GameInterface.hasFeature("copyright");
  const tutorial = window.GameInterface.hasFeature("tutorial");
  const visibilitychange = window.GameInterface.hasFeature("visibilitychange");
  const rewarded = window.GameInterface.hasFeature("rewarded");
  const pause = window.GameInterface.hasFeature("pause");

  const data = {
    audio,
    score,
    progress,
    credits,
    version,
    privacy,
    copyright,
    tutorial,
    visibilitychange,
    rewarded,
    pause
  };

  unityInstance.SendMessage(unityCbHandlerGo, 'SetFeatures', JSON.stringify(data));
}

window.onGameReady = () => {
  if (debugSize) {
    const loadingEntriesAfter = performance.getEntriesByType('resource');
    const transferred = getTransferredSizeBetween(loadingEntriesBefore, loadingEntriesAfter);
    const transferredKb = (transferred / 1024).toFixed(2);
    const transferredMb = (transferred / (1024 * 1024)).toFixed(2);
    console.log(`Initial loading size: ${transferredKb} KB / (${transferredMb} MB)`);
  }

  window.GameInterface.gameReady();
}

function getTransferredSizeBetween(aList, bList) {
  const aNames = new Set(aList.map(r => r.name));

  const newResources = bList.filter(r => !aNames.has(r.name));

  const totalBytes = newResources.reduce((sum, r) => sum + r.transferSize, 0);
  return totalBytes;
}

function checkAudioContext() {
  if (unityAudioContext && (unityAudioContext.state === 'interrupted' || unityAudioContext.state === 'suspended')) {
    unityAudioContext.resume();
  }
}

let unityAudioContext = null;
function patchAudioContext() {
  const _AudioContext = window.AudioContext;
  const _webkitAudioContext = window.webkitAudioContext;

  window.AudioContext = function () {
    const ctx = new _AudioContext();
    if (!unityAudioContext) {
      unityAudioContext = ctx;
    }
    return ctx;
  };

  if (_webkitAudioContext) {
    window.webkitAudioContext = window.AudioContext;
  }
}

// Add this before calling createUnityInstance()
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    const [url, options] = args;
    // Detect weird backend calls with UUID or analytics
    if (url.includes('bd4e7de7') || url.includes('analytics') || url.includes('leaderboard')) {
      console.log('[Bypass] Blocked analytics call:', url);
      // Return fake JSON so Unity doesn't crash
      return new Response(JSON.stringify({ result: "ok" }), { status: 200 });
    }
    return await originalFetch(...args);
  } catch (e) {
    console.warn('Fetch bypass triggered:', e);
    return new Response(JSON.stringify({ result: "ok" }), { status: 200 });
  }
};

window.callRewardedAdCallback = (callbackId, isRewardGranted) => {
  if (!unityInstance || !unityCbHandlerGo) return;
  const data = JSON.stringify({ callbackId: callbackId, isRewardGranted: !!isRewardGranted });
  unityInstance.SendMessage(unityCbHandlerGo, 'OnRewardedAdCallback', data);
};

window.callHasRewardedAdCallback = (adId, result) => {
  if (!unityInstance || !unityCbHandlerGo) return;
  const data = JSON.stringify({ adId: adId, result: !!result });
  unityInstance.SendMessage(unityCbHandlerGo, 'OnHasRewardedAdCallback', data);
};

window.callHasInterstitialAdCallback = (adId, result) => {
  if (!unityInstance || !unityCbHandlerGo) return;
  const data = JSON.stringify({ adId: adId, result: !!result });
  unityInstance.SendMessage(unityCbHandlerGo, 'OnHasInterstitialAdCallback', data);
};

async function initGame() {
  try {
    unityInstance = await createUnityInstance(canvas, config, (progress) => {
      progress = Math.ceil(progress * 100);
      loadingBar.style.width = progress + "%"
      window.GameInterface.sendPreloadProgress(progress);
    });
  } catch (error) {
    console.error('Error loading game:', error);
    loadingContainer.innerHTML = '<div style="color: #333; font-family: Arial; padding: 20px;">Error loading game. Please make sure your browser supports WebGL.</div>';
    throw error;
  }

  loadingContainer.classList.add("finished");
  window.GameInterface.onGoToLevel((level) => {
    unityInstance.SendMessage(unityCbHandlerGo, 'OnGoToLevel', level);
  });

  window.GameInterface.onPauseStateChange((pause) => {
    unityInstance.SendMessage(unityCbHandlerGo, 'OnPauseStateChange', (pause ? 1 : 0));
  });

  window.GameInterface.onMuteStateChange((mute) => {
    unityInstance.SendMessage(unityCbHandlerGo, 'OnMuteStateChange', (mute ? 1 : 0));
  });

  unityInstance.SendMessage(unityCbHandlerGo, 'OnMuteStateChange', (window.GameInterface.isMuted() ? 1 : 0));
  setTimeout(() => unityInstance.SendMessage(unityCbHandlerGo, 'OnMuteStateChange', (window.GameInterface.isMuted() ? 1 : 0)), 100);

  applyFeatures();
  let saveData = window.GameInterface.storage.getItem("saveData");
  // console.log("get Save data", saveData);
  unityInstance.SendMessage(unityCbHandlerGo, 'DeserializeSaveData', saveData ? saveData : "");

  let logoSize = 'xlarge'; //512x512
  let logoURL = window.GameInterface.getCopyrightLogoURL(logoSize);
  unityInstance.SendMessage(unityCbHandlerGo, 'SetCopyrightLogoURL', logoURL);

  let curLanguage = window.GameInterface.getCurrentLanguage();
  unityInstance.SendMessage(unityCbHandlerGo, 'SetLanguage', curLanguage);

  onResize();
  window.GameInterface.onOffsetChange(onResize);
  window.addEventListener("resize", onResize);
}

patchAudioContext();
document.addEventListener("visibilitychange", () => {
  const isVisible = document.visibilityState === 'visible';
  unityInstance.SendMessage(unityCbHandlerGo, 'OnVisibilityChanged', isVisible ? 1 : 0);

  if (isVisible) {
    checkAudioContext();
    setTimeout(() => checkAudioContext(), 100);
    setTimeout(() => checkAudioContext(), 500);
  }
});

if (document.readyState === 'complete') {
  initGame();
}
else {
  window.addEventListener('load', async function () {
    initGame();
  });
}