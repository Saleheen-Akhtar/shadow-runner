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
  async init() {
    // Load + initialize the portal SDK here.
  }

  gameplayStart() {
    // Called when a run starts or resumes.
  }

  gameplayStop() {
    // Called on pause and game over.
  }

  async commercialBreak() {
    // Show an interstitial ad between runs. Resolve when gameplay may resume.
  }

  async rewardedAd() {
    // Show a rewarded ad (e.g. for a revive). Resolve `true` if the
    // player earned the reward.
    //
    // Dev stub: simulate a successful ad after a short delay so the
    // revive flow can be tested locally. Real portal builds replace
    // this with PokiSDK.rewardedBreak() / CrazyGames rewarded ad.
    return new Promise((resolve) => setTimeout(() => resolve(true), 600));
  }
}

export default new PortalAdapter();
