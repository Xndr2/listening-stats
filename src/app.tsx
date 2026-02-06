import {
  getSelectedProviderType,
  hasExistingData,
  activateProvider,
  setSelectedProviderType,
} from "./services/providers";
import { clearConfig as clearLastfmConfig } from "./services/lastfm";

(window as any).ListeningStats = {
  resetLastfmKey: () => {
    clearLastfmConfig();
    console.log(
      "[Listening Stats] Last.fm API key cleared. Reload the app to reconfigure.",
    );
  },
};

async function main(): Promise<void> {
  let providerType = getSelectedProviderType();

  if (!providerType && hasExistingData()) {
    providerType = "local";
    setSelectedProviderType("local");
  }

  if (providerType) {
    activateProvider(providerType);
  }
}

(function init() {
  if (!Spicetify.Player || !Spicetify.Platform || !Spicetify.CosmosAsync) {
    setTimeout(init, 100);
    return;
  }
  main();
})();
