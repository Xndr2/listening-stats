import {
  getSelectedProviderType,
  hasExistingData,
  activateProvider,
  setSelectedProviderType,
} from "./services/providers";

async function main(): Promise<void> {
  let providerType = getSelectedProviderType();

  if (!providerType && hasExistingData()) {
    providerType = "spotify";
    setSelectedProviderType("spotify");
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
