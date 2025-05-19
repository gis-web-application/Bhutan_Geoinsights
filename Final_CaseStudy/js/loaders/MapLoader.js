class MapLoader {

  // CONFIG//
  config;

  /**
   *
   * @param {{}} config
   */
  constructor(config) {
    this.config = config;
  }

  /**
   *
   * @returns {Promise<unknown>}
   */
  loadMap() {
    return new Promise((resolve, reject) => {

      const itemID = (this.config.webmap || this.config.webscene);
      if (itemID) {

        if (this.config.webmap) {
          require(['esri/WebMap'], WebMap => {
            const map = new WebMap({portalItem: {id: itemID}});
            map.load().then(resolve).catch(reject);
          });
        }

        if (this.config.webscene) {
          require(['esri/WebScene'], WebScene => {
            const map = new WebScene({portalItem: {id: itemID}});
            map.load().then(resolve).catch(reject);
          });
        }
      } else {
        reject(new Error('No configured WebMap or WebScene id.'));
      }

    });
  }

}

MapLoader.hasMap = (config) => {
  return (config.webmap?.length || config.webscene?.length);
};

export default MapLoader;
