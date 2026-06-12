// Thin abstraction over game-portal SDKs (Poki, CrazyGames, YouTube
// Playables). The game only ever talks to this adapter; each portal
// build swaps in a concrete implementation.
//
// Mapping reference:
// - Poki:        PokiSDK.gameplayStart/gameplayStop, PokiSDK.commercialBreak,
//                PokiSDK.rewardedBreak
// - CrazyGames:  CrazyGames.SDK.game.gameplayStart/gameplayStop,
//                CrazyGames.SDK.ad.requestAd('midgame' | 'rewarded')
//
// All hooks are intentionally no-ops for local/Cloudflare builds.
function loadScript(url) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("PortalAdapter: Failed to load script:", url);
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

class PortalAdapter {
  constructor() {
    this.platform = 'none'; // 'poki', 'crazygames', or 'none'
    this.crazySdk = null;
  }

  async init() {
    const hostname = window.location.hostname;
    const searchParams = new URLSearchParams(window.location.search);
    const platformParam = searchParams.get('platform');

    // 1. Detect and load Poki SDK
    if (platformParam === 'poki' || hostname.includes('poki') || hostname.includes('poki-gdn')) {
      console.log("PortalAdapter: Poki environment detected. Loading SDK...");
      const loaded = await loadScript("https://game-cdn.poki.com/scripts/v2/poki-sdk.js");
      if (loaded && typeof PokiSDK !== 'undefined') {
        try {
          await PokiSDK.init();
          this.platform = 'poki';
          console.log("PortalAdapter: Poki SDK initialized.");
          return true;
        } catch (e) {
          console.warn("PortalAdapter: Poki SDK init failed:", e);
        }
      }
    }

    // 2. Detect and load CrazyGames SDK
    if (platformParam === 'crazygames' || hostname.includes('crazygames') || hostname.includes('crazy') || hostname.includes('y8')) {
      console.log("PortalAdapter: CrazyGames environment detected. Loading SDK...");
      const loaded = await loadScript("https://sdk.crazygames.com/crazygames-sdk-v3.js");
      if (loaded && window.CrazyGames && window.CrazyGames.SDK) {
        try {
          this.crazySdk = window.CrazyGames.SDK;
          await this.crazySdk.init();
          this.platform = 'crazygames';
          window.crazyGamesInitialized = true;
          console.log("PortalAdapter: CrazyGames SDK initialized.");
          return true;
        } catch (e) {
          console.warn("PortalAdapter: CrazyGames SDK init failed:", e);
        }
      }
    }

    console.log("PortalAdapter: Running in local/mock/development mode.");
    return false;
  }

  gameplayStart() {
    if (this.platform === 'poki') {
      PokiSDK.gameplayStart();
    } else if (this.platform === 'crazygames' && this.crazySdk) {
      this.crazySdk.game.gameplayStart();
    }
  }

  gameplayStop() {
    if (this.platform === 'poki') {
      PokiSDK.gameplayStop();
    } else if (this.platform === 'crazygames' && this.crazySdk) {
      this.crazySdk.game.gameplayStop();
    }
  }

  async commercialBreak() {
    if (this.platform === 'poki') {
      return PokiSDK.commercialBreak();
    } else if (this.platform === 'crazygames' && this.crazySdk) {
      return new Promise((resolve) => {
        this.crazySdk.ad.requestAd('midgame', {
          adStarted: () => console.log("CrazyGames midgame ad started"),
          adFinished: () => resolve(true),
          adError: (err) => {
            console.error("CrazyGames midgame ad error:", err);
            resolve(false);
          }
        });
      });
    }
    return false;
  }

  async rewardedAd() {
    if (this.platform === 'poki') {
      return PokiSDK.rewardedBreak();
    } else if (this.platform === 'crazygames' && this.crazySdk) {
      return new Promise((resolve) => {
        this.crazySdk.ad.requestAd('rewarded', {
          adStarted: () => console.log("CrazyGames rewarded ad started"),
          adFinished: () => resolve(true),
          adError: (err) => {
            console.error("CrazyGames rewarded ad error:", err);
            resolve(false);
          }
        });
      });
    }
    // Fallback for local testing
    return new Promise((resolve) => setTimeout(() => resolve(true), 600));
  }
}

export default new PortalAdapter();

