class AppConfig extends EventTarget {

  static version = '0.0.1';

  // PATH TO DEFAULT CONFIG //
  static DEFAULT_CONFIG_PATH = './config/application.json';

  /**
   * BASE URL
   *
   * @type {string}
   * @private
   */
  _baseUrl;

  /**
   * URL PARAMETERS
   *
   * @type {URLSearchParams}
   */
  _urlParams;

  /**
   *
   */
  constructor() {
    super();

    // BASE URL //
    this._baseUrl = encodeURI(`${ window.location.origin }${ window.location.pathname }`);

  }

  /**
   *
   * @param {string | null} configPath
   * @returns {Promise}
   */
  async load(configPath) {
    return new Promise((resolve, reject) => {

      // GET LOCAL CONFIG FILE //
      fetch(configPath || AppConfig.DEFAULT_CONFIG_PATH).then(res => {
        return res.ok
          ? res.json()
          : Promise.reject(`Error loading application configuration. HTTP status ${ res.status }: ${ res.statusText }`);
      }).then(config => {

        // SEARCH PARAMS //
        this._urlParams = new URLSearchParams(window.location.search);
        this._urlParams.has('webmap') && (delete config.webscene);
        this._urlParams.has('webscene') && (delete config.webmap);

        // APPLICATION CONFIG //
        Object.assign(this, config);
        Object.assign(this, Object.fromEntries(this._urlParams));

        // SET SHAREABLE //
        this.shareable.forEach(shareable => {
          this.setSharable(shareable);
        });

        resolve();
      }).catch(reject);

    });
  }

  /**
   *
   * @param view
   */
  initializeViewShareable({view}) {
    require(['esri/core/reactiveUtils'], (reactiveUtils) => {
      if(view) {

        if (this.shareable.includes('center')) {
          reactiveUtils.watch(() => view.center, center => {
            const {longitude, latitude} = center;
            this.center = `${ longitude },${ latitude }`;
          });
        }

        if (this.shareable.includes('zoom')) {
          reactiveUtils.watch(() => view.zoom, zoom => {
            this.zoom = zoom;
          });
        }

      }

      // REMOVE URL PARAMETERS //
      //window.history.pushState({}, '', (window.location.origin + window.location.pathname));
    });
  }

  /**
   *
   * @param {string} name
   * @param {string|number|null} value
   * @param {boolean|null} shareable
   */
  setParameter(name, value, shareable = false) {
    this[name] = value;
    if (shareable) {
      this._urlParams.set(name, value);
    }
  }

  /**
   *
   * @param {string} name
   */
  setSharable(name) {
    if (!this._urlParams.has(name)) {
      this._urlParams.set(name, this.getParam(name));
    }
  }

  /**
   *
   * @param {string} name
   * @param {Function|null} formatter
   * @returns {*}
   */
  getParam(name, formatter = null) {
    const value = this[name] || null;
    return (formatter && value) ? formatter(value) : value;
  }

  /**
   *
   * @returns {string}
   */
  toShareURL() {
    const searchString = this._urlParams.toString();
    return searchString.length ? `${ this._baseUrl }?${ searchString }` : this._baseUrl;
  }

}

export default AppConfig;
