class ViewLoading extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {MapView|SceneView}
   */
  view;

  /**
   * @type {boolean}
   */
  #enabled;
  get enabled() {
    return this.#enabled;
  }

  set enabled(value) {
    this.#enabled = value && this.view.updating;
    this.loader?.toggleAttribute('hidden', !this.#enabled);
  }

  constructor({ container, view, enabled = true }) {
    super();
  
    console.log("Container parameter:", container);
  
    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);
    console.log("Resolved container:", this.container);
  
    this.view = view;
    this.#enabled = enabled;
  
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = `
      <style>
        :host {
          pointer-events: none;
          box-shadow: none !important;
        }
        :host calcite-loader {
          --calcite-loader-padding: 0;           
          margin: auto 15px;          
        }     
      </style>
      <calcite-loader type="indeterminate" scale="s"></calcite-loader>   
    `;
  
    this.container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {
    require(['esri/core/reactiveUtils'], (reactiveUtils) => {
      this.view.when(() => {
        this.loader = this.shadowRoot.querySelector('calcite-loader');
        if (!this.loader) {
          console.error("Loader element not found in shadow DOM.");
          return;
        }
  
        let debounceTimeout;
  
        // Watch the view's updating state
        reactiveUtils.watch(() => this.view.updating, (updating) => {
          console.log("View updating state changed:", updating);
  
          // Clear any existing debounce timeout
          clearTimeout(debounceTimeout);
  
          // Debounce the loader visibility update
          debounceTimeout = setTimeout(() => {
            if (this.#enabled) {
              this.loader.toggleAttribute('hidden', !updating);
              console.log("Loader visibility updated. Hidden:", this.loader.hasAttribute('hidden'));
            }
          }, 200); // Adjust the debounce delay as needed (200ms in this case)
        });
      });
    });
  }

}

customElements.define("apl-view-loading", ViewLoading);

export default ViewLoading;
