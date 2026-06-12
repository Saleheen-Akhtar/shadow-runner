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
class PortalAdapter {
  constructor() {
    this.platform = 'none'; // 'poki', 'crazygames', or 'none'
    this.crazySdk = null;
  }

  async init() {
    // 1. Detect and initialize Poki SDK
    if (typeof PokiSDK !== 'undefined') {
      try {
        await PokiSDK.init();
        this.platform = 'poki';
        console.log("PortalAdapter: Poki SDK initialized.");
        return true;
      } catch (e) {
        console.warn("PortalAdapter: Poki SDK init failed:", e);
      }
    }

    // 2. Detect and initialize CrazyGames SDK
    if (window.CrazyGames && window.CrazyGames.SDK) {
      try {
        this.crazySdk = window.CrazyGames.SDK;
        await this.crazySdk.init();
        this.platform = 'crazygames';
        console.log("PortalAdapter: CrazyGames SDK initialized.");
        return true;
      } catch (e) {
        console.warn("PortalAdapter: CrazyGames SDK init failed:", e);
      }
    }

    console.log("PortalAdapter: Running in local/mock mode.");
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

